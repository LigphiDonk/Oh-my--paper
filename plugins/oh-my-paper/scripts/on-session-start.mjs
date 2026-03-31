/**
 * on-session-start.mjs
 * SessionStart hook — 注入当前任务上下文到 .pipeline/.session-context.md
 */
import fs from "node:fs/promises";
import { existsSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

const PROJECT = process.cwd();
const SESSION_CONTEXT = path.join(PROJECT, ".pipeline", ".session-context.md");
const TTL_MS = 5 * 60 * 1000;

async function main() {
  // 如果已经有新鲜的 context，跳过
  if (existsSync(SESSION_CONTEXT)) {
    if (Date.now() - statSync(SESSION_CONTEXT).mtimeMs < TTL_MS) return;
  }

  // 检查是否是研究项目
  const pipelineDir = path.join(PROJECT, ".pipeline");
  if (!existsSync(pipelineDir)) return;

  const lines = ["# Session Context (Auto-generated)", ""];

  const briefPath = path.join(pipelineDir, "docs", "research_brief.json");
  if (existsSync(briefPath)) {
    try {
      const brief = JSON.parse(readFileSync(briefPath, "utf8"));
      lines.push(`**当前阶段**: ${brief.currentStage || "unknown"}`);
      lines.push(`**研究主题**: ${brief.topic || ""}`);
      lines.push("");
    } catch {}
  }

  const contextPath = path.join(pipelineDir, "memory", "execution_context.md");
  if (existsSync(contextPath)) {
    const content = readFileSync(contextPath, "utf8").trim();
    if (content) {
      lines.push("## 当前任务");
      lines.push(content.split("\n").slice(0, 30).join("\n"));
      lines.push("");
    }
  }

  const handoffPath = path.join(pipelineDir, "memory", "agent_handoff.md");
  if (existsSync(handoffPath)) {
    const content = readFileSync(handoffPath, "utf8");
    const matches = [...content.matchAll(/^## Handoff:.+$/gm)];
    if (matches.length > 0) {
      const last = content.slice(matches[matches.length - 1].index).trim();
      lines.push("## 上一步交接");
      lines.push(last.split("\n").slice(0, 10).join("\n"));
      lines.push("");
    }
  }

  lines.push(`_生成时间: ${new Date().toISOString()}_`);

  await fs.mkdir(path.dirname(SESSION_CONTEXT), { recursive: true });
  await fs.writeFile(SESSION_CONTEXT, lines.join("\n"), "utf8");
}

main().catch(() => process.exit(0));
