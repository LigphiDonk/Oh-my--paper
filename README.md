<p align="center">
  <img src="./icons/icon.png" alt="Oh My Paper" width="120" height="120" />
</p>

<h1 align="center">Oh My Paper</h1>

<p align="center">
  <strong>A research harness for Claude Code — turn your terminal into an autonomous research lab.</strong>
</p>

<p align="center">
  <em>学术科研 harness — 装进 Claude Code，让 AI 帮你跑完从调研到发表的全流程。</em>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/claude--code-plugin-blueviolet?style=flat-square" />
  <img src="https://img.shields.io/badge/agents-5-ff69b4?style=flat-square" />
  <img src="https://img.shields.io/badge/skills-34-green?style=flat-square" />
  <img src="https://img.shields.io/badge/commands-8-blue?style=flat-square" />
  <img src="https://img.shields.io/badge/license-MIT-orange?style=flat-square" />
</p>

---

## TL;DR — 直接装

```bash
# In Claude Code:
/plugin marketplace add LigphiDonk/Oh-my--paper
/plugin install omp@oh-my-paper
```

装完重启 Claude Code。在你的科研项目里输入 `/omp:setup`，然后用 `/omp:survey`、`/omp:experiment`、`/omp:write` 驱动整个科研流程。不需要 GUI，不需要切窗口，所有事情都在终端里完成。

---

## Table of Contents

