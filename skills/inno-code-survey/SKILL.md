---
id: inno-code-survey
name: inno-code-survey
version: 1.0.0
description: |-
  Acquires missing code repositories for the selected idea (Phase A) and conducts comprehensive code survey mapping academic concepts to implementations (Phase B).
stages: ["ideation", "experiment"]
tools: ["read_file", "search_project", "write_file", "run_terminal"]
summary: |-
  Acquires missing code repositories for the selected idea (Phase A) and conducts comprehensive code survey mapping academic concepts to implementations (Phase B). Outputs acquired_code_repos, updated_prepare_res, and model_survey for downst...
primaryIntent: research
intents: ["research"]
capabilities: ["search-retrieval"]
domains: ["general"]
keywords: ["inno-code-survey", "survey", "search-retrieval", "inno", "code", "acquires", "missing", "repositories", "selected", "idea", "phase", "conducts"]
source: builtin
status: verified
upstream:
  repo: dr-claw
  path: skills/inno-code-survey
  revision: 8322dc4ef575affaa374aa7922c0a0971c6db7d7
resourceFlags:
  hasReferences: true
  hasScripts: true
  hasTemplates: false
  hasAssets: false
  referenceCount: 2
  scriptCount: 1
  templateCount: 0
  assetCount: 0
  optionalScripts: true
---

# inno-code-survey

## Canonical Summary

Acquires missing code repositories for the selected idea (Phase A) and conducts comprehensive code survey mapping academic concepts to implementations (Phase B). Outputs acquired_code_repos, updated_prepare_res, and model_survey for downst...

## Trigger Rules

Use this skill when the user request matches its research workflow scope. Prefer the bundled resources instead of recreating templates or reference material. Keep outputs traceable to project files, citations, scripts, or upstream evidence.

## Resource Use Rules

- Read from `references/` only when the current task needs the extra detail.
- Treat `scripts/` as optional helpers. Run them only when their dependencies are available, keep outputs in the project workspace, and explain a manual fallback if execution is blocked.

## Execution Contract

- Resolve every relative path from this skill directory first.
- Prefer inspection before mutation when invoking bundled scripts.
- If a required runtime, CLI, credential, or API is unavailable, explain the blocker and continue with the best manual fallback instead of silently skipping the step.
- Do not write generated artifacts back into the skill directory; save them inside the active project workspace.

## Upstream Instructions

# Inno Code Survey (Repo Acquisition + Code Survey)

Merges `_acquire_missing_repos`, `_update_prepare_res_with_new_repos`, and `_conduct_code_survey` from [run_infer_idea_ours.py](workspace/medical/Medical_ai_scientist_idea/research_agent/run_infer_idea_ours.py) (lines 639–828, 1038–1052) into a single two-phase skill.

## Directory structure

```
skills/inno-code-survey/
├── SKILL.md                                          ← this file
├── prompts/
│   ├── build_repo_acquisition_query.md               ← Phase A query template
│   └── build_code_survey_query.md                    ← Phase B query template
├── references/
│   ├── repo_acquisition_agent.md                     ← Phase A agent system prompt & tools
│   └── code_survey_agent.md                          ← Phase B agent system prompt & tools
└── scripts/
    └── github_search_clone.py                        ← GitHub search + clone helper
```

## Path conventions

All file paths use semantic directory names under the project root:

| Path | Contents |
|------|----------|
| `Ideation/references/papers/` | Downloaded arXiv LaTeX sources (`.tex`, `.txt`, `.md`) |
| `Experiment/code_references/<repo_name>/` | Cloned GitHub repositories |
| `Experiment/code_references/model_survey.md` | Code survey implementation report |
| `Experiment/code_references/logs/` | Phase A & B agent cache files |

## Inputs

These are aligned with outputs from **inno-idea-generation** and **inno-prepare-resources**:

| Input | Source | Description |
|-------|--------|-------------|
| `selected_idea` | `Ideation/ideas/selected_idea.txt` or `final_selected_idea_data` | The finalized selected idea (full markdown) |
| `download_res` | `inno-prepare-resources` output | Result log from downloading arXiv paper sources |
| `prepare_res` | `inno-prepare-resources` output (JSON) | Contains `reference_codebases` and `reference_paths` |
| `context_variables` | Shared context dict | Accumulated pipeline context |
| `instance.json` | `<project_path>/instance.json` | Paths are **absolute** when created by Dr. Claw (`Experiment.code_references`, `Ideation.references`); use as-is or resolve with `path.join(project_path, value)` if relative. Also `date_limit` from context. |

## Outputs

