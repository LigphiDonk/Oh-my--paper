---
id: paper-finder
name: paper-finder
version: 1.0.0
description: |-
  Search existing paper notes by title, author, keyword, or research domain
stages: ["survey"]
tools: ["read_file", "search_project", "write_file"]
summary: |-
  Search existing paper notes by title, author, keyword, or research domain
primaryIntent: research
intents: ["research"]
capabilities: ["search-retrieval"]
domains: ["cs-ai"]
keywords: ["paper-finder", "paper search", "search-retrieval", "cs-ai", "paper", "finder", "search", "existing", "notes", "by", "title", "author"]
source: builtin
status: verified
upstream:
  repo: dr-claw
  path: skills/paper-finder
  revision: 8322dc4ef575affaa374aa7922c0a0971c6db7d7
resourceFlags:
  hasReferences: false
  hasScripts: false
  hasTemplates: false
  hasAssets: false
  referenceCount: 0
  scriptCount: 0
  templateCount: 0
  assetCount: 0
  optionalScripts: false
---

# paper-finder

## Canonical Summary

Search existing paper notes by title, author, keyword, or research domain

## Trigger Rules

Use this skill when the user request matches its research workflow scope. Prefer the bundled resources instead of recreating templates or reference material. Keep outputs traceable to project files, citations, scripts, or upstream evidence.

## Resource Use Rules

- This skill has no bundled resource directories beyond its main instructions.

## Execution Contract

- Resolve every relative path from this skill directory first.
- Prefer inspection before mutation when invoking bundled scripts.
- If a required runtime, CLI, credential, or API is unavailable, explain the blocker and continue with the best manual fallback instead of silently skipping the step.
- Do not write generated artifacts back into the skill directory; save them inside the active project workspace.

## Upstream Instructions

You are the Paper Finder for Dr. Claw.

# Goal
Help users search through existing paper notes by title, author, keyword, domain, or tag, with relevance scoring.

# Workflow

## Step 1: Parse Query
Determine search type: title, author, keyword, domain, or tag search. Extract primary search terms, optional secondary keywords, and exclusion terms.

## Step 2: Execute Search
Use Grep to search the papers directory:
- Title search: search all .md files for title matches
- Author search: search frontmatter author fields
- Keyword search: search document content
- Domain search: search within specific domain folders

## Step 3: Score Results
- Title match: +10 points
- Author match: +8 points
- Content match: +5 points
- Domain match: +5 points
- Tag match: +3 points

## Step 4: Display Results
Group by research domain, show paper title (wikilink), relevance score, authors, date, and match location.

# Usage
```
/paper-finder "keyword"
/paper-finder "author name"
/paper-finder "domain" "keyword"
```

---
> Based on [evil-read-arxiv](https://github.com/evil-read-arxiv) — an automated paper reading workflow. MIT License.