- [Why This Exists](#why-this-exists)
- [Install](#install)
- [Slash Commands](#slash-commands)
- [The Agent Team](#the-agent-team)
- [34 Research Skills](#34-research-skills)
- [Hooks — 后台自动运行](#hooks--后台自动运行)
- [Research Pipeline](#research-pipeline)
- [Project Scaffold](#project-scaffold)
- [How Memory Works](#how-memory-works)
- [Codex Delegation](#codex-delegation)
- [Remote Experiments](#remote-experiments)
- [For LLM Agents](#for-llm-agents)
- [Philosophy](#philosophy)
- [Contributing](#contributing)
- [Uninstall](#uninstall)

---

## Why This Exists

Claude Code is already a great coding agent. But **research isn't just coding** — it's literature survey, idea evaluation, experiment design, paper writing, reference checking, and a dozen other things that require domain-specific workflows.

Oh My Paper makes Claude Code **research-aware** by adding:

- 🎯 **A structured 5-stage pipeline** — Survey → Ideation → Experiment → Publication → Promotion
- 🤖 **5 specialized agent roles** — each with isolated memory and clear responsibilities
- 📚 **34 built-in research skills** — from paper search to figure generation
- 🪝 **Background hooks** — auto-inject project context at session start, track task completion, detect stage transitions
- 🔀 **Codex delegation** — hand off parallel tasks to Codex in a separate terminal

Install it and forget about it. Your sessions get smarter. Your research gets organized.

---

## Install

### Step 1: Add the marketplace

```bash
/plugin marketplace add LigphiDonk/Oh-my--paper
```

### Step 2: Install the plugin

```bash
/plugin install omp@oh-my-paper
```

### Step 3: Restart Claude Code

Required for hooks to activate.

### Update

```bash
/plugin marketplace update Oh-my--paper
/plugin update omp@oh-my-paper
```

### Alternative: From Local Directory

```bash
git clone https://github.com/LigphiDonk/Oh-my--paper.git /tmp/oh-my-paper
# In Claude Code:
/plugin marketplace add /tmp/oh-my-paper
/plugin install omp@oh-my-paper
```

---

## Slash Commands

All commands are prefixed with `/omp:`. Use them anywhere inside Claude Code.

| Command | What It Does |
|---------|-------------|
| `/omp:setup` | Scaffold a new research project — creates directories, `CLAUDE.md`, `AGENTS.md`, pipeline config, and instance identity |
| `/omp:survey` | AI-assisted literature survey — search papers, build a structured literature bank (`paper_bank.json`) |
| `/omp:ideate` | Generate and evaluate research ideas based on your survey findings |
| `/omp:experiment` | Design experiments, write evaluation code, run on remote compute nodes |
| `/omp:write` | Draft paper sections, generate figures and captions, manage LaTeX files |
| `/omp:review` | Quality gate — peer-review your paper or experiment results before submission |
| `/omp:delegate` | Hand off a task to a specialized agent (Codex rescue, deep analysis, etc.) |
| `/omp:plan` | Build or update your research plan interactively |

### Quick Start

```bash
/omp:setup          # scaffold the project
/omp:survey         # start literature survey
/omp:ideate         # generate ideas from survey
/omp:experiment     # design & run experiments
/omp:write          # draft the paper
/omp:review         # final quality gate
```

---

## The Agent Team

When you open Claude Code in an Oh My Paper project, the system auto-detects project state and prompts you to choose a role. Each role has **isolated memory** — it only reads and writes the files it needs.

| Role | Responsibility | Memory Scope |
|------|---------------|-------------|
| **🎭 Conductor** | Global planning, review outputs, dispatch tasks | `project_truth` · `orchestrator_state` · `tasks.json` · `review_log` |
| **📖 Literature Scout** | Search papers, organize literature bank | `project_truth` · `execution_context` · `paper_bank.json` |
| **🧪 Experiment Driver** | Design experiments, write code, run evaluations | `execution_context` · `experiment_ledger` · `research_brief.json` |
| **✍️ Paper Writer** | Draft sections, generate figures, audit references | `execution_context` · `result_summary` · `paper_bank.json` |
| **🔍 Reviewer** | Peer review, quality gate, consistency check | `execution_context` · `project_truth` · `result_summary` |

### How It Works

```
You select a role
    → Agent loads role-specific memory files
        → Works as that persona (knows its boundaries)
            → Updates shared state (tasks.json, paper_bank.json, ...)
                → Next agent picks up where you left off
```

**Key design decisions:**

- **Memory isolation** — the Paper Writer can't see the Conductor's orchestrator state; the Literature Scout can't see experiment results. This prevents context pollution and keeps each agent sharp.
- **Shared state sync** — `tasks.json` and `paper_bank.json` are the common ground, updated by all roles.
- **Session continuity** — agents remember project context across Claude Code sessions via the memory system.

---

## 34 Research Skills

Skills are structured instruction sets that Claude Code loads on demand. Each skill is a markdown file with YAML frontmatter, covering a specific research task.

<details>
<summary><strong>Click to expand the full skill list</strong></summary>

| Category | Skills |
|----------|--------|
| **Literature** | `paper-finder` · `paper-analyzer` · `paper-image-extractor` · `research-literature-trace` · `biorxiv-database` · `dataset-discovery` |
| **Survey & Ideation** | `inno-deep-research` · `gemini-deep-research` · `inno-code-survey` · `inno-idea-generation` · `inno-idea-eval` · `research-idea-convergence` |
| **Experiment** | `inno-experiment-dev` · `inno-experiment-analysis` · `research-experiment-driver` · `remote-experiment` |
| **Writing** | `inno-paper-writing` · `ml-paper-writing` · `scientific-writing` · `inno-figure-gen` · `inno-reference-audit` · `research-paper-handoff` |
| **Planning & Review** | `inno-pipeline-planner` · `research-pipeline-planner` · `inno-paper-reviewer` · `inno-prepare-resources` · `inno-rclone-to-overleaf` |
| **Presentation** | `making-academic-presentations` · `inno-grant-proposal` |
| **Agent Dispatch** | `claude-code-dispatch` · `codex-dispatch` |
| **Domain-Specific** | `academic-researcher` · `bioinformatics-init-analysis` · `research-news` |

</details>

Skills are auto-recommended based on your current pipeline stage. You can also add project-local skills in the `skills/` directory.

---

## Hooks — 后台自动运行

Oh My Paper registers three hooks that run invisibly in the background:

| Hook | Trigger | What It Does |
|------|---------|-------------|
| **SessionStart** | Every time you open Claude Code | Injects project context — detects pipeline stage, loads memory files, primes the agent with your project state |
| **Stop** | When a task completes | Tracks task completion, updates `tasks.json`, logs progress |
| **PostToolUse (Write)** | After any file write | Detects pipeline stage transitions — if you just created `experiment/` files, it knows you've moved to the Experiment stage |

You don't need to configure anything. Install the plugin and the hooks just work.

---

## Research Pipeline

A structured 5-stage workflow that drives your project from idea to publication:

```
┌──────────┐    ┌──────────┐    ┌────────────┐    ┌─────────────┐    ┌───────────┐
│  Survey  │ →  │ Ideation │ →  │ Experiment │ →  │ Publication │ →  │ Promotion │
└──────────┘    └──────────┘    └────────────┘    └─────────────┘    └───────────┘
  文献调研         创意生成         实验执行           论文撰写           推广传播
```

Each stage comes with:
- **Auto-generated task trees** — what you need to do next
- **Recommended skills** — which skills to load for this stage
- **Context-aware prompts** — the agent reads `tasks.json` and `research_brief.json` and knows exactly what to do

---

## Project Scaffold

`/omp:setup` creates this structure:

```
my-research/
├── paper/                  # LaTeX workspace
│   ├── main.tex
│   ├── sections/
│   └── refs/
├── experiment/             # Experiment code & scripts
├── survey/                 # Literature survey artifacts
├── ideation/               # Ideas, evaluations, plans
├── promotion/              # Slides, demos, outreach
├── skills/                 # Project-local skills (extend the 34 built-in)
├── .pipeline/              # Pipeline state
│   ├── tasks.json          # Task tree across all stages
│   └── research_brief.json # Project identity & goals
├── CLAUDE.md               # Agent protocol for Claude Code
├── AGENTS.md               # Agent protocol for Codex
└── instance.json           # Project identity
```

---

## How Memory Works

The memory system is what makes Oh My Paper more than a bag of slash commands. Each agent role has access to specific memory files:

```
.pipeline/
├── project_truth           # Ground truth: what this project is about
├── orchestrator_state      # Conductor's planning state
├── execution_context       # Current execution context (shared)
├── experiment_ledger       # Experiment history & results
├── result_summary          # Latest results for writing & review
├── review_log              # Review feedback history
├── tasks.json              # Task tree (shared across all roles)
├── paper_bank.json         # Literature bank (shared)
└── research_brief.json     # Project brief & scope
```

Memory files survive across sessions. When you start a new Claude Code session, the `SessionStart` hook detects your project's memory state and injects the relevant context — so you pick up right where you left off.

---

## Codex Delegation

The **Conductor** agent can hand off parallelizable tasks to Codex:

```
/omp:delegate    # Opens a Codex session with the right context
```

Use this for:
- Running long experiment loops while you keep working
- Code refactoring tasks that don't need Claude's reasoning
- Parallel sub-tasks during a large research sprint

The delegation preserves shared state — Codex writes to the same `tasks.json` and `experiment_ledger`.

---

## Remote Experiments

The `remote-experiment` skill + `/omp:experiment` support a full auto-experiment loop:

```
Modify code → rsync to server → Execute on GPU node → Parse metrics → Repeat until goal met
```

- SSH/rsync-based remote compute via `compute-helper` CLI
- Configurable success thresholds, max iterations, and failure limits
- Experiment results flow back into the memory system for the Paper Writer

---

## For LLM Agents

If you're an AI agent installing this plugin, here are the exact steps:

```bash
# Step 1: Add marketplace
/plugin marketplace add LigphiDonk/Oh-my--paper

# Step 2: Install plugin
/plugin install omp@oh-my-paper

# Step 3: Verify installation
/plugin
# Should show: omp @ oh-my-paper, Status: Enabled

# Step 4: User must restart Claude Code (you cannot do this)
# Inform user: "Please restart Claude Code to activate hooks."

# Step 5: Initialize project
/omp:setup
```

After restart, use `/omp:*` commands to drive the research pipeline.

---

## Philosophy

> **Enhance, don't replace.** Claude Code is already smart — we add research structure, not overrides.

- 🧠 **Your context is for reasoning** — hooks inject only what's needed; memory files keep the rest on disk
- 🎯 **Domain-specific, not generic** — every skill, agent, and command is designed for academic research
- 🔇 **Invisible when not needed** — hooks run in the background; no noise if you're just coding
- 🔀 **Composable** — use one command, use all of them, or just let the hooks do their thing
- 📖 **Memory over repetition** — agents remember project context so you don't re-explain every session

---

## Contributing

PRs welcome. If you add a new skill, put it in `skills/` with proper YAML frontmatter and update `research-catalog.json`.

Any change to cached content requires version bumps in **both**:
- `plugins/oh-my-paper/.claude-plugin/plugin.json`
- `.claude-plugin/marketplace.json`

---

## Uninstall

```bash
/plugin uninstall omp@oh-my-paper
```

---

## License

MIT License. See [LICENSE](./LICENSE).

---

## Acknowledgments

特别感谢 **[Linux.do](https://linux.do)** 社区的支持与反馈。

Special thanks to the **[Linux.do](https://linux.do)** community for your support and feedback.

---

<p align="center">
  <strong>Oh My Paper</strong> — Where Research Meets the Terminal.
</p>
