/**
 * on-task-complete.mjs
 * 解析 omp_executor_report 块，追加到 review_log.md
 * 手动触发：echo "..." | node scripts/on-task-complete.mjs
 */
import fs from "node:fs/promises";
import path from "node:path";

const PROJECT = process.cwd();

async function main() {
  const stdin = await readStdin();
  if (!stdin.trim()) return;

  const report = extractExecutorReport(stdin);
  if (!report) return;

  const reviewLogPath = path.join(PROJECT, ".pipeline", "memory", "review_log.md");
  const ts = new Date().toISOString().slice(0, 16).replace("T", " ");
  const entry = [
    `\n## Executor Report — ${ts}`,
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

  // hook-event 通知
  const eventsDir = path.join(PROJECT, ".pipeline", ".hook-events");
  await fs.mkdir(eventsDir, { recursive: true });
  await fs.writeFile(
    path.join(eventsDir, `${Date.now()}.json`),
    JSON.stringify({ type: "executor-report", taskId: report.taskId, timestamp: Date.now() }),
    "utf8"
  );

  console.log(`✅ Executor report for '${report.taskId}' added to review_log.md`);
}

function extractExecutorReport(text) {
  const matches = [...text.matchAll(/```omp_executor_report\s*([\s\S]*?)```/g)];
  if (!matches.length) return null;
  try { return JSON.parse(matches[matches.length - 1][1].trim()); } catch { return null; }
}

async function readStdin() {
  if (process.stdin.isTTY) return "";
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  return Buffer.concat(chunks).toString("utf8");
}

main().catch(() => process.exit(0));
