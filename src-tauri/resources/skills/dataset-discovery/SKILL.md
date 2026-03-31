---
id: dataset-discovery
name: dataset-discovery
version: 1.0.0
description: |-
  Multi-source ML dataset discovery.
stages: ["survey", "ideation", "experiment"]
tools: ["read_file", "search_project", "write_file", "run_terminal"]
summary: |-
  Multi-source ML dataset discovery. Search HuggingFace Hub, OpenML, GitHub, and paper cross-references for datasets relevant to a research task. Use when asked to "find datasets for", "search ML datasets", "what datasets exist for", or "dis...
primaryIntent: data
intents: ["data", "research"]
capabilities: ["search-retrieval", "data-processing"]
domains: ["data-engineering"]
keywords: ["dataset-discovery", "resource prep", "search-retrieval", "data-processing", "data-engineering", "dataset", "discovery", "multi", "source", "ml", "search", "huggingface"]
source: builtin
status: verified
upstream:
  repo: dr-claw
  path: skills/dataset-discovery
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

# dataset-discovery

## Canonical Summary

Multi-source ML dataset discovery. Search HuggingFace Hub, OpenML, GitHub, and paper cross-references for datasets relevant to a research task. Use when asked to "find datasets for", "search ML datasets", "what datasets exist for", or "dis...

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

# Dataset Discovery Skill

## Overview

Search multiple ML dataset sources (HuggingFace Hub, OpenML, GitHub, Semantic Scholar) and return a ranked, deduplicated list of relevant datasets.

## Agent Workflow

### Phase 1: SCOPE

Clarify the user's needs before searching:
- **Research task**: What problem or domain? (e.g., "sentiment analysis", "medical image segmentation")
- **Modality**: image / text / tabular / audio / any
- **Size preference**: small (< 10K rows), medium (10K–1M), large (> 1M), any
- **License preference**: permissive (MIT/Apache/CC-BY), any, or specific

### Phase 2: SEARCH

Run the search script with the user's query:

```bash
python3 scripts/search_ml_datasets.py search --query "<query>" --sources huggingface,openml,github,papers --max 30
```

Options:
- `--sources`: Comma-separated list from `huggingface`, `openml`, `github`, `papers`. Default: all four.
- `--max`: Maximum results to return after dedup + ranking. Default: 30.
- `--modality`: Filter by modality (`image`, `text`, `tabular`, `audio`).
- `--workspace`: Output directory. Default: `./datasets/discovery/`

Optionally also call HF MCP tool `hub_repo_search` with `repo_types: ["dataset"]` for semantic search to supplement results.

### Phase 3: PRESENT

Show results as a markdown table:

| Name | Source | Downloads | Size | License | Tags | URL |
|------|--------|-----------|------|---------|------|-----|

Sort by relevance score (highest first).

### Phase 4: DETAIL

When the user wants more info on a specific dataset:

```bash
python3 scripts/search_ml_datasets.py detail --dataset-id "huggingface:stanfordnlp/imdb" --workspace ./datasets/discovery/
```

Writes `metadata.json` and `README.md` to `{workspace}/datasets/{source}_{slug}/`.

### Phase 5: PULL

When the user wants to preview data:

```bash
python3 scripts/search_ml_datasets.py pull --dataset-id "huggingface:stanfordnlp/imdb" --sample-rows 20 --workspace ./datasets/discovery/
```

Writes `sample.jsonl` to `{workspace}/datasets/{source}_{slug}/`.

For full dataset download, confirm with the user first, then use `huggingface-cli download` or equivalent.

## Workspace Layout

```
{workspace}/                         # default: ./datasets/discovery/
  search-{YYYY-MM-DD}.json           # search results log
  datasets/
    {source}_{slug}/
      metadata.json                  # detailed metadata
      README.md                      # human-readable summary
      sample.jsonl                   # sample rows
```

## Dependencies

- Python 3.8+
- `requests` (stdlib-adjacent, universally available)
- `gh` CLI (for GitHub source only)
- No other packages required
