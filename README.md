<p align="center">
  <img src="./icons/icon.png" alt="Oh My Paper" width="140" height="140" />
</p>

<h1 align="center">Oh My Paper</h1>

<p align="center">
  <strong>The Visual Research Workbench — From Literature to Publication, All in One Place</strong>
</p>

<p align="center">
  <em>可视化科研工作台 — 从文献到发表，一站式自主科研</em>
</p>

<p align="center">
  <a href="#features"><strong>Features</strong></a> ·
  <a href="#claude-code-plugin"><strong>Claude Code Plugin</strong></a> ·
  <a href="#architecture"><strong>Architecture</strong></a> ·
  <a href="#getting-started"><strong>Getting Started</strong></a> ·
  <a href="#中文说明"><strong>中文说明</strong></a> ·
  <a href="#license"><strong>License</strong></a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/platform-macOS-blue?style=flat-square" />
  <img src="https://img.shields.io/badge/version-0.2.1-green?style=flat-square" />
  <img src="https://img.shields.io/badge/license-MIT-orange?style=flat-square" />
  <img src="https://img.shields.io/badge/Tauri-v2-blueviolet?style=flat-square" />
  <img src="https://img.shields.io/badge/skills-34-ff69b4?style=flat-square" />
</p>

---

## Why Oh My Paper?

Research is messy. You jump between paper PDFs, code editors, remote servers, LaTeX compilers, reference managers, and AI assistants — each in a different window, each losing context.

**Oh My Paper is the unified entry point for autonomous research.** It wraps the entire research lifecycle — literature survey, idea generation, experiment execution, paper writing, and academic promotion — into a single desktop workbench, orchestrated by AI agents that understand your project state.

> 🔬 Think of it as an **IDE for research**, not just for code.

---

## Features

### 🤖 AI Agent Harness — Multi-Role Research Orchestration

**The core innovation of Oh My Paper.** Not just AI chat, but a complete agent orchestration framework with role-based memory and task coordination.

#### Five Specialized Agent Roles

When you open Claude Code in a research project, the system auto-detects project state and prompts you to choose a role:

| Agent Role | Responsibility | Memory Files |
|-----------|----------------|--------------|
| **Conductor** | Global planning, review outputs, dispatch tasks | `project_truth` + `orchestrator_state` + `tasks.json` + `review_log` |
| **Literature Scout** | Search papers, organize literature bank | `project_truth` + `execution_context` + `paper_bank.json` |
| **Experiment Driver** | Design experiments, write code, run evaluations | `execution_context` + `experiment_ledger` + `research_brief.json` |
| **Paper Writer** | Draft sections, generate figures, audit references | `execution_context` + `result_summary` + `paper_bank.json` |
| **Reviewer** | Peer review, quality gate | `execution_context` + `project_truth` + `result_summary` |

#### How It Works

```
User selects role → Agent loads role-specific memory → Works as that persona → Updates shared state
                                                                                    ↓
                                                                    Writes to tasks.json / paper_bank.json
                                                                                    ↓
                                                                            App UI updates in real-time
```

**Key Features:**
- **Role-based memory isolation**: Each agent only sees what it needs
- **Shared state synchronization**: Tasks and literature sync between CLI and GUI
- **Codex delegation**: Conductor can hand off code tasks to Codex in a separate terminal
- **Session continuity**: Agents remember project context across sessions

### 🧠 AI-Powered Research Pipeline

A five-stage structured workflow that drives your project from idea to publication:

```
Survey → Ideation → Experiment → Publication → Promotion
```

Each stage comes with **auto-generated task trees**, **recommended skills**, and **context-aware agent prompts**. The AI agent reads your project state (`tasks.json`, `research_brief.json`) and knows exactly what to do next.

### 🤖 Agent Integration

- **Claude Code** and **Codex** CLI agents embedded with a full terminal interface
- Agents are **project-aware** — they read `CLAUDE.md`/`AGENTS.md`, understand the pipeline stage, and follow skill instructions
- **34 built-in research skills** covering literature search, idea evaluation, experiment development, paper writing, figure generation, reference auditing, and more

### 🧪 Auto-Experiment Loop

