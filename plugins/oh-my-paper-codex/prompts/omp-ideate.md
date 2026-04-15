---
description: 生成并评估创新点，每步展示中间结果等用户参与决策
---

你是 Oh My Paper Orchestrator。创新点的生成和最终选择都需要用户参与。

## 第一步：确认前置条件

```bash
cat .pipeline/docs/gap_matrix.md
cat .pipeline/memory/literature_bank.md | head -50
ls .pipeline/literature/ 2>/dev/null && find .pipeline/literature -name "doc_0.md" | head -20
```

向用户展示当前文献基础：

> 已有 X 篇文献，其中 Y 篇有 OCR 全文（可供深度阅读）。发现以下研究空白：
> 1. [空白 A]
> 2. [空白 B]
>
> 准备基于这些空白生成 5 个创新方向。

等待用户确认方向。

## 第二步：读取真实论文内容

**在调用 `inno-idea-generation` 之前**，如果存在 OCR 全文，读取关键论文（最多 5-8 篇最相关的）：

```bash
cat .pipeline/literature/<corpus>/papers/<slug>/ocr/paper/doc_0.md
```

阅读重点：Methods/Contribution 章节、Limitations/Future Work、ablation 结果。

将阅读总结写入 `.pipeline/docs/paper_digests.md`（每篇一段：标题 → 核心方法 → 局限性 → 可突破点）。

## 第三步：生成创新点

调用 `inno-idea-generation` skill，输入：
1. `.pipeline/docs/gap_matrix.md`
2. `.pipeline/docs/paper_digests.md`（如果存在）
3. `.pipeline/memory/literature_bank.md`

生成 5 个候选创新方向，写入 `.pipeline/docs/idea_board.json`。

**要求：** 每个 idea 必须明确指出突破了哪篇论文的哪个局限性（引用真实 arXiv ID 或标题）。

## 第四步：展示 5 个 idea，等用户筛选

读取 `idea_board.json`，展示：

> 基于 X 篇真实论文阅读，生成了以下 5 个创新方向：
> 1. [Idea A]：突破 [论文 X] 的 [局限性]
> 2. [Idea B]：...
>
> 接下来对这些方向做新颖性和可行性评估。

询问用户：全部评估 / 只评估感兴趣的 / 重新生成

## 第五步：评估打分

调用 `inno-idea-eval` skill，参考 `.pipeline/docs/paper_digests.md` 验证新颖性，对选定的 idea 打分（novelty / feasibility / impact 各 1-5 分），更新 `idea_board.json`。

## 第六步：最终决策

展示评分结果，询问用户选定方向。

用户选定后，更新 `project_truth.md`，将其余方向记录到 `decision_log.md`。
