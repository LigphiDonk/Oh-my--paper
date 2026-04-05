---
description: 强制同步项目进度文档（project_truth / execution_context / orchestrator_state）
---

你是 Oh My Paper Conductor。用户调用此命令是因为进度文档没有及时更新。你的任务是**全面重建三个核心进度文档**，使其准确反映当前真实状态。

## 第一步：读取所有原始数据

一次性读取所有状态文件，获取完整上下文：

```bash
cat .pipeline/tasks/tasks.json
cat .pipeline/memory/project_truth.md
cat .pipeline/memory/orchestrator_state.md
cat .pipeline/memory/execution_context.md
cat .pipeline/memory/experiment_ledger.md
cat .pipeline/memory/decision_log.md
cat .pipeline/memory/literature_bank.md
cat .pipeline/memory/agent_handoff.md
cat .pipeline/memory/review_log.md
cat .pipeline/docs/research_brief.json
```

## 第二步：向用户确认遗漏的进展

询问用户：

> **进度同步**
>
> 我已读取所有文件，准备重建进度文档。
>
> 请简述一下**文档中没有记录但实际已完成的事情**（如果有）：
> - 例：「跑完了 baseline 实验，accuracy 83%」
> - 例：「调整了研究方向，改为专注 X 方法」
> - 例：「没有遗漏，只是文档没更新」

## 第三步：重建 project_truth.md

综合所有信息，**完整重写** `project_truth.md`，结构如下：

```markdown
# Project Truth
_最后同步：[ISO 日期时间]_

## 研究主题
[来自 research_brief.json]

## 当前阶段
[currentStage] — 总体进度：[X/Y 任务完成]

## 已确认决策
（来自 decision_log.md，每条一行）

## 阶段进展摘要

### Survey
[完成的文献调研成果]

### Ideation
[已评估的 idea，选定方向]

### Experiment
[实验结果摘要]

### Publication
[写作进展]

## 当前最佳实验结果
[来自 experiment_ledger.md 的最优结果]

## 风险 / 阻塞项
[当前阻塞或高风险项]
```

## 第四步：重建 orchestrator_state.md

**完整重写** `orchestrator_state.md`，包含全局进度看板、当前活跃任务、最近完成任务、决策点、下一步建议。

## 第五步：重建 execution_context.md

**完整重写** `execution_context.md`，包含当前任务详情、决策树、评估配置、上下文积累诊断。

## 第六步：写入文件并确认

将三个文件写入 `.pipeline/memory/`。

向用户确认：

> **同步完成** ✓
>
> 已更新：
> - `project_truth.md`
> - `orchestrator_state.md`
> - `execution_context.md`
>
> 接下来？
> - 继续当前任务
> - 查看更新后的进度（/omp-plan）
> - 没事了
