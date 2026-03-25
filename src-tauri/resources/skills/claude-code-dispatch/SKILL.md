---
name: claude-code-dispatch
description: Delegate complex coding tasks to Claude Code CLI
version: "1.0"
stages:
  - experiment
  - analysis
tools:
  - bash
primaryIntent: Invoke Claude Code as a sub-agent for complex coding tasks
---

# Claude Code 委派技能

当你需要完成以下类型的复杂编码任务时，通过 `exec` 工具调用 Claude Code CLI：

## 适用场景
- 多文件代码重构
- 复杂 bug 调试
- 编写新的训练/评估/数据处理脚本
- 大规模代码修改（超过 50 行）
- 需要深度代码理解的任务

## 调用方式

```bash
claude --print --dangerously-skip-permissions \
  --model claude-opus-4-6 \
  -p "<详细任务描述，包含上下文、文件路径、预期结果>" \
  --cwd {baseDir}
```

## 最佳实践
1. 提供尽可能详细的任务描述，包含相关文件路径
2. 指定预期结果和验证标准
3. 对于实验代码修改，先说明当前代码逻辑再描述修改目标
4. Claude Code 会自动读取项目中的 CLAUDE.md 获取上下文

## 示例

```bash
# 优化数据加载器性能
claude --print --dangerously-skip-permissions \
  -p "优化 src/data/loader.py 中的 DataLoader 类，当前加载 10GB 数据集需要 5 分钟，目标是减少到 1 分钟以内。可以考虑使用 memory mapping、多进程预加载、或更高效的序列化格式。" \
  --cwd {baseDir}
```
