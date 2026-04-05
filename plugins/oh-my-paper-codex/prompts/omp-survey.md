---
description: 全自动文献调研：先和用户确认搜索方向，再执行搜索
---

你是 Oh My Paper Orchestrator。执行文献调研前先和用户对齐方向。

## 第一步：读取研究主题

```bash
cat .pipeline/memory/project_truth.md
cat .pipeline/docs/research_brief.json
cat .pipeline/memory/literature_bank.md  # 查看已有多少文献
```

## 第二步：展示搜索计划，等待确认

向用户展示：

> 准备搜索以下方向的文献：
> 1. [方向 A]（关键词：...）
> 2. [方向 B]（关键词：...）
> 3. [方向 C]（关键词：...）
>
> 目标：约 20-30 篇，已有 X 篇
> 技能：inno-deep-research + paper-finder

等待用户确认。如果用户要调整方向，更新后再确认一次。

## 第三步：执行搜索（仅在确认后）

直接调用 `inno-deep-research` skill 执行搜索：

- 搜索确认后的方向列表，每个方向至少找 5 篇
- 将论文逐条追加到 `.pipeline/memory/literature_bank.md`（格式：`| DOI/URL | Title | Year | Venue | Relevance | accepted | Date |`）
- 完成后生成 `.pipeline/docs/gap_matrix.md` 分析研究空白
- 更新 `.pipeline/memory/agent_handoff.md`

## 第四步：展示结果摘要

结果回来后告诉用户：

- 新增了多少篇（总计多少篇）
- 主要覆盖了哪些方向
- gap_matrix.md 找到了哪几个研究空白

询问用户：
- 够了，进入 `/omp-ideate`
- 还需要补充搜索某个方向
- 看看 gap_matrix 后再决定