Set a success metric, point to a remote compute node, and let the system iterate autonomously:

```
Modify code → Sync to server → Execute → Parse metrics → Repeat until goal met
```

- Remote compute via SSH/rsync with `compute-helper` CLI
- Configurable success thresholds, max iterations, and failure limits
- Real-time run-state tracking in the UI

### 📝 LaTeX Workbench

- **CodeMirror 6** editor with LaTeX syntax highlighting, outline extraction, and comment gutter
- **pdf.js** preview with SyncTeX-style bidirectional navigation
- `latexmk` compile pipeline with diagnostics, log display, and auto-compile toggle
- Multi-file project tree with drag-and-drop, file/folder creation, and workspace tabs

### 📊 Research Canvas

- Visual task tree across all five stages with progress tracking
- Stage initialization, task CRUD, and AI-suggested task decomposition
- Pipeline artifact browser linking each stage to its outputs

### 🖥️ Integrated Terminal

- Full PTY-based terminal panel alongside the editor
- Run agent CLIs, SSH sessions, and build commands without leaving the workbench

### 💬 Remote Control

- Optional **WeChat** (via cc-connect) and **Telegram** bot integration
- Send instructions to your agents from your phone while experiments run

### ☁️ Collaboration (Optional)

- Cloudflare Worker-based real-time sync with role-based access
- Share links, review comments, and deployment helpers

---

## Claude Code Plugin

Oh My Paper ships a **Claude Code plugin** (`omp`) that brings the full research pipeline into your Claude Code sessions — so you can run AI-assisted research commands directly from the terminal or Claude Code IDE extensions.

### Installation

**Step 1 — Add the plugin from the marketplace:**

```bash
/plugin marketplace add LigphiDonk/Oh-my--paper
```

**Step 2 — Install the plugin into your session:**

```bash
/plugin install omp@oh-my-paper
```

### Available Commands

| Command | Description |
|---------|-------------|
| `/omp:setup` | Initialize a new research project (scaffold directories, CLAUDE.md, pipeline config) |
| `/omp:survey` | Run an AI-assisted literature survey for your research topic |
| `/omp:ideate` | Generate and evaluate research ideas based on survey findings |
| `/omp:experiment` | Design and execute experiments with remote compute support |
| `/omp:write` | Draft paper sections, figures, and captions with AI assistance |
| `/omp:review` | Gate-check your paper or experiment results before submission |
| `/omp:delegate` | Hand off a task to a specialized agent (Codex rescue, deep analysis, etc.) |
| `/omp:plan` | Build or update the research plan interactively |

### Quick Start with Plugin

```bash
# Inside your research project directory:
/omp:setup        # scaffold the project
/omp:survey       # start the literature survey
/omp:ideate       # generate ideas from the survey
/omp:experiment   # run experiments
/omp:write        # draft the paper
/omp:review       # final quality gate
```

---

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                 Oh My Paper App                     │
│  ┌──────────┐  ┌──────────┐  ┌──────────────────┐  │
│  │  Editor   │  │   PDF    │  │  Research Canvas │  │
│  │(CodeMirror│  │ (pdf.js) │  │  (Task Tree +    │  │
│  │   + LaTeX)│  │          │  │   Stage Tracker) │  │
│  └──────────┘  └──────────┘  └──────────────────┘  │
│  ┌──────────┐  ┌──────────┐  ┌──────────────────┐  │
│  │ Terminal  │  │  Agent   │  │   Skill Engine   │  │
│  │  (PTY)   │  │(Claude/  │  │  (34 built-in    │  │
│  │          │  │  Codex)  │  │   research skills)│  │
│  └──────────┘  └──────────┘  └──────────────────┘  │
├─────────────────────────────────────────────────────┤
│               Tauri (Rust Backend)                  │
│  Compile · Agent · Terminal · Skill · Research ·    │
│  Experiment · Provider · Profile · File · Sync      │
├─────────────────────────────────────────────────────┤
│            Node Sidecar + compute-helper            │
│  Claude Code SDK · Codex Runner · Remote SSH/rsync  │
└─────────────────────────────────────────────────────┘
```

### Repository Layout

| Path | Purpose |
|------|---------|
| `src/` | React + Vite frontend — editor, preview, canvas, sidebar, settings |
| `src-tauri/` | Rust backend — file I/O, compile, terminal, agent orchestration, skill engine |
| `sidecar/` | Node sidecar — runs Claude Code / Codex CLIs, compute-helper for remote experiments |
| `skills/` | 34 built-in research skills with YAML frontmatter and markdown instructions |
| `templates/` | Project templates — `CLAUDE.md`, `AGENTS.md`, default pipeline config |
| `plugins/oh-my-paper/` | Claude Code plugin — `/omp:*` commands for terminal-based research workflow |
| `workers/` | Optional Cloudflare Worker collaboration backend |

### New Project Structure

When you create a project, Oh My Paper scaffolds:

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
├── skills/                 # Project-local skills
├── .pipeline/              # Task & brief state
├── CLAUDE.md               # Agent protocol
├── AGENTS.md               # Agent protocol (Codex)
└── instance.json           # Project identity
```

