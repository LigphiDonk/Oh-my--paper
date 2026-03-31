# Agent Handoff

Agent 间交接上下文。当一个 Agent 完成工作并移交给下一个时写入此文件。
接收方 Agent 在启动时读取最近的 Handoff 块（24h 内）。

<!-- 格式：
## Handoff: [from-agent] → [to-agent]
Timestamp: YYYY-MM-DD HH:MM
Context: [完成了什么，当前状态]
Artifacts: [产出文件路径列表]
Open Questions: [遗留的未解决问题]
Do Not: [下一个 Agent 应避免的做法]
-->
