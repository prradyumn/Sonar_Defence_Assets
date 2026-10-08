#!/usr/bin/env python3
"""make_voices: record every spoken line of Sonar Defence with Gemini TTS (Indian-English voices).

    export GEMINI_API_KEY=...  &&  python3 tools/make_voices.py

Reads the lines from js/script.js (through node), writes assets/vo/<id>.ogg (Opus, via ffmpeg; .wav if
ffmpeg is missing) and keeps assets/vo/vo_manifest.js (window.VO_HAVE = [...]) in step after every file.
Ids that are already recorded are skipped unless --force. Standard library only (+ ffmpeg for .ogg).
The API key is read from the environment and is never printed or written anywhere.
"""
import argparse
import array
import base64
import json
import math
import os
import re
import shutil
import struct
import subprocess
import sys
import time
import urllib.error
import urllib.request
import wave

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SCRIPT_JS = os.path.join(ROOT, 'js', 'script.js')
VO_DIR = os.path.join(ROOT, 'assets', 'vo')
MANIFEST = os.path.join(VO_DIR, 'vo_manifest.js')
API = 'https://generativelanguage.googleapis.com/v1beta'
FALLBACK_MODEL = 'gemini-2.5-flash-preview-tts'
DEFAULT_VOICE = {'meera': 'Kore', 'riya': 'Leda'}

# persona + director's notes (carried over from the old tools/voice_studio.html)
PROFILE = {
    'meera': {
        'name': 'Commander Meera',
        'persona': 'Commander Meera is a confident, warm Indian Coast Guard officer in her thirties. She is on the deck of a patrol ship, guiding young cadets (Grade 6 children) through a mission to stop enemy submarines.',
        'style': 'Speak in a natural Indian English accent, like a friendly, energetic teacher from India. Clear, crisp and encouraging with calm authority. Say numbers slowly and clearly, stressing "plus" and "minus". A little excitement on "Fire!" and "Correct!", gentle and kind on "Oops". Not robotic, not American, not British.',
    },
    'riya': {
        'name': 'Cadet Riya',
        'persona': 'Cadet Riya is an excited, brave 11-year-old Indian girl on her very first patrol with the Coast Guard.',
        'style': 'Speak in a natural Indian English accent with a bright, young girl\u2019s voice. Energetic, curious and playful, quick pace, a big smile in the voice. Cheer loudly on words like "Shabash!", "Bullseye!" and "Woohoo!". Sound worried but brave when asking questions.',
    },
}

# loads js/script.js with a fake window and prints every line with how it is read aloud
NODE_DUMP = r'''
const vm = require('vm'), fs = require('fs');
const ctx = { window: {} };
vm.runInNewContext(fs.readFileSync(process.argv[1], 'utf8'), ctx, { filename: process.argv[1] });
const S = ctx.window.SCRIPT;
process.stdout.write(JSON.stringify(S.LINES.map(l => ({ id: l.id, who: l.who, text: l.text, spoken: S.spoken(l.text) }))));
'''


class Fatal(Exception):
    """Stops the whole run (bad key, no quota left …)."""


def die(msg):
    print('\u2717 ' + msg, file=sys.stderr)
    sys.exit(1)


def load_lines():
    node = shutil.which('node')
    if not node:
        die('node is not installed (needed to read js/script.js). Install it from https://nodejs.org or `brew install node`.')
    try:
        out = subprocess.run([node, '-e', NODE_DUMP, SCRIPT_JS], capture_output=True, text=True, check=True).stdout
    except subprocess.CalledProcessError as e:
        die('node could not read js/script.js:\n' + e.stderr.strip())
    return json.loads(out)


# ---------------- HTTP ----------------
def call(method, url, key, body=None, timeout=120):
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(url, data=data, method=method,
                                 headers={'x-goog-api-key': key, 'Content-Type': 'application/json'})
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return r.status, json.loads(r.read() or b'{}')
    except urllib.error.HTTPError as e:
        try:
            payload = json.loads(e.read() or b'{}')
        except ValueError:
            payload = {}
        return e.code, payload


def err_text(payload, status):
    return (payload.get('error') or {}).get('message') or ('HTTP %d' % status)


def err_details(payload):
    return (payload.get('error') or {}).get('details') or []