---

## Getting Started

### Prerequisites

| Tool | Required | Purpose |
|------|----------|---------|
| **Node.js** 20+ | ✅ | Frontend build, sidecar runtime |
| **Rust + Cargo** | ✅ | Tauri backend |
| **latexmk** | ✅ | LaTeX compilation |
| **synctex** | ✅ | Source ↔ PDF navigation |
| **Claude Code** / **Codex** | Optional | AI agent CLIs |
| **Wrangler** | Optional | Collaboration deployment |

### Development

```bash
# Clone and install
git clone https://github.com/LigphiDonk/Oh-my--paper.git
cd Oh-my--paper
npm install

# Run the desktop app (includes sidecar build)
npm run tauri dev

# Or run frontend only in browser
npm run dev
```

### Production Build

```bash
npm run tauri build
```

### Quality Checks

```bash
npm run test          # Vitest
npm run lint          # ESLint
cd src-tauri && cargo test --lib   # Rust unit tests
```

### macOS Install Note

GitHub Actions builds are unsigned. Remove quarantine after download:

```bash
xattr -dr com.apple.quarantine /Applications/Oh\ My\ Paper.app
```

---

## 中文说明

### 什么是 Oh My Paper？

Oh My Paper 是一个面向科研人员的**可视化自主科研工作台**。它不是又一个 LaTeX 编辑器，而是把从文献调研到最终发表的**整个科研流程**整合进一个桌面应用，并用 AI Agent 驱动自动化。

### 核心理念

> 🎯 **Auto Research 的入口** — 让 AI 帮你跑实验、写论文、管任务，你只需要做最重要的科研决策。

### 🤖 AI Agent Harness — 多角色协作编排系统

**这是 Oh My Paper 的核心创新。** 不是简单的 AI 对话，而是一套完整的 Agent 编排框架，支持角色化记忆和任务协调。

#### 五个专业 Agent 角色

在研究项目中打开 Claude Code 时，系统自动检测项目状态并提示选择角色：

| Agent 角色 | 职责 | 记忆文件 |
|-----------|------|---------|
| **Conductor（统筹者）** | 全局规划、评审产出、派遣任务 | `project_truth` + `orchestrator_state` + `tasks.json` + `review_log` |
| **Literature Scout（文献侦察兵）** | 搜索论文、整理文献库 | `project_truth` + `execution_context` + `paper_bank.json` |
| **Experiment Driver（实验驾驶员）** | 设计实验、编写代码、运行评估 | `execution_context` + `experiment_ledger` + `research_brief.json` |
| **Paper Writer（论文作者）** | 撰写章节、生成图表、审查引用 | `execution_context` + `result_summary` + `paper_bank.json` |
| **Reviewer（评审者）** | 同行评审、质量门控 | `execution_context` + `project_truth` + `result_summary` |

#### 工作原理

```
用户选择角色 → Agent 加载角色记忆 → 以该身份工作 → 更新共享状态
                                                        ↓
                                        写入 tasks.json / paper_bank.json
                                                        ↓
                                                App UI 实时更新
```

