---
description: 全自动文献调研：下载真实论文 PDF 并 OCR，再执行搜索和 gap 分析
---

你是 Oh My Paper Orchestrator。执行文献调研前先和用户对齐方向，然后下载真实论文 PDF 并 OCR。

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
>
> 目标：约 20-30 篇，已有 X 篇
> 工具：literature-pdf-ocr-library（真实 PDF + OCR）+ inno-deep-research

询问：确认 / 调整方向 / 我有 arXiv ID 列表直接下载

## 第三步：询问 OCR 方式（必须在下载前确认）

询问用户：
- 使用 PaddleOCR API（高质量，需要提供 PADDLEOCR_TOKEN）
- 使用 pdfminer 本地模式（纯文本，无需 Token）——需用户再次确认
- 只下载 PDF，暂不 OCR

**不得在没有用户确认的情况下切换到 pdfminer。**
**不得将 PADDLEOCR_TOKEN 写入任何文件。**

## 第四步：执行下载 + OCR（仅在确认后）

corpus-name 根据研究主题自动命名（如 `humanoid-locomotion`）。

```bash
# 下载（按 ID 或关键词）
python .claude/skills/literature-pdf-ocr-library/scripts/search_and_download_papers.py \
  --arxiv-ids <id1> <id2> ... \
  --out-dir .pipeline/literature/<corpus-name> \
  --download-pdfs

# OCR（PaddleOCR，用户已提供 Token）
export PADDLEOCR_TOKEN="<用户提供>"
python .claude/skills/literature-pdf-ocr-library/scripts/paddleocr_layout_to_markdown.py \
  .pipeline/literature/<corpus-name>/papers/*/paper.pdf \
  --output-dir .pipeline/literature/<corpus-name>/papers \
  --skip-existing

# 或 pdfminer（用户已确认）
python .claude/skills/literature-pdf-ocr-library/scripts/paddleocr_layout_to_markdown.py \
  .pipeline/literature/<corpus-name>/papers/*/paper.pdf \
  --output-dir .pipeline/literature/<corpus-name>/papers \
  --fallback-pdfminer

# 生成索引
python .claude/skills/literature-pdf-ocr-library/scripts/build_library_index.py \
  --library-root .pipeline/literature/<corpus-name>
```

补充调用 `inno-deep-research` skill 搜索 OCR 没有覆盖的方向。

将所有论文逐条追加到 `.pipeline/memory/literature_bank.md`：
```
| [URL] | Title | Year | Venue | Relevance | accepted | Date | OCR路径 |
```
OCR 路径填实际路径（无 OCR 填 `none`）。

完成后生成 `.pipeline/docs/gap_matrix.md`，更新 `.pipeline/memory/agent_handoff.md`。

## 第五步：展示结果摘要

告知用户下载/OCR/搜索结果，询问：
- 够了，进入 `/omp-ideate`
- 还需要补充搜索某个方向
- 看看 gap_matrix 后再决定
