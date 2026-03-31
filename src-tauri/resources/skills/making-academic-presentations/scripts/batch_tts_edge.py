#!/usr/bin/env python3
"""Batch TTS using edge-tts.

Usage: python batch_tts_edge.py <scripts_dir> <output_dir> [voice]

Reads all .txt files from scripts_dir (sorted by name),
generates one MP3 per file in output_dir.

Default voice: en-US-AndrewNeural
Install: pip install edge-tts
"""
import edge_tts
import asyncio
import os
import sys
import glob


async def main():
    if len(sys.argv) < 3:
        print(__doc__)
        sys.exit(1)

    scripts_dir = sys.argv[1]
    out_dir = sys.argv[2]
    voice = sys.argv[3] if len(sys.argv) > 3 else "en-US-AndrewNeural"

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
        out = os.path.join(out_dir, f"{name}.mp3")
        await edge_tts.Communicate(text, voice).save(out)
        sz = os.path.getsize(out) / 1024
        print(f"  [{i:02d}/{len(files)}] {name:30s}  {sz:6.1f} KB")

    print(f"\nDone. Output: {out_dir}")


if __name__ == "__main__":
    asyncio.run(main())