**核心特性：**
- **角色化记忆隔离**：每个 Agent 只看到需要的信息
- **共享状态同步**：任务和文献在 CLI 和 GUI 之间同步
- **Codex 委派**：Conductor 可以将代码任务交给独立终端中的 Codex
- **会话连续性**：Agent 跨会话记住项目上下文

### Claude Code 插件安装

Oh My Paper 附带一个 Claude Code 插件，让你可以在终端或 IDE 里直接运行科研工作流命令。

**第一步 — 添加插件源：**

```bash
/plugin marketplace add LigphiDonk/Oh-my--paper
```

**第二步 — 安装插件：**

```bash
/plugin install omp@oh-my-paper
```

**可用命令：**

| 命令 | 说明 |
|------|------|
| `/omp:setup` | 初始化科研项目（创建目录结构、CLAUDE.md、流水线配置） |
| `/omp:survey` | AI 辅助文献调研 |
| `/omp:ideate` | 基于调研生成并评估科研创意 |
| `/omp:experiment` | 设计并执行实验（支持远端计算节点） |
| `/omp:write` | AI 辅助撰写论文章节、图表和说明 |
| `/omp:review` | 提交前质量门控检查 |
| `/omp:delegate` | 将任务委托给专业 Agent（Codex、深度分析等） |
| `/omp:plan` | 交互式构建或更新科研计划 |

### 五阶段科研流水线

```
文献调研 (Survey) → 创意生成 (Ideation) → 实验执行 (Experiment)
                  → 论文撰写 (Publication) → 推广传播 (Promotion)
```

每个阶段自动生成任务树，配备推荐 Skill，Agent 自动读取项目状态并执行下一步。

### 核心能力

| 能力 | 说明 |
|------|------|
| 🧠 **AI Agent** | 内置 Claude Code + Codex CLI，理解项目上下文，自主推进任务 |
| 🧪 **自动实验** | 修改代码 → 同步远端 → 执行评估 → 解析指标 → 自动迭代，直到达标 |
| 📝 **LaTeX 编辑** | CodeMirror 编辑器 + PDF 预览 + SyncTeX 跳转 + 自动编译 |
| 🎯 **34 个研究技能** | 文献检索、创意评估、实验开发、论文写作、图表生成、参考文献审计等 |
| 📊 **研究画布** | 可视化任务树、阶段进度、产出文件关联 |
| 🖥️ **终端** | 内置 PTY 终端，SSH/rsync/编译命令不离开工作台 |
| 💬 **远程控制** | 可选微信/Telegram 集成，手机发指令让 Agent 执行任务 |
| ☁️ **协作** | 可选 Cloudflare Worker 实时同步，支持分享、评论、角色化协作 |

### 新项目结构

创建项目后的目录布局：

```
my-research/
├── paper/          # LaTeX 工作区 (main.tex, sections/, refs/)
├── experiment/     # 实验代码与脚本
├── survey/         # 文献调研产出
├── ideation/       # 创意与方案评估
├── promotion/      # 演讲稿、推广材料
├── skills/         # 项目级技能
├── .pipeline/      # 任务与项目状态
├── CLAUDE.md       # Agent 协议
└── instance.json   # 项目身份
```

### 本地开发

```bash
git clone https://github.com/LigphiDonk/Oh-my--paper.git
cd Oh-my--paper && npm install
npm run tauri dev       # 启动桌面应用
```

### macOS 安装

GitHub Actions 构建产物未签名，下载后需移除 quarantine：

```bash
xattr -dr com.apple.quarantine /Applications/Oh\ My\ Paper.app
```

---

## Roadmap

- [ ] Multi-platform support (Windows, Linux)
- [ ] Plugin marketplace for community skills
- [ ] Built-in reference manager with PDF annotation
- [ ] Experiment dashboard with metric visualization
- [ ] One-click deployment to arXiv / OpenReview

---

## License

MIT License. See [LICENSE](./LICENSE).

---

## Acknowledgments

特别感谢 **[Linux.do](https://linux.do)** 社区的支持与反馈，你们的建议让这个项目变得更好。

Special thanks to the **[Linux.do](https://linux.do)** community for your support and feedback.

---

<p align="center">
  <strong>Oh My Paper</strong> — Where Research Meets Automation
</p>
