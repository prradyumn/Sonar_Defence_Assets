#!/usr/bin/env python3
"""make_voices_parler: record every spoken line of Sonar Defence with AI4Bharat Indic Parler-TTS (open source, Apache 2.0).

    source ~/parler/bin/activate
    python tools/make_voices_parler.py --audition          # line h1 in several voices → pick a speaker
    python tools/make_voices_parler.py --speaker Meera     # every line, 3 takes each; take 1 goes into the game
    python tools/make_voices_parler.py --pick l2a=3        # swap in another take
    --model large   open Parler-TTS Large (no Indian accent) · --model melo   MeloTTS EN_INDIA (MIT), run from ~/melo

Needs: a Hugging Face login (`hf auth login`) and the terms accepted at https://huggingface.co/ai4bharat/indic-parler-tts.
Takes are kept in assets/vo/takes/ (listen with `afplay`); the chosen one is written as assets/vo/<id>.ogg and
assets/vo/vo_manifest.js is kept in step, exactly like tools/make_voices.py.
Credit: voices made with Indic Parler-TTS by AI4Bharat (Apache 2.0).
"""
import argparse
import os
import re
import shutil
import sys
import time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from make_voices import FFMPEG, VO_DIR, die, load_lines, polish, save_take, tts_text, vo_file, write_manifest  # noqa: E402

MODELS = {   # --model: Hugging Face repo, female speakers to audition, accent words for the description
    'indic': ('ai4bharat/indic-parler-tts', ['Meera', 'Mary', 'Swapna', 'Sneha', 'Divya'], 'Indian English'),   # gated: accept the terms first
    'large': ('parler-tts/parler-tts-large-v1', ['Lea', 'Jenna', 'Laura', 'Rose', 'Emily'], 'clear'),             # open, no Indian accent
    'melo': ('myshell-ai/MeloTTS-English', ['EN_INDIA', 'EN-BR', 'EN-US'], ''),                                   # MIT, Indian accent; run from ~/melo
}
MODEL = MODELS['indic'][0]
TAKES = os.path.join(VO_DIR, 'takes')

# how each line should sound (Parler reads this description, not the line, to shape the voice)
DESC = ('{sp} speaks in a {tone} {accent} voice at a moderate pace, with clear pronunciation. '
        'The recording is of very high quality, with the speaker’s voice sounding clear and very close up, with no background noise.')
TONE = {
    'h1': 'urgent, confident and commanding',
    'h2': 'alarmed but steady and determined',
    'l1a': 'confident, clear and encouraging',
    'l1b': 'energetic, excited and encouraging',
    'l2a': 'calm, warm and clear, teacher-like',
    'l2b': 'confident and energetic, with excitement at the end',
    'l3a': 'urgent but warm and encouraging',
}
DEFAULT_TONE = 'confident, warm and expressive'


def sentences(text):
    """Long lines are made one sentence at a time (Parler drifts on long text) and joined with short pauses."""
    parts = [p.strip() for p in re.split(r'(?<=[.!?])\s+', text) if p.strip()]
    out = []
    for p in parts:                                   # keep short bursts ("Fire! Fire! Fire!") together
        if out and (len(p.split()) <= 2 or len(out[-1].split()) <= 2):
            out[-1] += ' ' + p
        else:
            out.append(p)
    return out


