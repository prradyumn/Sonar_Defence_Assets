#!/usr/bin/env python3
"""make_voices_chatter: record every spoken line of Sonar Defence with Chatterbox (Resemble AI, MIT license): natural delivery in
the voice of a reference clip (our own MeloTTS EN_INDIA Meera line, so the accent stays Indian English).

    ~/chatter/bin/python tools/make_voices_chatter.py              # every line not made with Chatterbox yet (Meera first)
    ~/chatter/bin/python tools/make_voices_chatter.py --only h1,l2a --force

Each take is checked word by word with Whisper; a take that differs is made again (up to --tries), and the first clean one goes
into the game at once (assets/vo/<id>.ogg + vo_manifest.js). Takes: assets/vo/takes/chatter/<id>_<n>.wav; the list of lines
already done is assets/vo/takes/chatter/done.json. Slow on a laptop (~25x real time on the Apple GPU): run it in the background.
"""
import argparse
import json
import os
import sys
import time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from make_voices import FFMPEG, VO_DIR, load_lines, polish, save_take, tts_text, word_diff, write_manifest  # noqa: E402

TAKES = os.path.join(VO_DIR, 'takes', 'chatter')
DONE = os.path.join(TAKES, 'done.json')
REF = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'ref_meera_en_india.wav')   # the voice to speak in (MeloTTS EN_INDIA, expressive)


def main():
    ap = argparse.ArgumentParser(description='Generate Sonar Defence voice lines with Chatterbox.')
    ap.add_argument('--only', help='comma-separated line ids')
    ap.add_argument('--force', action='store_true', help='remake lines already made with Chatterbox')
    ap.add_argument('--tries', type=int, default=3, help='takes per line until the words match [3]')
    ap.add_argument('--exaggeration', type=float, default=.6, help='emotion 0.25-1 [0.6]')
    ap.add_argument('--seed0', type=int, default=0, help='first seed offset (to try new takes) [0]')
    ap.add_argument('--cfg', type=float, default=.4, help='pace / adherence to the reference, lower = slower [0.4]')
    args = ap.parse_args()

    import numpy as np
    import torch
    from chatterbox.tts import ChatterboxTTS
    from transformers import pipeline

    lines = load_lines()
    todo = sorted(lines, key=lambda l: l['who'] != 'meera')              # Meera's lines first
    if args.only:
        want = {x.strip() for x in args.only.split(',')}
        todo = [l for l in todo if l['id'] in want]
    os.makedirs(TAKES, exist_ok=True)
    done = json.load(open(DONE)) if os.path.exists(DONE) else {}
    if not args.force:
        todo = [l for l in todo if l['id'] not in done]
    if not os.path.exists(REF):
        sys.exit('missing reference clip %s' % REF)

    dev = 'mps' if torch.backends.mps.is_available() else 'cpu'
    print('Loading Chatterbox on %s and Whisper …' % dev, flush=True)
    tts = ChatterboxTTS.from_pretrained(device=dev)
    asr = pipeline('automatic-speech-recognition', model='openai/whisper-small.en', device='cpu')
    print('%d lines to make' % len(todo), flush=True)
    t0 = time.time()
    for i, l in enumerate(todo, 1):
        best = None
        for k in range(1, args.tries + 1):
            torch.manual_seed(k + args.seed0)
            w = tts.generate(tts_text(l['spoken']), audio_prompt_path=REF, exaggeration=args.exaggeration, cfg_weight=args.cfg)
            a = w.squeeze().cpu().numpy().astype('float32')
            a = a / max(1e-6, float(np.abs(a).max())) * .9
            pcm = polish((a * 32767).astype('<i2').tobytes(), tts.sr)
            import wave
            path = os.path.join(TAKES, '%s_%d.wav' % (l['id'], k))
            with wave.open(path, 'wb') as f:
                f.setnchannels(1); f.setsampwidth(2); f.setframerate(tts.sr); f.writeframes(pcm)
            heard = asr({'raw': np.frombuffer(pcm, '<i2').astype('float32') / 32768, 'sampling_rate': tts.sr})['text'].strip()
            diff = word_diff(l['spoken'], heard)
            if not diff:
                best = (k, pcm, ''); break
            print('    take %d differs: %s' % (k, diff), flush=True)
            if best is None:
                best = (k, pcm, diff)
        k, pcm, diff = best
        if diff:
            print('[%d/%d] %-10s ✗ no clean take (kept the MeloTTS recording): %s' % (i, len(todo), l['id'], diff), flush=True)
            continue
        save_take(l['id'], pcm, tts.sr, 'ogg' if FFMPEG else 'wav')
        done[l['id']] = k
        json.dump(done, open(DONE, 'w'), indent=0)
        write_manifest(lines)
        el = time.time() - t0
        print('[%d/%d] %-10s ✓ take %d  %.1fs  (%.0f min so far, ~%.0f min left)' % (
            i, len(todo), l['id'], k, len(pcm) / 2 / tts.sr, el / 60, el / i * (len(todo) - i) / 60), flush=True)
    print('Done: %d of %d lines are Chatterbox now.' % (len(done), len(lines)), flush=True)


if __name__ == '__main__':
    main()