def is_bad_key(status, payload):
    if status in (401, 403):
        return True
    reasons = [d.get('reason', '') for d in err_details(payload)]
    return status == 400 and ('API_KEY_INVALID' in reasons or 'API key not valid' in err_text(payload, status))


def retry_delay(payload):
    for d in err_details(payload):
        m = re.match(r'([\d.]+)s', str(d.get('retryDelay', '')))
        if m:
            return float(m.group(1))
    return None


def daily_quota_hit(payload):
    for d in err_details(payload):
        for v in d.get('violations') or []:
            if 'PerDay' in v.get('quotaId', ''):
                return True
    return False


def pick_model(key, wanted):
    if wanted and wanted != 'auto':
        return wanted
    status, j = call('GET', API + '/models?pageSize=200', key, timeout=30)
    if is_bad_key(status, j):
        raise Fatal('the API key was refused: ' + err_text(j, status))
    if status != 200:
        print('  (could not list models: %s; using %s)' % (err_text(j, status), FALLBACK_MODEL))
        return FALLBACK_MODEL
    names = [m['name'].split('/', 1)[-1] for m in j.get('models', [])
             if 'tts' in m['name'].lower() and 'generateContent' in (m.get('supportedGenerationMethods') or ['generateContent'])]
    if not names:
        raise Fatal('this key has no TTS model available')

    def ver(n):
        m = re.search(r'gemini-(\d+(?:\.\d+)?)', n)
        return float(m.group(1)) if m else 0.0

    flash = [n for n in names if 'flash' in n] or names
    # highest version first; at equal version prefer full Flash over Flash-Lite, a stable name over a preview
    flash.sort(key=lambda n: (-ver(n), 'lite' in n, 'preview' in n, len(n), n))
    return flash[0]


# ---------------- prompt + TTS ----------------
def tts_text(spoken):
    # a bare "0" ending a sentence makes the TTS ad-lib ("… at 0 points"); the word reads the same and stays put
    return re.sub(r'(?<![\w.+\-])0(?!\w|\.\d)', 'zero', spoken)


def build_prompt(line, style=None):
    p = PROFILE[line['who']]
    return "# AUDIO PROFILE: %s\n%s\n### DIRECTOR'S NOTES\nStyle: %s\nAccent: Indian English.\n#### TRANSCRIPT\n%s" % (
        p['name'], p['persona'], style or p['style'], tts_text(line['spoken']))


