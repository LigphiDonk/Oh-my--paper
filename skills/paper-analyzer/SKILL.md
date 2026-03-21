---
id: paper-analyzer
name: paper-analyzer
version: 1.0.0
description: |-
  Deep analysis of a single paper — generate structured notes with figures, evaluation, and knowledge graph updates
stages: ["survey", "publication"]
tools: ["read_file", "search_project", "write_file", "run_terminal"]
summary: |-
  Deep analysis of a single paper — generate structured notes with figures, evaluation, and knowledge graph updates
primaryIntent: research
intents: ["research"]
capabilities: ["evaluation-benchmarking"]
domains: ["cs-ai"]
keywords: ["paper-analyzer", "paper analysis", "evaluation-benchmarking", "cs-ai", "paper", "analyzer", "deep", "analysis", "single", "generate", "structured", "notes"]
source: builtin
status: verified
upstream:
  repo: dr-claw
  path: skills/paper-analyzer
  revision: 8322dc4ef575affaa374aa7922c0a0971c6db7d7
resourceFlags:
  hasReferences: false
  hasScripts: true
  hasTemplates: false
  hasAssets: false
  referenceCount: 0
  scriptCount: 2
  templateCount: 0
  assetCount: 0
  optionalScripts: true
---

# paper-analyzer

## Canonical Summary

Deep analysis of a single paper — generate structured notes with figures, evaluation, and knowledge graph updates

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

You are the Paper Analyzer for Dr. Claw.

# Goal
Perform deep analysis of a specific paper, generating comprehensive notes including abstract translation, methodology breakdown, experiment evaluation, strengths/limitations analysis, and related work comparison.

# Workflow

## Step 1: Identify Paper
Accept input: arXiv ID (e.g., "2402.12345"), full ID ("arXiv:2402.12345"), paper title, or file path.

## Step 2: Fetch Paper Content
```bash
curl -L "https://arxiv.org/pdf/[PAPER_ID]" -o /tmp/paper_analysis/[PAPER_ID].pdf
curl -L "https://arxiv.org/e-print/[PAPER_ID]" -o /tmp/paper_analysis/[PAPER_ID].tar.gz
curl -s "https://arxiv.org/abs/[PAPER_ID]" > /tmp/paper_analysis/arxiv_page.html
```

## Step 3: Deep Analysis
Analyze: abstract, methodology, experiments, results, contributions, limitations, future work, related papers.

## Step 4: Generate Note
```bash
python scripts/generate_note.py --paper-id "$PAPER_ID" --title "$TITLE" --authors "$AUTHORS" --domain "$DOMAIN"
```

## Step 5: Update Knowledge Graph
```bash
python scripts/update_graph.py --paper-id "$PAPER_ID" --title "$TITLE" --domain "$DOMAIN" --score $SCORE
```

# Scripts
- `scripts/generate_note.py` — Generate structured note template
- `scripts/update_graph.py` — Update paper relationship graph

# Note Structure
The generated note includes: core info, abstract (EN/CN), research background, method overview with architecture figures, experiment results with tables, deep analysis, related paper comparison, tech roadmap positioning, future work, and comprehensive evaluation (0-10 scoring).

# Dependencies
- Python 3.8+, PyYAML, requests
- Network access (arXiv)

---
> Based on [evil-read-arxiv](https://github.com/evil-read-arxiv) — an automated paper reading workflow. MIT License.
