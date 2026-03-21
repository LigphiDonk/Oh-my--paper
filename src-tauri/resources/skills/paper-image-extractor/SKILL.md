---
id: paper-image-extractor
name: paper-image-extractor
version: 1.0.0
description: |-
  Extract figures from papers — prioritizes arXiv source package for high-quality images
stages: ["publication"]
tools: ["read_file", "search_project", "write_file", "run_terminal"]
summary: |-
  Extract figures from papers — prioritizes arXiv source package for high-quality images
primaryIntent: research
intents: ["research"]
capabilities: ["multimodal"]
domains: ["cs-ai", "vision"]
keywords: ["paper-image-extractor", "image extraction", "multimodal", "cs-ai", "vision", "paper", "image", "extractor", "extract", "figures", "from", "papers"]
source: builtin
status: verified
upstream:
  repo: dr-claw
  path: skills/paper-image-extractor
  revision: 8322dc4ef575affaa374aa7922c0a0971c6db7d7
resourceFlags:
  hasReferences: false
  hasScripts: true
  hasTemplates: false
  hasAssets: false
  referenceCount: 0
  scriptCount: 1
  templateCount: 0
  assetCount: 0
  optionalScripts: true
---

# paper-image-extractor

## Canonical Summary

Extract figures from papers — prioritizes arXiv source package for high-quality images

## Trigger Rules

Use this skill when the user request matches its research workflow scope. Prefer the bundled resources instead of recreating templates or reference material. Keep outputs traceable to project files, citations, scripts, or upstream evidence.

## Resource Use Rules

- Treat `scripts/` as optional helpers. Run them only when their dependencies are available, keep outputs in the project workspace, and explain a manual fallback if execution is blocked.

## Execution Contract

- Resolve every relative path from this skill directory first.
- Prefer inspection before mutation when invoking bundled scripts.
- If a required runtime, CLI, credential, or API is unavailable, explain the blocker and continue with the best manual fallback instead of silently skipping the step.
- Do not write generated artifacts back into the skill directory; save them inside the active project workspace.

## Upstream Instructions

You are the Paper Image Extractor for Dr. Claw.

# Goal
Extract all figures from a paper, prioritizing arXiv source packages for high-quality original images over PDF extraction.

# Extraction Strategy (3-tier priority)

## Priority 1: arXiv Source Package (Best)
1. Download source: `https://arxiv.org/e-print/[PAPER_ID]`
2. Extract and look for `pics/`, `figures/`, `fig/`, `images/`, `img/` directories
3. Copy image files to output directory
4. Convert PDF figures to PNG

## Priority 2: PDF Figure Extraction (Fallback)
```bash
python scripts/extract_images.py "[PAPER_ID]" "[OUTPUT_DIR]" "[INDEX_PATH]"
```

## Priority 3: Direct PDF Image Extraction (Last Resort)
Extract embedded image objects from the compiled PDF using PyMuPDF.

# Output
- Images saved to specified output directory
- `index.md` generated with image metadata and source labels (arxiv-source, pdf-figure, pdf-extraction)

# Scripts
- `scripts/extract_images.py` — Main extraction script with 3-tier strategy

# Dependencies
- Python 3.8+, PyMuPDF (fitz), requests
- Network access (arXiv)

---
> Based on [evil-read-arxiv](https://github.com/evil-read-arxiv) — an automated paper reading workflow. MIT License.