def decode_audio(data, mime):
    """→ (16-bit mono PCM bytes, rate). Older models send raw L16 PCM; newer ones send a whole WAV file
    whose extra chunks (e.g. a C2PA content-credentials block) must NOT be treated as sound."""
    m = re.search(r'rate=(\d+)', mime or '')
    rate = int(m.group(1)) if m else 24000
    if data[:4] == b'RIFF' and data[8:12] == b'WAVE':
        fmt, pcm, i = None, None, 12
        while i + 8 <= len(data):
            cid, size = data[i:i + 4], struct.unpack('<I', data[i + 4:i + 8])[0]
            body = data[i + 8:i + 8 + size]
            if cid == b'fmt ':
                fmt = struct.unpack('<HHIIHH', body[:16])
            elif cid == b'data':
                pcm = body
            i += 8 + size + (size & 1)
        if not fmt or pcm is None:
            raise RuntimeError('the WAV in the reply has no fmt/data chunk')
        tag, channels, rate, _, _, bits = fmt
        if tag != 1 or bits != 16:
            raise RuntimeError('unsupported WAV format (tag %d, %d-bit)' % (tag, bits))
        if channels > 1:                                  # mix down to mono
            s = array.array('h', pcm[:len(pcm) - len(pcm) % (2 * channels)])
            pcm = array.array('h', (sum(s[j:j + channels]) // channels for j in range(0, len(s), channels))).tobytes()
        return pcm, rate
    if mime and not re.match(r'audio/(l16|pcm)', mime, re.I):
        raise RuntimeError('unexpected audio format %r' % mime)
    return data, rate


def tts(line, key, model, voice, lang=None, tries=6):
    speech = {'voiceConfig': {'prebuiltVoiceConfig': {'voiceName': voice}}}
    if lang:
        speech['languageCode'] = lang
    body = {'contents': [{'parts': [{'text': build_prompt(line)}]}],
            'generationConfig': {'responseModalities': ['AUDIO'], 'speechConfig': speech}}
    url = '%s/models/%s:generateContent' % (API, model)
    last = 'no reply'
    for attempt in range(tries):
        try:
            status, j = call('POST', url, key, body)
        except (urllib.error.URLError, OSError) as e:      # network hiccup → back off and retry
            status, j, last = 0, {}, 'network error: %s' % getattr(e, 'reason', e)
        if is_bad_key(status, j):
            raise Fatal('the API key was refused: ' + err_text(j, status))
        if status == 429 and daily_quota_hit(j):
            raise Fatal('the daily quota for %s is used up. Run the script again later; it resumes where it stopped.' % model)
        if status == 200:
            parts = (((j.get('candidates') or [{}])[0].get('content') or {}).get('parts')) or []
            audio = next((p['inlineData'] for p in parts if 'inlineData' in p), None)
            if audio:
                return decode_audio(base64.b64decode(audio['data']), audio.get('mimeType', ''))
            last = 'the reply had no audio (finishReason %s)' % (j.get('candidates') or [{}])[0].get('finishReason')
        elif status == 429 or status >= 500 or status == 0:
            last = err_text(j, status) if status else last
        else:
            raise RuntimeError(err_text(j, status))
        if attempt == tries - 1:
            break
        wait = retry_delay(j)
        wait = wait + 1 if wait is not None else min(60, 4 * 2 ** attempt)
        print('    \u2026 %s, retrying in %ds' % (last.split('.')[0][:80], wait))
        time.sleep(wait)
    raise RuntimeError('gave up after %d tries: %s' % (tries, last))


# ---------------- word check: TTS models sometimes ad-lib ("… Fire! Correct.") ----------------
def pick_text_model(key):
    status, j = call('GET', API + '/models?pageSize=200', key, timeout=30)
    names = [m['name'].split('/', 1)[-1] for m in j.get('models', []) if 'generateContent' in (m.get('supportedGenerationMethods') or [])] if status == 200 else []
    names = [n for n in names if re.match(r'gemini-\d', n) and 'flash' in n and not re.search(r'tts|image|live|lite|embed|audio|omni', n)]
    ver = lambda n: float((re.search(r'gemini-(\d+(?:\.\d+)?)', n) or [0, 0])[1])
    names.sort(key=lambda n: (-ver(n), 'preview' in n, len(n)))
    return names[0] if names else 'gemini-2.5-flash'


def transcribe(path, key, model, tries=4):
    with open(path, 'rb') as f:
        b64 = base64.b64encode(f.read()).decode()
    mime = 'audio/ogg' if path.endswith('.ogg') else 'audio/wav'
    body = {'contents': [{'parts': [{'inlineData': {'mimeType': mime, 'data': b64}},
                                    {'text': 'Transcribe exactly what is spoken, word for word, including any extra words at the end. Output only the transcript.'}]}],
            'generationConfig': {'temperature': 0}}
    for attempt in range(tries):
        status, j = call('POST', '%s/models/%s:generateContent' % (API, model), key, body)
        if status == 200:
            parts = (((j.get('candidates') or [{}])[0].get('content') or {}).get('parts')) or []
            return ' '.join(p.get('text', '') for p in parts).strip()
        if is_bad_key(status, j):
            raise Fatal('the API key was refused: ' + err_text(j, status))
        if status != 429 and status < 500:
            raise RuntimeError('transcription failed: ' + err_text(j, status))
        time.sleep((retry_delay(j) or 4 * 2 ** attempt) + 1)
    raise RuntimeError('transcription kept failing')


NUM = {w: str(i) for i, w in enumerate('zero one two three four five six seven eight nine ten'.split())}
SAME = {'mira': 'meera', 'ria': 'riya', 'rhea': 'riya', 'shabaash': 'shabash', 'okay': 'ok'}


def words(t):
    t = t.lower().replace('−', '-').replace('’', "'")
    t = re.sub(r'-\s?(\d)', r' minus \1', t)
    t = re.sub(r'\+\s?(\d)', r' plus \1', t)
    out = []
    for w in re.findall(r"[a-z0-9']+", t):
        w = w.strip("'")
        out.append(SAME.get(NUM.get(w, w), NUM.get(w, w)))
    return [w for w in out if w]


def word_diff(expected, heard):
    """→ '' when the take says the line (spelling slips allowed), else a short description of what differs."""
    import difflib
    a, b = words(expected), words(heard)
    probs = []
    for op, i1, i2, j1, j2 in difflib.SequenceMatcher(None, a, b, autojunk=False).get_opcodes():
        if op == 'equal':
            continue
        if op == 'replace' and difflib.SequenceMatcher(None, ''.join(a[i1:i2]), ''.join(b[j1:j2])).ratio() >= 0.75:
            continue                                         # spelling slip: Mira/Meera, woo hoo/woohoo
        probs.append({'insert': '+"%s"', 'delete': '-"%s"'}.get(op, '~"%s"') % ' '.join(b[j1:j2] if op == 'insert' else a[i1:i2]) +
                     (' → "%s"' % ' '.join(b[j1:j2]) if op == 'replace' else ''))
    return ', '.join(probs)


# ---------------- audio polish (pure Python) ----------------
def polish(pcm, rate, thresh_db=-42.0, pad_in=0.06, pad_out=0.14, peak_db=-1.0, fade=0.008):
    """Trim leading/trailing silence, normalise the peak, and fade the cut edges (no clicks).
    pcm: 16-bit little-endian mono bytes."""
    s = array.array('h')
    s.frombytes(pcm[:len(pcm) - len(pcm) % 2])
    if sys.byteorder == 'big':
        s.byteswap()
    if not s:
        return pcm
    thr = 32767 * 10 ** (thresh_db / 20)
    win = max(1, int(rate * 0.01))                      # 10 ms windows: a single click does not count as speech
    loud = [i for i in range(0, len(s), win) if max(abs(x) for x in s[i:i + win]) > thr]
    if loud:
        a = max(0, loud[0] - int(rate * pad_in))
        b = min(len(s), loud[-1] + win + int(rate * pad_out))
        s = s[a:b]
    peak = max(abs(x) for x in s) or 1
    k = 32767 * 10 ** (peak_db / 20) / peak
    nf = min(len(s) // 2, int(rate * fade))
    g = lambda i: k * min(1.0, i / nf if nf else 1.0, (len(s) - 1 - i) / nf if nf else 1.0)
    s = array.array('h', (max(-32768, min(32767, int(round(x * g(i))))) for i, x in enumerate(s)))
    if sys.byteorder == 'big':
        s.byteswap()
    return s.tobytes()


def write_wav(path, pcm, rate):
    tmp = path + '.part'
    with wave.open(tmp, 'wb') as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(rate)
        w.writeframes(pcm)
    os.replace(tmp, path)


FFMPEG = shutil.which('ffmpeg')


def save_take(lid, pcm, rate, fmt):
    """→ path of the recorded line: Ogg Opus through ffmpeg (small, plays in every modern browser), else WAV."""
    base = os.path.join(VO_DIR, lid)
    if fmt == 'ogg' and FFMPEG:
        tmp = base + '.part.ogg'
        subprocess.run([FFMPEG, '-v', 'error', '-y', '-f', 's16le', '-ar', str(rate), '-ac', '1', '-i', 'pipe:0',
                        '-c:a', 'libopus', '-b:a', '48k', '-application', 'audio', tmp], input=pcm, check=True)
        os.replace(tmp, base + '.ogg')
        if os.path.exists(base + '.wav'):
            os.remove(base + '.wav')
        return base + '.ogg'
    write_wav(base + '.wav', pcm, rate)
    return base + '.wav'


MOUTH = os.path.join(VO_DIR, 'vo_mouth.js')


def write_mouth(lines):
    """assets/vo/vo_mouth.js: how open the mouth is 12 times a second (0 closed … 3 wide), from each line's loudness.
    The game uses it to lip-sync the talking face sprites."""
    if not FFMPEG:
        return 0
    env = {}
    for l in lines:
        p = vo_file(l['id'])
        if not p:
            continue
        pcm = subprocess.run([FFMPEG, '-v', 'error', '-i', p, '-f', 's16le', '-ac', '1', '-ar', '12000', '-'], capture_output=True, check=True).stdout
        s = array.array('h')
        s.frombytes(pcm[:len(pcm) - len(pcm) % 2])
        if sys.byteorder == 'big':
            s.byteswap()
        rms = [math.sqrt(sum(x * x for x in s[i:i + 1000]) / max(1, len(s[i:i + 1000]))) for i in range(0, len(s), 1000)]
        ref = sorted(rms)[int(len(rms) * .9)] or 1.0
        voiced = sorted(r for r in rms if r >= .12 * ref) or [ref]            # silence → closed; voiced → the line's own thirds
        q1, q2 = voiced[len(voiced) // 3], voiced[2 * len(voiced) // 3]
        env[l['id']] = ''.join('0' if r < .12 * ref else '1' if r < q1 else '2' if r < q2 else '3' for r in rms)
    tmp = MOUTH + '.part'
    with open(tmp, 'w', encoding='utf-8') as f:
        f.write('/* mouth openness per line, 12 values a second (0 closed … 3 wide); written by tools/make_voices.py */\nwindow.VO_MOUTH = ' + json.dumps(env, separators=(',', ':')) + ';\n')
    os.replace(tmp, MOUTH)
    return len(env)


def vo_file(lid):
    for ext in ('.ogg', '.wav'):
        if os.path.exists(os.path.join(VO_DIR, lid + ext)):
            return os.path.join(VO_DIR, lid + ext)
    return None


def write_manifest(lines):
    ids = [l['id'] for l in lines if vo_file(l['id'])]
    tmp = MANIFEST + '.part'
    with open(tmp, 'w', encoding='utf-8') as f:
        f.write('window.VO_HAVE = ' + json.dumps(ids) + ';\n')
    os.replace(tmp, MANIFEST)
    return ids


# ---------------- main ----------------
def main():
    ap = argparse.ArgumentParser(description='Generate Sonar Defence voice lines with Gemini TTS.',
                                 epilog='Example: export GEMINI_API_KEY=... && python3 tools/make_voices.py --only h1,h2')
    ap.add_argument('--only', help='comma-separated line ids, e.g. h1,h2')
    ap.add_argument('--who', choices=['meera', 'riya'], help='only this character')
    ap.add_argument('--force', action='store_true', help='regenerate even if the wav exists')
    ap.add_argument('--model', default='auto', help='TTS model name, or auto (newest Flash TTS model) [auto]')
    ap.add_argument('--meera', default=DEFAULT_VOICE['meera'], help='prebuilt voice for Commander Meera [Kore]')
    ap.add_argument('--riya', default=DEFAULT_VOICE['riya'], help='prebuilt voice for Cadet Riya [Leda]')
    ap.add_argument('--lang', help='optional speech language code sent to the API, e.g. en-IN (default: none)')
    ap.add_argument('--no-polish', action='store_true', help='keep the raw audio (no trim / normalise)')
    ap.add_argument('--wav', action='store_true', help='write .wav instead of .ogg')
    ap.add_argument('--gap', type=float, default=0.5, help='seconds to wait between requests [0.5]')
    ap.add_argument('--verify', action='store_true', help='transcribe every new take and re-take it (up to 3x) if the words differ')
    ap.add_argument('--check', action='store_true', help='only transcribe the recorded wavs and list lines whose words differ')
    ap.add_argument('--mouth', action='store_true', help='only rebuild assets/vo/vo_mouth.js (lip-sync data) from the recorded lines')
    ap.add_argument('--dry-run', action='store_true', help='list what would be made and show one prompt; no API calls')
    args = ap.parse_args()

    lines = load_lines()
    todo = lines
    if args.only:
        want = [x.strip() for x in args.only.split(',') if x.strip()]
        unknown = [x for x in want if x not in {l['id'] for l in lines}]
        if unknown:
            die('unknown line id(s): %s' % ', '.join(unknown))
        todo = [l for l in lines if l['id'] in want]
    if args.who:
        todo = [l for l in todo if l['who'] == args.who]
    os.makedirs(VO_DIR, exist_ok=True)
    skip = [l for l in todo if not args.force and vo_file(l['id'])]
    make = [l for l in todo if l not in skip]
    voice = {'meera': args.meera, 'riya': args.riya}

    if args.dry_run:
        for l in make:
            print('%-16s %-6s %s' % (l['id'], l['who'], l['spoken']))
        print('\n%d to make, %d already recorded.' % (len(make), len(skip)))
        if make:
            print('\nPrompt for %s:\n%s' % (make[0]['id'], build_prompt(make[0])))
        return

    if args.mouth:
        print('vo_mouth.js: %d lines' % write_mouth(lines))
        return

    key = os.environ.get('GEMINI_API_KEY', '').strip()
    if not key:
        print('GEMINI_API_KEY is not set. Run:\n\n  export GEMINI_API_KEY=...   # your key from https://aistudio.google.com/apikey\n'
              '  python3 tools/make_voices.py\n', file=sys.stderr)
        sys.exit(2)

    if args.check:
        rec = [l for l in todo if vo_file(l['id'])]
        stt, bad = pick_text_model(key), []
        print('Checking %d recorded lines with %s \u2026' % (len(rec), stt))
        try:
            for l in rec:
                diff = word_diff(l['spoken'], transcribe(vo_file(l['id']), key, stt))
                print('  %s %-16s %s' % ('\u2717' if diff else '\u2713', l['id'], diff))
                if diff:
                    bad.append(l['id'])
        except Fatal as e:
            die(str(e))
        print('\n%d of %d match.%s' % (len(rec) - len(bad), len(rec), ('\nRe-record: python3 tools/make_voices.py --verify --force --only ' + ','.join(bad)) if bad else ''))
        sys.exit(1 if bad else 0)

    fmt = 'wav' if args.wav or not FFMPEG else 'ogg'
    if not args.wav and not FFMPEG and make:
        print('(ffmpeg not found: writing .wav. Install it (brew install ffmpeg) for small .ogg files.)')
    made, failed, odd = [], [], []
    try:
        model = pick_model(key, args.model) if make else '-'
        stt = pick_text_model(key) if make and args.verify else None
        print('Model: %s \u00b7 Meera: %s \u00b7 Riya: %s%s \u00b7 %d to make, %d skipped' % (model, args.meera, args.riya, ' \u00b7 lang ' + args.lang if args.lang else '', len(make), len(skip)))
        for i, l in enumerate(make, 1):
            print('[%d/%d] %-16s %s' % (i, len(make), l['id'], l['spoken'][:70]))
            try:
                for take in range(1, 4 if stt else 2):
                    pcm, rate = tts(l, key, model, voice[l['who']], args.lang)
                    if not args.no_polish:
                        pcm = polish(pcm, rate)
                    path = save_take(l['id'], pcm, rate, fmt)
                    diff = stt and word_diff(l['spoken'], transcribe(path, key, stt))
                    if not diff:
                        break
                    print('    take %d differs: %s' % (take, diff))
                else:
                    odd.append(l['id'])
                write_manifest(lines)
                made.append(l['id'])
                print('    \u2713 %.1fs %s%s' % (len(pcm) / 2.0 / rate, os.path.basename(path), ' (words checked)' if stt and l['id'] not in odd else ''))
            except RuntimeError as e:
                failed.append(l['id'])
                print('    \u2717 %s' % e)
            if i < len(make):
                time.sleep(args.gap)
    except Fatal as e:
        print('\u2717 Stopped: %s' % e)
        failed += [l['id'] for l in make if l['id'] not in made and l['id'] not in failed]
    except KeyboardInterrupt:
        print('\nInterrupted.')
        failed += [l['id'] for l in make if l['id'] not in made and l['id'] not in failed]

    have = write_manifest(lines)
    if made:
        write_mouth(lines)
    print('\nDone: %d made \u00b7 %d skipped \u00b7 %d failed \u00b7 %d of %d lines recorded.' % (len(made), len(skip), len(failed), len(have), len(lines)))
    if failed:
        print('Failed: ' + ', '.join(failed) + '\nRun again to retry them (finished lines are skipped).')
    if odd:
        print('Still differ after 3 takes (kept the last one, please listen): ' + ', '.join(odd))
    print('README: export GEMINI_API_KEY=\u2026 && python3 tools/make_voices.py')
    sys.exit(1 if failed else 0)


if __name__ == '__main__':
    main()
