---
name: literature-pdf-ocr-library
description: Search traceable academic papers, download legally accessible PDFs from arXiv and open-access sources, convert PDFs or page images to Markdown with a PaddleOCR layout-parsing API (or local pdfminer fallback), and organize the results into an AI-readable literature library. Use when Claude Code needs to build a paper corpus, batch OCR PDFs to Markdown, ingest real literature into a knowledge base, fetch arXiv or Hugging Face paper leads, or turn a directory of papers into structured Markdown plus metadata.
triggers:
  - /literature-library
  - /paper-library
  - build paper corpus
  - build literature library
  - ingest papers
  - batch ocr papers
  - download arxiv papers
  - search and download papers
  - paper corpus
  - literature corpus
---

# Literature PDF OCR Library

## Overview

Use this skill to build a real, traceable literature corpus instead of fabricating references or scraping arbitrary publisher pages. The default workflow is: narrow the topic, search official or stable APIs, download only legally accessible PDFs, run OCR or layout parsing, then emit a clean Markdown library with machine-readable metadata.

---

## Canonical Directory Layout

In **Oh My Paper projects**, the corpus always lives under **`.pipeline/literature/<corpus-name>/`**.  
In standalone projects, use `research/literature/<corpus-name>/`.  
Never dump papers into the root or a flat directory without a corpus name.

```text
.pipeline/
  literature/
    <corpus-name>/              ← one folder per topic/session, e.g. "humanoid-locomotion"
      search_results.json       ← raw search/ID-lookup results
      library_index.json        ← consolidated index for the whole corpus
      library_index.jsonl
      papers/
        <arxiv-id>-<title-slug>/   ← one folder per paper
          metadata.json
          paper.pdf
          ocr/                  ← OCR output lives here, next to the PDF
            paper/
              doc_0.md          ← main OCR markdown (PaddleOCR: multiple pages)
              manifest.json
            doc_0.md            ← pdfminer fallback: single flat file
```

**Rules:**
- `--out-dir` always points to `.pipeline/literature/<corpus-name>/` — never to `.pipeline/literature/` directly.
- OCR output lives inside the paper's own folder (`papers/<slug>/ocr/`), not in a top-level `ocr/` directory.
- After OCR, record each paper's `ocr/` path in `literature_bank.md` so agents can read the actual content.

---

## Commands

```bash
# Download by arXiv IDs (recommended when IDs are known from web search)
python .claude/skills/literature-pdf-ocr-library/scripts/search_and_download_papers.py \
  --arxiv-ids 2502.13817 2501.14459 \
  --out-dir .pipeline/literature/my-corpus \
  --download-pdfs

# Download by query
python .claude/skills/literature-pdf-ocr-library/scripts/search_and_download_papers.py \
  --query "humanoid locomotion reinforcement learning" \
  --out-dir .pipeline/literature/my-corpus \
  --limit 20 --sources arxiv semanticscholar openalex hf_daily \
  --download-pdfs

# OCR: PaddleOCR API (best quality)
export PADDLEOCR_TOKEN="<token>"  # ask user, never hardcode
python .claude/skills/literature-pdf-ocr-library/scripts/paddleocr_layout_to_markdown.py \
  .pipeline/literature/my-corpus/papers/*/paper.pdf \
  --output-dir .pipeline/literature/my-corpus/papers \
  --skip-existing

# OCR: pdfminer fallback (text-only, no layout — confirm with user first)
python .claude/skills/literature-pdf-ocr-library/scripts/paddleocr_layout_to_markdown.py \
  .pipeline/literature/my-corpus/papers/*/paper.pdf \
  --output-dir .pipeline/literature/my-corpus/papers \
  --fallback-pdfminer

# Build index
python .claude/skills/literature-pdf-ocr-library/scripts/build_library_index.py \
  --library-root .pipeline/literature/my-corpus
```

## Resources

- Read [source-strategy.md](./references/source-strategy.md) when you need source-specific behavior, file layout conventions, or legal constraints.
- Use `scripts/search_and_download_papers.py` for traceable search and PDF download (supports `--query` and `--arxiv-ids`).
- Use `scripts/paddleocr_layout_to_markdown.py` for single-file or batch OCR conversion (supports `--fallback-pdfminer`).
- Use `scripts/build_library_index.py` to generate `library_index.json` and `library_index.jsonl`.
- Use `scripts/ingest_literature_library.py` when the user wants the full ingestion workflow in one go.