| Output | Description | Consumer |
|--------|-------------|----------|
| `acquired_code_repos` | Dict of `{name: path}` for newly cloned repos | Phase B, cache |
| `updated_prepare_res` | `prepare_res` JSON with new repos merged into `reference_codebases` / `reference_paths` | Downstream pipeline |
| `extra_repo_info` | Formatted string listing acquired repos | Phase B query |
| `model_survey` | Comprehensive code survey implementation report | `inno-experiment-dev` |

---

## Phase A — Repo Acquisition

> Full template & parameter docs: [prompts/build_repo_acquisition_query.md](prompts/build_repo_acquisition_query.md)
> Agent system prompt & tools: [references/repo_acquisition_agent.md](references/repo_acquisition_agent.md)

Maps to `_acquire_missing_repos` (lines 745–792) + `_update_prepare_res_with_new_repos` (lines 639–686).

### Step A1: Analyze the selected idea and identify gaps

Read `selected_idea` and identify 2–3 **missing technical components** — novel or specialized parts that are likely NOT in the standard repos already present in `Experiment/code_references/`.

### Step A2: Search GitHub using the "Cascade" strategy

For each missing component, perform **6 distinct queries** using progressive decomposition:

1. **Level 1 (Specific)**: Search for the exact mechanism name
2. **Level 2 (Broad)**: Strip context adjectives, search core technique
3. **Level 3 (Atomic)**: Search for 3 base mathematical operators

Use the helper script or GitHub API directly:

```bash
# Option 1: Helper script
python scripts/github_search_clone.py --query "sinkhorn attention pytorch" --limit 5 --date-limit 2025-12-31

# Option 2: Direct GitHub API via curl
curl -s "https://api.github.com/search/repositories?q=sinkhorn+attention&per_page=5" \
  -H "Accept: application/vnd.github.v3+json"
```

### Step A3: Clone selected repos

Clone the best candidate for each gap into `Experiment/code_references/`:

```bash
GIT_TERMINAL_PROMPT=0 git clone --depth 1 <clone_url> Experiment/code_references/<repo_name>
```

### Step A4: Verify each clone

For each cloned repo:
1. Read `README.md`: `cat Experiment/code_references/<repo_name>/README.md`
2. Check language and domain relevance
3. Reject repos that don't match (wrong domain, empty, HTML-only)

### Step A5: Build `acquired_code_repos` and update `prepare_res`

1. Build `acquired_code_repos` dict from verified clones:
   ```json
   {
     "repo_name_1": "Experiment/code_references/repo_name_1",
     "repo_name_2": "Experiment/code_references/repo_name_2"
   }
   ```
2. Set `context_variables["acquired_code_repos"] = acquired_code_repos`
3. Parse `prepare_res` JSON, ensure `reference_codebases` and `reference_paths` arrays exist
4. For each entry in `acquired_code_repos`, if `path` not already in `reference_paths`:
   - Append repo name to `reference_codebases`
   - Append repo path to `reference_paths`
5. Serialize back to JSON as `updated_prepare_res`

### Step A6: Save Phase A cache

1. Build `extra_repo_info` string:
   ```
   - Name: <name1> | Path: <path1>
   - Name: <name2> | Path: <path2>
   ```
   (Empty string if no repos acquired)

2. Write `Experiment/code_references/logs/repo_acquisition_agent.json`:
   ```json
   {
     "context_variables": {
       "code_references_path": "<instance.Experiment.code_references if absolute (Dr. Claw), else path.join(project_path, ...)>",
       "references_path": "<instance.Ideation.references if absolute (Dr. Claw), else path.join(project_path, ...)>",
       "date_limit": "YYYY-MM-DD",
       "prepare_result": { ... },
       "acquired_code_repos": {
         "<name>": "<path>",
         ...
       },
       "updated_prepare_res": "<JSON string of updated prepare_res>"
     }
   }
   ```

---

## Phase B — Code Survey

> Full template & parameter docs: [prompts/build_code_survey_query.md](prompts/build_code_survey_query.md)
> Agent system prompt & tools: [references/code_survey_agent.md](references/code_survey_agent.md)

Maps to `_conduct_code_survey` (lines 794–828).

### Step B1: Build the code survey query

Construct the query using `selected_idea`, `download_res`, and `extra_repo_info` (from Phase A):

```
I have an innovative idea related to machine learning:
{selected_idea}

I have carefully gone through these papers' github repositories and found download
some of them in my local machine, in the directory `Experiment/code_references/`, use `ls`, `tree`,
and `find` to navigate the directory.
And I have also downloaded the corresponding paper (LaTeX sources, markdown, txt),
with the following information:
{download_res}

{extra_repo_info_block}

Your task is to carefully understand the innovative idea, and thoroughly review
codebases and generate a comprehensive implementation report for the innovative
idea. You can NOT stop to review the codebases until you have get all academic
concepts in the innovative idea.

Note that the code implementation should be as complete as possible.
```

