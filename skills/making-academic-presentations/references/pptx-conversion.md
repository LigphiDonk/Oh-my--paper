# Converting PPTX to Images

Take a `.pptx` file, convert every slide to a high-quality PNG image.

## Required Tools
- **LibreOffice** (`soffice`) — converts PPTX to PDF
- **pdftoppm** (from poppler) — converts PDF pages to PNG images

## Algorithm

1. **Resolve the input file.** Accept an absolute or relative path to a `.pptx` file.

2. **Determine the output folder.** Default: `<DIR>/<BASENAME>_slides/`

3. **Convert PPTX to PDF.**
   ```bash
   soffice --headless --convert-to pdf --outdir "<OUTPUT_FOLDER>" "<PPTX_PATH>"
   ```

4. **Convert PDF to PNG images (one per slide).**
   ```bash
   pdftoppm -png -r 300 "<OUTPUT_FOLDER>/<BASENAME>.pdf" "<OUTPUT_FOLDER>/slide"
   ```
   Output files: `slide-01.png`, `slide-02.png`, etc.

5. **Clean up the intermediate PDF.**
   ```bash
   rm "<OUTPUT_FOLDER>/<BASENAME>.pdf"
   ```

## Options

| Option | Default | Notes |
|--------|---------|-------|
| DPI / resolution | 300 | Pass as `-r <DPI>` to pdftoppm |
| Output format | PNG | pdftoppm also supports `-jpeg` or `-tiff` |
| Output folder | `<BASENAME>_slides/` next to source | Any writable path |
| Keep PDF | No | Skip the cleanup step if requested |

## Failure Modes & Recovery

- **LibreOffice not found** → `brew install --cask libreoffice`
- **pdftoppm not found** → `brew install poppler`
- **LibreOffice conversion fails** → Close any running instance (`pkill -f soffice`) and retry
- **Zero images produced** → Check PDF was created; use `pdfinfo` to verify page count
- **File path contains spaces** → Always double-quote all paths in shell commands

## Limits
- Only handles `.pptx` files (not `.ppt`, `.odp`, or `.key`)
- Does not extract speaker notes or animations — images only
