/**
 * on-task-complete.mjs
 *
 * Stop 事件触发。
 * 解析最后一个 omp_executor_report 块，追加到 review_log.md，
 * 并写 .pipeline/.hook-events/<ts>.json 通知 Tauri app 刷新任务状态。
 */

import fs from "node:fs/promises";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const PROJECT = process.env.OMP_PROJECT_ROOT || process.cwd();

async function main() {
  // Claude Code 通过环境变量传递 session 输出（CLAUDE_SESSION_OUTPUT 或类似）
  // 也可以读取 ~/.claude/projects/<encoded>/last-session.jsonl
  // 此处从 stdin 读取（Claude Code Stop hook 将 session 内容传入 stdin）
  const stdin = await readStdin();
  if (!stdin.trim()) return;

  const report = extractExecutorReport(stdin);
  if (!report) return;

  // 追加到 review_log.md
  const reviewLogPath = path.join(PROJECT, ".pipeline", "memory", "review_log.md");
  const timestamp = new Date().toISOString().slice(0, 16).replace("T", " ");
  const entry = [
    `\n## Executor Report — ${timestamp}`,
    `**Task**: ${report.taskId || "unknown"}`,
    `**Summary**: ${report.summary || ""}`,
    `**Confidence**: ${report.confidence || "unknown"}`,
    report.artifacts?.length ? `**Artifacts**: ${report.artifacts.join(", ")}` : "",
    report.issues?.length ? `**Issues**: ${report.issues.join("; ")}` : "",
    "**Status**: ⏳ pending-review",
    "",
  ].filter(Boolean).join("\n");

  await fs.mkdir(path.dirname(reviewLogPath), { recursive: true });
  await fs.appendFile(reviewLogPath, entry + "\n", "utf8");

  // 写 hook-event 通知 Tauri
  const eventsDir = path.join(PROJECT, ".pipeline", ".hook-events");
  await fs.mkdir(eventsDir, { recursive: true });
  const eventFile = path.join(eventsDir, `${Date.now()}.json`);
  await fs.writeFile(eventFile, JSON.stringify({
    type: "executor-report",
    taskId: report.taskId,
    summary: report.summary,
    confidence: report.confidence,
    timestamp: Date.now(),
  }), "utf8");
}

function extractExecutorReport(text) {
  // 匹配最后一个 omp_executor_report 块
  const matches = [...text.matchAll(/```omp_executor_report\s*([\s\S]*?)```/g)];
  if (matches.length === 0) return null;

  const lastMatch = matches[matches.length - 1];
  try {
    return JSON.parse(lastMatch[1].trim());
  } catch {
    return null;
  }
}

async function readStdin() {
  if (process.stdin.isTTY) return "";
  const chunks = [];
  for await (const chunk of process.stdin) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString("utf8");
}

main().catch(() => {
  // Hook 失败不应中断 Claude Code，静默退出
  process.exit(0);
});
