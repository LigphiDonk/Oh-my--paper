---
name: codex-dispatch
description: Delegate coding tasks to OpenAI Codex CLI
version: "1.0"
stages:
  - experiment
  - analysis
tools:
  - bash
primaryIntent: Invoke Codex as a sub-agent for coding tasks when OpenAI models are preferred
---

# Codex 委派技能

当用户明确要求使用 OpenAI 模型，或需要利用 Codex 的特定能力时，通过 `exec` 工具调用 Codex CLI。

## 适用场景
- 用户要求使用 GPT / o3 / o4 模型
- 需要 OpenAI 特有的代码补全能力
- 与 OpenAI 生态集成的任务

## 调用方式

```bash
codex --approval-mode full-auto \
  -p "<详细任务描述>" \
  --cwd {baseDir}
```

## 注意
- 默认优先使用 Claude Code（推理能力更强）
- 仅在用户明确请求 OpenAI 模型时使用 Codex
- Codex 会自动读取项目上下文
