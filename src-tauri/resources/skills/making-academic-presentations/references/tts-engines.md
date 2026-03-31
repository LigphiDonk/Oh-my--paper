# TTS Engines for Presentation Narration

Two free engines available, plus a premium option. Pick based on user needs.

## Engine Comparison

| | **edge-tts** | **Kokoro** | **ElevenLabs** |
|---|---|---|---|
| Cost | Free, unlimited | Free, unlimited | 10k chars free/mo |
| Network | Requires internet | Fully offline (local CPU) | Requires internet |
| Quality | Very good (Microsoft Neural) | Very good (82M param model) | Premium |
| Speed | ~6s/slide (cloud latency) | ~1.5s/slide (M-series Mac) | ~3s/slide (cloud) |
| Format | MP3 | WAV (convert to MP3 with ffmpeg) | MP3 |
| Voices | 100+ (multi-language) | 67 built-in (English-focused) | Custom + pre-made |
| Install | `pip install edge-tts` | `pip install kokoro soundfile` | `pip install elevenlabs` |

**Default recommendation**: edge-tts for quick cloud generation, Kokoro for offline/privacy-sensitive use, ElevenLabs only when explicitly requested.

## Edge TTS

### Voices (English)

| Voice ID | Gender | Style |
|----------|--------|-------|
| `en-US-AndrewNeural` | Male | Clear presenter (recommended for talks) |
| `en-US-AriaNeural` | Female | Conversational |
| `en-US-GuyNeural` | Male | Warm narrator |
| `en-US-JennyNeural` | Female | Professional |
| `en-GB-RyanNeural` | Male | British |
| `en-GB-SoniaNeural` | Female | British |

List all voices: `edge-tts --list-voices`

### Single Text

```python
import edge_tts, asyncio

async def speak(text, output="output.mp3", voice="en-US-AndrewNeural"):
    comm = edge_tts.Communicate(text, voice)
    await comm.save(output)

asyncio.run(speak("Hello world"))
```

### Batch (slide-by-slide)

```python
import edge_tts, asyncio, os

VOICE = "en-US-AndrewNeural"

async def batch_tts(slides, out_dir):
    """slides: list of (filename_stem, text) tuples"""
    os.makedirs(out_dir, exist_ok=True)
    for i, (name, text) in enumerate(slides, 1):
        out = os.path.join(out_dir, f"{name}.mp3")
        comm = edge_tts.Communicate(text, VOICE)
        await comm.save(out)
        sz = os.path.getsize(out) / 1024
        print(f"  [{i:02d}/{len(slides)}] {name:30s}  {sz:6.1f} KB")

asyncio.run(batch_tts(slides, "output/edge-tts"))
```

### With Subtitles (SRT/VTT)

```python
import edge_tts, asyncio

async def speak_with_subs(text, audio_out, sub_out, voice="en-US-AndrewNeural"):
    comm = edge_tts.Communicate(text, voice)
    subs = edge_tts.SubMaker()
    with open(audio_out, "wb") as f:
        async for chunk in comm.stream():
            if chunk["type"] == "audio":
                f.write(chunk["data"])
            elif chunk["type"] == "WordBoundary":
                subs.feed(chunk)
    with open(sub_out, "w") as f:
        f.write(subs.generate_subs())

asyncio.run(speak_with_subs("Hello world", "out.mp3", "out.vtt"))
```

## Kokoro TTS

### Voices

| Voice ID | Gender | Style |
|----------|--------|-------|
| `af_heart` | Female | Warm, natural (default) |
| `af_bella` | Female | Clear, professional |
| `am_adam` | Male | Neutral presenter |
| `am_michael` | Male | Authoritative |
| `bf_emma` | Female | British |
| `bm_george` | Male | British |

Full list: `python3 -c "from kokoro import KPipeline; p = KPipeline(lang_code='a'); print(p.voices)"`

### Single Text

```python
from kokoro import KPipeline
import soundfile as sf
import numpy as np

pipeline = KPipeline(lang_code='a', repo_id='hexgrad/Kokoro-82M')

samples = None
for result in pipeline("Hello world", voice='af_heart'):
    if samples is None:
        samples = result.audio
    else:
        samples = np.concatenate([samples, result.audio])

sf.write("output.wav", samples, 24000)
```

### Convert Kokoro WAV to MP3

```bash
# Single file
ffmpeg -y -i input.wav -codec:a libmp3lame -qscale:a 2 output.mp3

# Batch (all WAVs in a directory)
for f in output/kokoro/*.wav; do
  ffmpeg -y -i "$f" -codec:a libmp3lame -qscale:a 2 "${f%.wav}.mp3"
done
```

## ElevenLabs (Premium)

Requires `ELEVENLABS_API_KEY` environment variable.

```python
from elevenlabs import ElevenLabs
client = ElevenLabs()
audio = client.text_to_speech.convert(
    text="...", voice_id="JBFqnCBsd6RMkjVDRZzb",
    model_id="eleven_multilingual_v2",
    output_format="mp3_22050_32"
)
```

Run via: `uvx --from elevenlabs --with httpx python3 script.py`

Use `previous_text`/`next_text` for cross-slide continuity.

**Voices**: George (JBFqnCBsd6RMkjVDRZzb), Daniel (onwK4e9ZLuTAKqWW03F9), Sarah (EXAVITQu4vr4xnSDxMaL), Charlotte (XB0fDUnXU5powFXDhCwa)

## Chunking Strategy

When given a document (markdown, script, etc.), chunk by:

1. **Slides/sections**: Split on `## SLIDE` or `---` separators
2. **Paragraphs**: Split on double newlines for long-form text
3. **Sentences**: For very long paragraphs (>500 chars), split at sentence boundaries

Extract only the spoken text — strip markdown formatting, stage directions, timing cues, etc.

Name output files with zero-padded indices: `slide_01_title.mp3`, `slide_02_hook.mp3`, etc.

## Gotchas

- **edge-tts needs internet** — will fail silently or timeout if offline
- **Kokoro first run downloads ~350MB model** from HuggingFace
- **Kokoro needs em-dashes replaced** — use `---` to `, ` or ` - ` to avoid pronunciation glitches
- **WAV files are ~7x larger than MP3** — convert with ffmpeg for storage/sharing
- **Long text (>2000 chars)**: edge-tts handles natively; Kokoro auto-chunks internally