### Step B2: Survey all repos in `Experiment/code_references/`

Use Linux commands to navigate and read code:

| Action | Command |
|--------|---------|
| List repos | `ls Experiment/code_references/` or `tree Experiment/code_references/ -L 1` |
| View repo structure | `tree Experiment/code_references/<repo>/ -L 3` |
| Find Python files | `find Experiment/code_references/<repo>/ -name "*.py" -type f` |
| Read source file | `cat Experiment/code_references/<repo>/model/attention.py` |
| Search across repos | `rg "class.*Attention" Experiment/code_references/` or `grep -rn "sinkhorn" Experiment/code_references/` |
| Read specific lines | `sed -n '100,200p' Experiment/code_references/<repo>/file.py` |

### Step B3: Map each innovative module to code

For each atomic academic concept in the idea:
1. Identify the mathematical formula
2. Locate the corresponding implementation across repos
3. Extract complete code snippets with file paths and function signatures

### Step B4: Generate comprehensive implementation report

The report must include for each concept:
- **Academic definition** — the concept name
- **Mathematical formula** — precise formulation
- **Code implementation** — real code from repos (not pseudocode)
- **Reference papers** — which papers define this
- **Reference codebases** — which repos implement it, with file paths

### Step B5: Store result

Set `context_variables["model_survey"] = code_survey_response` (the full implementation report text).

### Step B6: Save Phase B cache

Write `Experiment/code_references/logs/code_survey_agent.json`:

```json
{
  "context_variables": {
    "code_references_path": "<instance.Experiment.code_references if absolute (Dr. Claw), else path.join(project_path, ...)>",
    "references_path": "<instance.Ideation.references if absolute (Dr. Claw), else path.join(project_path, ...)>",
    "date_limit": "YYYY-MM-DD",
    "prepare_result": { ... },
    "acquired_code_repos": { ... },
    "notes": [
      {
        "definition": "<atomic concept>",
        "math_formula": "<formula>",
        "code_implementation": "<code snippet>",
        "reference_papers": ["<paper1>"],
        "reference_codebases": ["<repo1>"]
      }
    ],
    "model_survey": "<FULL text of the comprehensive implementation report>"
  }
}
```

**IMPORTANT**: The `model_survey` field must contain the **complete** report text — never a summary or abbreviation.

---

## Tool mappings (reference -> Linux/Claude Code)

| Reference tool | Replacement |
|---|---|
| `search_github_repos_wrapper` | `python scripts/github_search_clone.py --query "..." --limit 5` or `curl` to GitHub API |
| `tracked_execute_command` (git clone) | `GIT_TERMINAL_PROMPT=0 git clone --depth 1 <url> Experiment/code_references/<name>` |
| `list_files` | `ls`, `find`, `tree` |
| `read_file` | `cat`, `head`, `tail`, `sed -n` |
| `gen_code_tree_structure` | `tree -L 3` |
| `terminal_page_down/up/to` | N/A (not needed with `cat`/`less`) |
| `search_github_code` | `rg`, `grep -rn` across local repos |

---

## Checklist

### Phase A (Repo Acquisition)
- [ ] Selected idea analyzed; 2-3 missing components identified
- [ ] Cascade search performed (6 queries per gap across 3 levels)
- [ ] Best candidates cloned into `Experiment/code_references/`
- [ ] Each clone verified (README.md read, domain/language checked)
- [ ] `context_variables["acquired_code_repos"]` set as dict `{name: path}`
- [ ] `prepare_res` updated with new `reference_codebases` / `reference_paths`
- [ ] `extra_repo_info` string built for Phase B
- [ ] `Experiment/code_references/logs/repo_acquisition_agent.json` written

### Phase B (Code Survey)
- [ ] Code survey query built with `selected_idea` + `download_res` + `extra_repo_info`
- [ ] All repos in `Experiment/code_references/` surveyed using `tree`, `cat`, `grep`, `find`
- [ ] Every atomic academic concept in the idea has matching code identified
- [ ] Implementation report includes: code snippets, file paths, function signatures, formula-to-code mappings
- [ ] `context_variables["model_survey"]` set with full report text
- [ ] `Experiment/code_references/logs/code_survey_agent.json` written with complete `model_survey`

---

## References

- `run_infer_idea_ours.py`: `_acquire_missing_repos` (745–792), `_update_prepare_res_with_new_repos` (639–686), `_conduct_code_survey` (794–828)
- Prompts: `build_repo_acquisition_query` (prompt_templates.py:153–171), `build_code_survey_query` (prompt_templates.py:173–200)
- Agents: `repo_agent.py` (Repo Acquisition Agent definition + tools), `survey_agent.py` (Code Survey Agent definition)
- Cache examples: `repo_acquisition_agent.json`, `code_survey_agent.json` from reference pipeline output
