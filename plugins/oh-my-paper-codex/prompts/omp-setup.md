---
description: 初始化研究项目结构（.pipeline/），生成 AGENTS.md，检查 Codex 环境
---

你正在为当前目录初始化 Oh My Paper 研究 harness。

## 第一步：检查环境

先确认 Codex 环境就绪：

```bash
node -e "process.exit(0)" 2>/dev/null && echo "Node.js OK"
codex --version 2>/dev/null || echo "Codex CLI not found"
```

告知用户环境状态：

> **环境检查**：
> - Node.js：[OK / 未安装]
> - Codex CLI：[版本 / 未安装]

## 第二步：询问研究信息

向用户询问项目基本信息：

> 请描述你的研究项目：
> - 研究主题是什么？（例：多模态医学影像分割）

然后再问：

> 从哪个阶段开始？
> - survey（文献调研）
> - ideation（创新点生成）
> - experiment（实验）
> - publication（论文写作）

## 第三步：创建目录结构

```bash
mkdir -p .pipeline/memory .pipeline/tasks .pipeline/docs .pipeline/.hook-events
```

## 第四步：生成 AGENTS.md

在项目根目录创建 `AGENTS.md`，内容如下（根据用户输入填充）：

```markdown
# Oh My Paper Research Harness

本项目使用 Oh My Paper 研究 harness 管理学术研究流程。

## 启动指令

检测到 `.pipeline/` 目录后，请立即询问用户今天的工作模式：

**[研究主题] · 当前阶段：[currentStage]**

> 今天想做什么？

选项：
- `统筹规划` — 以 Conductor 身份：查看全局进展，决定下一步，评审产出
- `文献调研` — 以 Literature Scout 身份：搜索论文，整理 literature_bank
- `实验执行` — 以 Experiment Driver 身份：设计/实现/运行实验，追踪结果
- `论文写作` — 以 Paper Writer 身份：撰写章节，生成图表，审查引用
- `论文评审` — 以 Reviewer 身份：同行评审，输出 review_log
- `直接告诉我要做什么` — 跳过角色选择

## 角色记忆映射

用户选择后，读取对应角色的记忆文件，以该角色身份开始工作：

| 选择 | 读取的记忆文件 |
|------|-------------|
| 统筹规划 | project_truth + orchestrator_state + tasks.json + review_log + agent_handoff + decision_log |
| 文献调研 | project_truth + execution_context + literature_bank + decision_log |
| 实验执行 | execution_context + project_truth + experiment_ledger + decision_log + research_brief |
| 论文写作 | execution_context + project_truth + result_summary + literature_bank + agent_handoff |
| 论文评审 | execution_context + project_truth + result_summary |

## 子任务完成后自动更新

每当子任务完成时，立即更新：
1. `.pipeline/tasks/tasks.json` — 将任务状态改为 done
2. `.pipeline/memory/project_truth.md` — 追加进展记录

## 阶段转换检测

更新 tasks.json 后，检查当前阶段所有任务是否完成。如果是，提示用户考虑推进到下一阶段。

## 技能目录

研究技能位于 `skills/` 目录，每个子目录包含一个 `SKILL.md`。
按需读取对应技能的指令。

## 项目结构

```
.pipeline/
├── tasks/tasks.json          # 全局任务树
├── docs/research_brief.json  # 研究概要
└── memory/                   # Agent 记忆文件
    ├── project_truth.md
    ├── orchestrator_state.md
    ├── execution_context.md
    ├── experiment_ledger.md
    ├── result_summary.md
    ├── review_log.md
    ├── literature_bank.md
    ├── agent_handoff.md
    └── decision_log.md
```
```

## 第五步：写入初始文件

创建以下文件（已存在则跳过）：

**`.pipeline/docs/research_brief.json`**：
```json
{
  "topic": "[用户填写的主题]",
  "goal": "",
  "currentStage": "[用户选择的阶段]",
  "successThreshold": "需要在此填写成功标准"
}
```

**`.pipeline/memory/project_truth.md`**：
```markdown
# Project Truth

## 研究主题
[主题]

## 已确认决策
（空，随项目推进逐步填充）
```

**`.pipeline/memory/orchestrator_state.md`**、**`execution_context.md`**、**`review_log.md`**、**`agent_handoff.md`**、**`decision_log.md`**、**`literature_bank.md`**、**`experiment_ledger.md`**：均创建空白初始版本。

**`.pipeline/tasks/tasks.json`**：
```json
{"version": 1, "tasks": []}
```

## 第六步：完成确认

> ✅ 研究项目初始化完成！
>
> **项目**：[主题]
> **起始阶段**：[阶段]
> **AGENTS.md**：已生成（Codex 会自动读取）
>
> 接下来：
> - 运行 `/omp-plan` 查看整体状态
> - 运行 `/omp-survey` 开始文献调研（如果从 survey 阶段）
