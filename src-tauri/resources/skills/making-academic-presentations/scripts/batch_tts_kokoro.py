#!/usr/bin/env python3
"""Batch TTS using Kokoro (offline).

Usage: python batch_tts_kokoro.py <scripts_dir> <output_dir> [voice]

Reads all .txt files from scripts_dir (sorted by name),
generates one WAV per file in output_dir.

Default voice: af_heart
Install: pip install kokoro soundfile
Note: First run downloads ~350MB model from HuggingFace.
"""
from kokoro import KPipeline
import soundfile as sf
import numpy as np
import os
import sys
import glob


def main():
    if len(sys.argv) < 3:
        print(__doc__)
        sys.exit(1)

    scripts_dir = sys.argv[1]
    out_dir = sys.argv[2]
    voice = sys.argv[3] if len(sys.argv) > 3 else "af_heart"

    pipeline = KPipeline(lang_code='a', repo_id='hexgrad/Kokoro-82M')
    os.makedirs(out_dir, exist_ok=True)
    files = sorted(glob.glob(os.path.join(scripts_dir, "*.txt")))

    if not files:
        print(f"No .txt files found in {scripts_dir}")
        sys.exit(1)

    print(f"Generating {len(files)} audio files with voice={voice}")
    for i, f in enumerate(files, 1):
        text = open(f).read().strip()
        if not text:
            print(f"  [{i:02d}/{len(files)}] {os.path.basename(f):30s}  SKIPPED (empty)")
            continue
        name = os.path.splitext(os.path.basename(f))[0]
        out = os.path.join(out_dir, f"{name}.wav")
        samples = None
        for r in pipeline(text, voice=voice):
            samples = r.audio if samples is None else np.concatenate([samples, r.audio])
        if samples is not None:
            sf.write(out, samples, 24000)
            dur = len(samples) / 24000
            sz = os.path.getsize(out) / 1024
            print(f"  [{i:02d}/{len(files)}] {name:30s}  {sz:6.1f} KB  {dur:.1f}s")

    print(f"\nDone. Output: {out_dir}")
    print("Tip: Convert WAV to MP3 with: for f in output/*.wav; do ffmpeg -y -i \"$f\" -codec:a libmp3lame -qscale:a 2 \"${f%.wav}.mp3\"; done")


if __name__ == "__main__":
    main()
