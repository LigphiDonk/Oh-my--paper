/**
 * on-session-start.mjs
 *
 * PreToolUse(Bash) 事件触发（首次工具调用）。
 * 读取 execution_context.md + agent_handoff.md，生成上下文摘要，
 * 写入 .pipeline/.session-context.md（5 分钟有效期）。
 * CLAUDE.md 指示 Agent 在启动时读取此文件。
 */

import fs from "node:fs/promises";
import { existsSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

const PROJECT = process.env.OMP_PROJECT_ROOT || process.cwd();
const SESSION_CONTEXT_FILE = path.join(PROJECT, ".pipeline", ".session-context.md");
const TTL_MS = 5 * 60 * 1000; // 5 分钟

async function main() {
  // 避免重复写入（同一 session 内只写一次）
  if (existsSync(SESSION_CONTEXT_FILE)) {
    const stat = statSync(SESSION_CONTEXT_FILE);
    const age = Date.now() - stat.mtimeMs;
    if (age < TTL_MS) return; // 还在有效期内，不重复写
  }

  const lines = ["# Session Context (Auto-generated)", ""];

  // 注入当前阶段
  const briefPath = path.join(PROJECT, ".pipeline", "docs", "research_brief.json");
  if (existsSync(briefPath)) {
    try {
      const brief = JSON.parse(readFileSync(briefPath, "utf8"));
      lines.push(`**当前阶段**: ${brief.currentStage || "unknown"}`);
      lines.push(`**研究主题**: ${brief.topic || ""}`);
      lines.push("");
    } catch {}
  }

  // 注入 execution_context（前 30 行）
  const contextPath = path.join(PROJECT, ".pipeline", "memory", "execution_context.md");
  if (existsSync(contextPath)) {
    const content = readFileSync(contextPath, "utf8").trim();
    if (content) {
      lines.push("## 当前任务（来自 execution_context.md）");
      lines.push(firstNLines(content, 30));
      lines.push("");
    }
  }

  // 注入最新 handoff（24h 内）
  const handoffPath = path.join(PROJECT, ".pipeline", "memory", "agent_handoff.md");
  if (existsSync(handoffPath)) {
    const content = readFileSync(handoffPath, "utf8");
    const lastHandoff = extractRecentHandoff(content, 24 * 60 * 60 * 1000);
    if (lastHandoff) {
      lines.push("## 上一步交接");
      lines.push(lastHandoff);
      lines.push("");
    }
  }

  lines.push(`_生成时间: ${new Date().toISOString()}_`);

  await fs.mkdir(path.dirname(SESSION_CONTEXT_FILE), { recursive: true });
  await fs.writeFile(SESSION_CONTEXT_FILE, lines.join("\n"), "utf8");
}

function firstNLines(text, n) {
  return text.split("\n").slice(0, n).join("\n");
}

function extractRecentHandoff(content, maxAgeMs) {
  const matches = [...content.matchAll(/^## Handoff:.+$/gm)];
  if (matches.length === 0) return null;

  const lastMatch = matches[matches.length - 1];
  const block = content.slice(lastMatch.index).trim();

  // 尝试从 Timestamp 行判断时间
  const tsMatch = block.match(/^Timestamp:\s*(.+)$/m);
  if (tsMatch) {
    try {
      const ts = new Date(tsMatch[1].trim()).getTime();
      if (Date.now() - ts > maxAgeMs) return null;
    } catch {}
  }

  return block;
}

main().catch(() => process.exit(0));
