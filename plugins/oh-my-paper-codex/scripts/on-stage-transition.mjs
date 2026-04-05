/**
 * on-stage-transition.mjs
 * 检测阶段任务全部完成时提示推进
 * 手动触发：node scripts/on-stage-transition.mjs
 */
import fs from "node:fs/promises";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const PROJECT = process.cwd();

async function main() {
  const tasksPath = path.join(PROJECT, ".pipeline", "tasks", "tasks.json");
  if (!existsSync(tasksPath)) return;

  let tasks;
  try { tasks = JSON.parse(readFileSync(tasksPath, "utf8")); } catch { return; }

  const briefPath = path.join(PROJECT, ".pipeline", "docs", "research_brief.json");
  let currentStage = "unknown";
  if (existsSync(briefPath)) {
    try { currentStage = JSON.parse(readFileSync(briefPath, "utf8")).currentStage || "unknown"; } catch {}
  }

  const stageTasks = (tasks.tasks || []).filter(t => t.stage === currentStage);
  if (!stageTasks.length) return;
  if (stageTasks.filter(t => t.status === "done").length !== stageTasks.length) return;

  const statePath = path.join(PROJECT, ".pipeline", "memory", "orchestrator_state.md");
  const ts = new Date().toISOString().slice(0, 16).replace("T", " ");
  await fs.mkdir(path.dirname(statePath), { recursive: true });
  await fs.appendFile(
    statePath,
    `\n⚠️ [${ts}] 阶段 '${currentStage}' 所有任务已完成，请运行 /omp-plan 评审并决定是否推进。\n`,
    "utf8"
  );

  const eventsDir = path.join(PROJECT, ".pipeline", ".hook-events");
  await fs.mkdir(eventsDir, { recursive: true });
  await fs.writeFile(
    path.join(eventsDir, `${Date.now()}.json`),
    JSON.stringify({ type: "stage-complete", stage: currentStage, timestamp: Date.now() }),
    "utf8"
  );

  console.log(`✅ Stage '${currentStage}' complete — transition prompt added.`);
}

main().catch(() => process.exit(0));
