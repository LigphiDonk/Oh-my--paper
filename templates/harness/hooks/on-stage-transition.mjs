/**
 * on-stage-transition.mjs
 *
 * PostToolUse(Write) 事件触发。
 * 当检测到 tasks.json 被写入时，检查当前阶段是否所有任务完成，
 * 若完成则在 orchestrator_state.md 追加阶段推进提示。
 */

import fs from "node:fs/promises";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const PROJECT = process.env.OMP_PROJECT_ROOT || process.cwd();

async function main() {
  // 读取 Claude Code hook 传入的 tool input（PostToolUse 环境变量）
  const toolInput = JSON.parse(process.env.CLAUDE_TOOL_INPUT || "{}");
  const filePath = toolInput.file_path || toolInput.path || "";

  // 只关心 tasks.json 的写入
  if (!filePath.includes("tasks.json")) return;

  const tasksPath = path.join(PROJECT, ".pipeline", "tasks", "tasks.json");
  if (!existsSync(tasksPath)) return;

  let tasks;
  try {
    tasks = JSON.parse(readFileSync(tasksPath, "utf8"));
  } catch {
    return;
  }

  // 读取 research_brief.json 获取当前阶段
  const briefPath = path.join(PROJECT, ".pipeline", "docs", "research_brief.json");
  let currentStage = "unknown";
  if (existsSync(briefPath)) {
    try {
      const brief = JSON.parse(readFileSync(briefPath, "utf8"));
      currentStage = brief.currentStage || "unknown";
    } catch {}
  }

  // 检查当前阶段的任务完成情况
  const stageTasks = (tasks.tasks || []).filter(
    (t) => t.stage === currentStage
  );
  if (stageTasks.length === 0) return;

  const doneTasks   = stageTasks.filter((t) => t.status === "done");
  const totalTasks  = stageTasks.length;
  const allDone     = doneTasks.length === totalTasks;

  if (!allDone) return;

  // 所有任务完成，在 orchestrator_state.md 追加提示
  const statePath = path.join(PROJECT, ".pipeline", "memory", "orchestrator_state.md");
  const timestamp = new Date().toISOString().slice(0, 16).replace("T", " ");
  const notice = `\n⚠️ [${timestamp}] 阶段 '${currentStage}' 的所有 ${totalTasks} 个任务已完成。Orchestrator 应评审并决定是否推进到下一阶段。\n`;

  await fs.mkdir(path.dirname(statePath), { recursive: true });
  await fs.appendFile(statePath, notice, "utf8");

  // 写 hook-event 通知 Tauri
  const eventsDir = path.join(PROJECT, ".pipeline", ".hook-events");
  await fs.mkdir(eventsDir, { recursive: true });
  await fs.writeFile(
    path.join(eventsDir, `${Date.now()}.json`),
    JSON.stringify({
      type: "stage-complete",
      stage: currentStage,
      tasksCompleted: doneTasks.length,
      timestamp: Date.now(),
    }),
    "utf8"
  );
}

main().catch(() => process.exit(0));