class Voice:
    def __init__(self, device):
        try:
            import torch
            from parler_tts import ParlerTTSForConditionalGeneration
            from transformers import AutoTokenizer
        except ImportError as e:
            die('missing package (%s). Run: source ~/parler/bin/activate' % e.name)
        self.torch = torch
        if device == 'auto':
            device = 'cpu'                                 # Parler on the Apple GPU (mps) comes out as noise
        self.device = device
        print('Loading %s on %s … (the first run downloads ~3.5 GB)' % (MODEL, device))
        try:
            self.model = ParlerTTSForConditionalGeneration.from_pretrained(MODEL).to(device)
            self.tok = AutoTokenizer.from_pretrained(MODEL)
            self.desc_tok = AutoTokenizer.from_pretrained(self.model.config.text_encoder._name_or_path)
        except OSError as e:
            if re.search(r'gated|401|403|access', str(e), re.I):
                die('Hugging Face refused the download. Log in with `hf auth login` and accept the terms at\n'
                    '  https://huggingface.co/%s' % MODEL)
            raise
        self.rate = self.model.config.sampling_rate

    def say(self, text, desc, seed):
        """→ 16-bit mono PCM bytes"""
        import numpy as np
        torch = self.torch
        chunks = []
        for i, s in enumerate(sentences(text)):
            torch.manual_seed(seed)                       # same seed for every sentence → the same voice throughout
            d = self.desc_tok(desc, return_tensors='pt').to(self.device)
            p = self.tok(s, return_tensors='pt').to(self.device)
            with torch.no_grad():
                a = self.model.generate(input_ids=d.input_ids, attention_mask=d.attention_mask,
                                        prompt_input_ids=p.input_ids, prompt_attention_mask=p.attention_mask)
            a = a.cpu().float().numpy().squeeze()
            a = a / max(1e-6, float(np.abs(a).max())) * 0.9
            pcm = (a * 32767).astype('<i2').tobytes()
            chunks.append(polish(pcm, self.rate, pad_in=0.03, pad_out=0.08))
            if i:
                chunks.insert(-1, b'\0\0' * int(self.rate * 0.28))
        return b''.join(chunks)


class MeloVoice:
    """MeloTTS (MIT): one Indian-English speaker, no voice description. STYLE sets how natural it sounds (the defaults are flat and
    robotic): more prosody (sdp_ratio), more variation in pitch (noise_scale) and timing (noise_scale_w), a touch slower."""
    STYLE = {'flat': dict(sdp_ratio=.2, noise_scale=.6, noise_scale_w=.8, speed=1.0),
             'expressive': dict(sdp_ratio=.6, noise_scale=.8, noise_scale_w=1.0, speed=.95),
             'max': dict(sdp_ratio=.9, noise_scale=.9, noise_scale_w=1.15, speed=.92)}
    style = 'expressive'

    def __init__(self, device, speaker):
        try:
            import torch
            from melo.api import TTS
        except ImportError as e:
            die('missing package (%s). Run: source ~/melo/bin/activate' % e.name)
        self.torch = torch
        print('Loading MeloTTS English on %s \u2026' % ('cpu' if device == 'auto' else device))
        self.model = TTS(language='EN', device='cpu' if device == 'auto' else device)
        self.spk = self.model.hps.data.spk2id
        if speaker not in self.spk:
            die('MeloTTS has no speaker %r (choose from %s)' % (speaker, ', '.join(self.spk)))
        self.speaker = speaker
        self.rate = self.model.hps.data.sampling_rate

    def say(self, text, desc, seed, speaker=None):
        import numpy as np
        chunks = []
        for i, s in enumerate(sentences(text)):
            self.torch.manual_seed(seed)
            a = self.model.tts_to_file(s, self.spk[speaker or self.speaker], None, quiet=True, **self.STYLE[self.style])
            a = np.asarray(a, dtype='float32').squeeze()
            a = a / max(1e-6, float(np.abs(a).max())) * 0.9
            chunks.append(polish((a * 32767).astype('<i2').tobytes(), self.rate, pad_in=0.03, pad_out=0.08))
            if i:
                chunks.insert(-1, b'\0\0' * int(self.rate * 0.28))
        return b''.join(chunks)


def save_wav(path, pcm, rate):
    import wave
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with wave.open(path, 'wb') as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(rate)
        w.writeframes(pcm)


def install(lid, take, d=TAKES):
    """copy takes/<id>_<take>.wav into the game as assets/vo/<id>.ogg"""
    import wave
    src = os.path.join(d, '%s_%d.wav' % (lid, take))
    if not os.path.exists(src):
        die('no take %s' % os.path.relpath(src))
    with wave.open(src) as w:
        pcm, rate = w.readframes(w.getnframes()), w.getframerate()
    return save_take(lid, pcm, rate, 'ogg' if FFMPEG else 'wav')


