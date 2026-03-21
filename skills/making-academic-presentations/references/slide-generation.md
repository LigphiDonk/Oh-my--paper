# Slide Generation with Nanobanana

## Models

| Backend | Model | Env var override |
|---------|-------|------------------|
| Nanobanana (default) | `gemini-3.1-flash-image-preview` | `NANOBANANA_MODEL` |
| Nanobanana (pro) | `gemini-3-pro-image-preview` | `NANOBANANA_MODEL` |

To use Pro model: `export NANOBANANA_MODEL=gemini-3-pro-image-preview`

## Prerequisites

- **Gemini CLI**: `gemini --version`
- **Nanobanana extension**: `gemini extensions install https://github.com/gemini-cli-extensions/nanobanana`
- **API key**: `GOOGLE_API_KEY` or `GEMINI_API_KEY` env var

## Commands

### Generate new image
```bash
gemini -p 'Use the generate_image tool to create: <prompt>'
# or inside Gemini CLI:
/generate "prompt" --count=1 --preview
/generate "prompt" --styles="minimalist" --count=3
```

### Edit existing image
```bash
/edit path/to/image.png "change the background to dark blue, add a title at top"
gemini -p '/edit path/to/image.png "instructions"'
```

### Other commands
- `/icon "prompt"` — app icons, favicons
- `/pattern "prompt"` — seamless patterns/textures
- `/story "prompt" --count=N` — sequential images with visual consistency
- `/diagram "prompt"` — technical diagrams, flowcharts
- `/restore path/to/old-photo.png` — enhance/repair photos

Output goes to `./nanobanana-output/` by default.

## Slide Deck Generation Strategy

**Core principle: prefer editing existing HQ assets over generating from scratch.** Paper figures, logos, and existing slides are high-quality content — wrap them into slide frames via `/edit` rather than regenerating.

### Priority order for each slide

1. **Has existing figure/image from paper** → `/edit` to wrap into slide frame
2. **Has existing slide from another version** → `/edit` to adapt
3. **Nothing exists** → generate from scratch with style preamble

### Title slide (Slide 1)

For paper demo videos, the title slide follows a standard academic style:
- Paper title (bold, prominent)
- Author list with affiliations (superscript numbers)
- University logos in a row
- One-line tagline/subtitle at bottom
- Clean white background, professional typography

### Content slides with paper figures (most common case)

Most content slides in paper videos should use the **existing HQ figures from the paper**. These figures are already publication-quality — don't regenerate them.

**Workflow:**
```
/edit path/to/paper-figure.png "Wrap this figure into a presentation slide. Add a white border/padding around the figure. Add slide title 'System Architecture' at the top in bold dark text. Add a thin blue (#2563EB) accent bar at the bottom with white text 'University Name'. Keep the original figure content exactly as-is, just frame it as a slide."
```

### Approach A: Style preamble (generate from scratch)

Only when no existing asset is available:

1. Create `deck-style.md` with shared visual spec:
```markdown
# Deck Style
- Canvas: 1920x1080, white background
- Accent: #2563EB blue, text: #1e293b dark slate
- Clean sans-serif, flat design, no gradients/shadows
- Bottom bar: blue accent with white affiliation text
```

2. Prepend style to every slide prompt:
```
[deck-style.md contents]
---
SLIDE N OF TOTAL:
Title: "..."
Content: [layout description]
```

### Approach B: Edit from base (recommended for consistency)

1. Generate or prepare slide 1
2. For slides 2+, `/edit` slide 1 to change content while preserving style:
```
/edit slide-1.png "Keep the exact same layout, colors, and footer. Change title to 'System Architecture'. Replace the content area with [new content description]"
```

### Which approach to use
- **Has paper figures** → `/edit` to wrap into slide frame (preferred)
- **Slides with similar structure** → Approach B (edit from base)
- **Very different layouts or no assets** → Approach A (style preamble from scratch)

## Failure Modes

| Failure | Recovery |
|---------|----------|
| No API key | `export GOOGLE_API_KEY="key"` (get from https://aistudio.google.com/app/apikey) |
| Nanobanana not installed | `gemini extensions install https://github.com/gemini-cli-extensions/nanobanana` |
| 429 rate limit | Wait and retry, or set `NANOBANANA_MODEL` to a different model |
| Style drift across slides | Switch to Approach B (edit from base) or use `/edit` on existing assets |
| Need higher quality | `export NANOBANANA_MODEL=gemini-3-pro-image-preview` |
| `/edit` distorts original figure | Use more explicit instructions: "Keep the original figure exactly as-is, only add framing" |
