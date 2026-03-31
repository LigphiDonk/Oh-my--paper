/**
 * wait-all.mjs
 *
 * 等待多个并行 dispatch 任务全部完成。
 * 配合 dispatch-agent.mjs --no-wait 使用。
 *
 * 用法：
 *   node wait-all.mjs --tasks task-1234,task-5678 [--timeout 600]
 *
 * 或从 stdin 读取 task-id 列表（每行一个，dispatch --no-wait 输出的 [dispatch:task-id] 行）：
 *   node dispatch-agent.mjs --no-wait --task "搜 CV 文献" | \
 *   node dispatch-agent.mjs --no-wait --task "搜 NLP 文献" | \
 *   node wait-all.mjs --from-stdin
 */

import fs from "node:fs/promises";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";
import readline from "node:readline";

const { values: args } = parseArgs({
  options: {
    tasks:        { type: "string",  default: "" },
    timeout:      { type: "string",  default: "600" },
    "from-stdin": { type: "boolean", default: false },
    "project-root": { type: "string", default: process.cwd() },
  },
  strict: false,
});

const PROJECT    = path.resolve(args["project-root"]);
const TIMEOUT_S  = parseInt(args.timeout, 10);

async function main() {
  let taskIds = [];

  if (args["from-stdin"]) {
    taskIds = await readTaskIdsFromStdin();
  } else if (args.tasks) {
    taskIds = args.tasks.split(",").map((t) => t.trim()).filter(Boolean);
  } else {
    console.error("[wait-all] 需要 --tasks task-id1,task-id2 或 --from-stdin");
    process.exit(1);
  }

  if (taskIds.length === 0) {
    console.log("[wait-all] 没有任务需要等待");
    return;
  }

  console.log(`[wait-all] 等待 ${taskIds.length} 个任务: ${taskIds.join(", ")}`);

  const results = await waitAll(taskIds, TIMEOUT_S);

  // 汇总输出
  let anyError = false;
  for (const { taskId, status, resultPath } of results) {
    if (status === "done") {
      console.log(`[wait-all] ✓ ${taskId} → ${resultPath}`);
    } else {
      console.error(`[wait-all] ✗ ${taskId} → ${status}`);
      anyError = true;
    }
  }

  if (anyError) process.exit(1);
}

async function waitAll(taskIds, timeoutSeconds) {
  const deadline = Date.now() + timeoutSeconds * 1000;
  const pending = new Set(taskIds);
  const results = [];

  while (pending.size > 0 && Date.now() < deadline) {
    await sleep(5000);

    for (const taskId of [...pending]) {
      const dispatchDir = path.join(PROJECT, ".pipeline", ".dispatch", taskId);
      const statusFile  = path.join(dispatchDir, "status");
      const resultFile  = path.join(dispatchDir, "result.md");

      if (!existsSync(statusFile)) continue;

      const status = readFileSync(statusFile, "utf8").trim();
      if (status === "done" || status === "error") {
        pending.delete(taskId);
        results.push({ taskId, status, resultPath: resultFile });
        process.stderr.write(`\n[wait-all] ${taskId}: ${status}\n`);
      }
    }

    if (pending.size > 0) {
      process.stderr.write(`.[${pending.size}]`);
    }
  }

  // 超时的任务标记为 error
  for (const taskId of pending) {
    const dispatchDir = path.join(PROJECT, ".pipeline", ".dispatch", taskId);
    results.push({
      taskId,
      status: "timeout",
      resultPath: path.join(dispatchDir, "result.md"),
    });
  }

  return results;
}

async function readTaskIdsFromStdin() {
  const ids = [];
  const rl = readline.createInterface({ input: process.stdin });

  for await (const line of rl) {
    // dispatch --no-wait 输出格式: [dispatch:task-id] task-1234567890
    const match = line.match(/\[dispatch:task-id\]\s+(\S+)/);
    if (match) {
      ids.push(match[1]);
    }
  }

  return ids;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

main().catch((err) => {
  console.error(`[wait-all] 错误: ${err.message}`);
  process.exit(1);
});