def main():
    ap = argparse.ArgumentParser(description='Generate Sonar Defence voice lines with Indic Parler-TTS (open source).')
    ap.add_argument('--audition', action='store_true', help='say line h1 in several voices (takes/audition/) to choose a speaker')
    ap.add_argument('--speaker', default='Meera', help='Indic Parler speaker for Commander Meera [Meera]')
    ap.add_argument('--only', help='comma-separated line ids, e.g. h1,l2a')
    ap.add_argument('--takes', type=int, default=3, help='takes per line [3]')
    ap.add_argument('--force', action='store_true', help='remake lines that already have a recording')
    ap.add_argument('--pick', help='use another take in the game, e.g. --pick h1=2,l2a=3 (no generation)')
    ap.add_argument('--model', choices=sorted(MODELS), default='indic', help='indic (Indian English, gated), large (open Parler) or melo (MeloTTS EN_INDIA) [indic]')
    ap.add_argument('--keep-only', action='store_true', help='make the takes but leave the game\'s recordings alone')
    ap.add_argument('--style', choices=['flat', 'expressive', 'max'], default='expressive', help='MeloTTS delivery [expressive]')
    ap.add_argument('--device', default='auto', help='mps, cpu or auto [auto]')
    args = ap.parse_args()

    lines = load_lines()
    ids = {l['id'] for l in lines}
    global MODEL
    MODEL, audition, accent = MODELS[args.model]
    if args.model == 'melo' and args.speaker == 'Meera':
        args.speaker = 'EN_INDIA'
    takes_dir = TAKES if args.model == 'indic' else os.path.join(TAKES, args.model)
    if args.model == 'melo' and not args.audition:
        takes_dir = os.path.join(takes_dir, args.speaker)      # takes/melo/EN_INDIA/h1_1.wav …

    if args.pick:
        for item in args.pick.split(','):
            lid, _, k = item.strip().partition('=')
            if lid not in ids or not k.isdigit():
                die('bad --pick item %r (use id=take, e.g. h1=2)' % item)
            print('  %s ← take %s  (%s)' % (lid, k, os.path.relpath(install(lid, int(k), takes_dir))))
        write_manifest(lines)
        return

    todo = lines
    if args.only:
        want = [x.strip() for x in args.only.split(',') if x.strip()]
        if set(want) - ids:
            die('unknown line id(s): %s' % ', '.join(sorted(set(want) - ids)))
        todo = [l for l in lines if l['id'] in want]
    if not args.audition and not args.force and not args.keep_only:
        todo = [l for l in todo if not vo_file(l['id'])]
        if not todo:
            print('Every line is already recorded. Use --force to remake them, or --pick to swap takes.')
            return

    melo = args.model == 'melo'
    MeloVoice.style = args.style
    v = MeloVoice(args.device, args.speaker) if melo else Voice(args.device)
    t0 = time.time()

    if args.audition:
        h1 = next(l for l in lines if l['id'] == 'h1')
        for sp in audition:
            path = os.path.join(takes_dir, 'audition', '%s.wav' % sp)
            desc = DESC.format(sp=sp, tone=TONE['h1'], accent=accent)
            save_wav(path, v.say(tts_text(h1['spoken']), desc, 1, sp) if melo else v.say(tts_text(h1['spoken']), desc, seed=1), v.rate)
            print('  ✓ %s' % os.path.relpath(path))
        print('\nListen:  afplay %s/<name>.wav\nThen:    python tools/make_voices_parler.py --model %s --speaker <name>'
              % (os.path.relpath(os.path.join(takes_dir, 'audition')), args.model))
        return

    print('Speaker %s · %d lines · %d takes each' % (args.speaker, len(todo), args.takes))
    for i, l in enumerate(todo, 1):
        desc = DESC.format(sp=args.speaker, tone=TONE.get(l['id'], DEFAULT_TONE), accent=accent)
        print('[%d/%d] %-4s %s' % (i, len(todo), l['id'], l['spoken'][:70]))
        for k in range(1, args.takes + 1):
            pcm = v.say(tts_text(l['spoken']), desc, seed=k)
            path = os.path.join(takes_dir, '%s_%d.wav' % (l['id'], k))
            save_wav(path, pcm, v.rate)
            print('    take %d  %.1fs  %s' % (k, len(pcm) / 2.0 / v.rate, os.path.relpath(path)))
        if not args.keep_only:
            install(l['id'], 1, takes_dir)
            write_manifest(lines)
    print('\nDone in %.0fs. Take 1 of each line is in the game; listen to the others with afplay and swap with\n'
          '  python tools/make_voices_parler.py --model %s --speaker %s --pick <id>=<take>' % (time.time() - t0, args.model, args.speaker))


if __name__ == '__main__':
    main()
