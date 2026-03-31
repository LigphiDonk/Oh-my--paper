/**
 * dispatch-agent.mjs
 *
 * 通过 tmux 启动子 Agent（Codex 或 Claude），发送任务，轮询哨兵文件，返回结果。
 * Claude（Orchestrator）通过 Bash 工具调用此脚本，实现自主 Agent-to-Agent 派遣。
 *
 * 用法：
 *   node dispatch-agent.mjs --agent codex --task "描述" [--timeout 300] [--no-wait] [--task-id custom-id]
 *
 * 通信协议（哨兵文件）：
 *   .pipeline/.dispatch/<task-id>/
 *     task.md     ← 此脚本写入：任务提示词（含上下文）
 *     status      ← Agent 写入：running | done | error
 *     result.md   ← Agent 写入：oh-my-paper_executor_report 块
 *     log.txt     ← 此脚本写入：tmux capture-pane 原始输出
 */

import { execSync, execFileSync } from "node:child_process";
import fs from "node:fs/promises";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import os from "node:os";
import { parseArgs } from "node:util";

// ─── CLI 参数解析 ─────────────────────────────────────────────────────────────

const { values: args } = parseArgs({
  options: {
    agent:   { type: "string",  default: "codex" },
    task:    { type: "string",  default: "" },
    timeout: { type: "string",  default: "300" },
    "no-wait": { type: "boolean", default: false },
    "task-id": { type: "string", default: "" },
    "project-root": { type: "string", default: process.cwd() },
  },
  strict: false,
});

const AGENT      = args.agent;
const TASK_DESC  = args.task;
const TIMEOUT_S  = parseInt(args.timeout, 10);
const NO_WAIT    = args["no-wait"];
const PROJECT    = path.resolve(args["project-root"]);
const TASK_ID    = args["task-id"] || `task-${Date.now()}`;
const TMUX_SESSION = "viwerleaf";

// ─── 主流程 ───────────────────────────────────────────────────────────────────

async function main() {
  const dispatchDir = path.join(PROJECT, ".pipeline", ".dispatch", TASK_ID);
  await fs.mkdir(dispatchDir, { recursive: true });

  // 1. 构建任务提示词（注入项目上下文）
  const prompt = await buildTaskPrompt(TASK_DESC, dispatchDir);
  await fs.writeFile(path.join(dispatchDir, "task.md"), prompt, "utf8");
  await fs.writeFile(path.join(dispatchDir, "status"), "pending", "utf8");

  // 2. 确保 tmux session 存在
  ensureTmuxSession(PROJECT);

  // 3. 在新 tmux window 启动 Agent
  const windowName = `dispatch-${TASK_ID.slice(-8)}`;
  const cmd = buildAgentCommand(AGENT, dispatchDir, PROJECT);

  execSync(`tmux new-window -t "${TMUX_SESSION}" -n "${windowName}"`);
  // 写入 running 状态后再启动 agent
  const fullCmd = [
    `cd ${shellQuote(PROJECT)}`,
    `echo running > ${shellQuote(path.join(dispatchDir, "status"))}`,
    cmd,
    // Agent 完成后写 done（作为补充机制，agent 自身也会写）
    `echo done > ${shellQuote(path.join(dispatchDir, "status"))}`,
  ].join(" && ");

  execSync(`tmux send-keys -t "${TMUX_SESSION}:${windowName}" ${shellQuote(fullCmd)} Enter`);

  console.log(`[dispatch] task=${TASK_ID} agent=${AGENT} window=${windowName}`);
  console.log(`[dispatch] dispatch dir: ${dispatchDir}`);

  if (NO_WAIT) {
    // 异步模式：打印 task-id 供 wait-all.mjs 使用，立即退出
    console.log(`[dispatch:task-id] ${TASK_ID}`);
    return;
  }

  // 4. 同步等待完成
  const result = await pollForCompletion(dispatchDir, TIMEOUT_S);

  // 5. 捕获 tmux 输出到 log.txt
  try {
    const log = execSync(
      `tmux capture-pane -t "${TMUX_SESSION}:${windowName}" -p`,
      { encoding: "utf8" }
    );
    await fs.writeFile(path.join(dispatchDir, "log.txt"), log, "utf8");
  } catch {
    // window 可能已经关闭，忽略
  }

  // 6. 关闭 tmux window（保持整洁）
  try {
    execSync(`tmux kill-window -t "${TMUX_SESSION}:${windowName}"`);
  } catch {
    // 已关闭则忽略
  }

  if (result.status === "error") {
    console.error(`[dispatch] Agent 报告错误:\n${result.content}`);
    process.exit(1);
  }

  // 7. 输出结果供 Claude 读取
  console.log(`[dispatch:done] task=${TASK_ID}`);
  console.log(`[dispatch:result-path] ${path.join(dispatchDir, "result.md")}`);
  if (result.content) {
    console.log("\n─── Agent Result ───────────────────────────────────────");
    console.log(result.content);
    console.log("────────────────────────────────────────────────────────");
  }
}

// ─── 任务提示词构建 ───────────────────────────────────────────────────────────

async function buildTaskPrompt(taskDesc, dispatchDir) {
  const lines = [];

  lines.push("# Oh My Paper Executor Task");
  lines.push("");
  lines.push("你是一个 Oh My Paper 研究项目的执行者（Executor）。");
  lines.push("完成以下任务后，**必须**将结果写入指定文件并更新状态。");
  lines.push("");

  // 注入项目上下文
  const truthPath = path.join(PROJECT, ".pipeline", "memory", "project_truth.md");
  if (existsSync(truthPath)) {
    const truth = readFileSync(truthPath, "utf8").trim();
    if (truth) {
      lines.push("## 项目基本信息（只读）");
      lines.push("```");
      lines.push(truncate(truth, 800));
      lines.push("```");
      lines.push("");
    }
  }

  // 注入最新 handoff 上下文
  const handoffPath = path.join(PROJECT, ".pipeline", "memory", "agent_handoff.md");
  if (existsSync(handoffPath)) {
    const handoff = readFileSync(handoffPath, "utf8").trim();
    const lastHandoff = extractLastHandoff(handoff);
    if (lastHandoff) {
      lines.push("## 上一步交接上下文");
      lines.push(truncate(lastHandoff, 400));
      lines.push("");
    }
  }

  // 注入 decision_log（防止重复错误）
  const decisionPath = path.join(PROJECT, ".pipeline", "memory", "decision_log.md");
  if (existsSync(decisionPath)) {
    const decisions = readFileSync(decisionPath, "utf8").trim();
    if (decisions) {
      lines.push("## 已被否决的方向（不要重蹈覆辙）");
      lines.push(truncate(decisions, 400));
      lines.push("");
    }
  }

  // 核心任务
  lines.push("## 你的任务");
  lines.push(taskDesc);
  lines.push("");

  // 输出要求
  const resultPath = path.join(dispatchDir, "result.md");
  const statusPath = path.join(dispatchDir, "status");
  lines.push("## 完成要求");
  lines.push("1. 完成任务后，将结果（含 `oh-my-paper_executor_report` 块）写入：");
  lines.push(`   \`${resultPath}\``);
  lines.push("2. 写入完成后，执行：");
  lines.push(`   \`echo done > ${statusPath}\``);
  lines.push("3. 如遇到无法解决的错误，写入错误说明到 result.md 后执行：");
  lines.push(`   \`echo error > ${statusPath}\``);
  lines.push("");
  lines.push("**重要**：不要询问用户，不要等待确认，直接执行完成。");

  return lines.join("\n");
}

// ─── Agent 命令构建 ────────────────────────────────────────────────────────────

function buildAgentCommand(agent, dispatchDir, projectRoot) {
  const taskFile = shellQuote(path.join(dispatchDir, "task.md"));

  if (agent === "codex") {
    // codex --full-auto 模式：无需交互确认
    return `codex --full-auto -p "$(cat ${taskFile})"`;
  }

  if (agent === "claude") {
    // claude --print 模式：非交互，读取 stdin 或 -p 参数
    return `claude --print -p "$(cat ${taskFile})"`;
  }

  throw new Error(`不支持的 agent 类型: ${agent}。支持: codex, claude`);
}

// ─── 轮询哨兵文件 ─────────────────────────────────────────────────────────────

async function pollForCompletion(dispatchDir, timeoutSeconds) {
  const statusFile = path.join(dispatchDir, "status");
  const resultFile = path.join(dispatchDir, "result.md");
  const deadline = Date.now() + timeoutSeconds * 1000;
  const pollInterval = 5000; // 5 秒轮询一次

  process.stderr.write(`[dispatch] 等待 Agent 完成 (timeout=${timeoutSeconds}s)...\n`);

  while (Date.now() < deadline) {
    await sleep(pollInterval);

    if (!existsSync(statusFile)) continue;

    const status = readFileSync(statusFile, "utf8").trim();

    if (status === "done" || status === "error") {
      const content = existsSync(resultFile)
        ? readFileSync(resultFile, "utf8").trim()
        : "";
      process.stderr.write(`\n[dispatch] Agent 完成，status=${status}\n`);
      return { status, content };
    }

    // 显示进度
    process.stderr.write(".");
  }

  // 超时
  process.stderr.write(`\n[dispatch] 超时 (${timeoutSeconds}s)\n`);

  // 写超时状态
  await fs.writeFile(statusFile, "error", "utf8");
  await fs.writeFile(
    resultFile,
    `# Timeout\n\nAgent 在 ${timeoutSeconds}s 内未完成任务。`,
    "utf8"
  );

  return { status: "error", content: `Timeout after ${timeoutSeconds}s` };
}

// ─── tmux Session 管理 ────────────────────────────────────────────────────────

function ensureTmuxSession(projectRoot) {
  try {
    // 检查 session 是否存在
    execSync(`tmux has-session -t "${TMUX_SESSION}"`, { stdio: "ignore" });
  } catch {
    // 不存在则创建
    execSync(
      `tmux new-session -d -s "${TMUX_SESSION}" -c ${shellQuote(projectRoot)}`,
    );
    console.log(`[dispatch] 已创建 tmux session: ${TMUX_SESSION}`);
  }
}

// ─── 工具函数 ─────────────────────────────────────────────────────────────────

function shellQuote(str) {
  return `'${str.replace(/'/g, "'\\''")}'`;
}

function truncate(str, maxLen) {
  if (str.length <= maxLen) return str;
  return str.slice(0, maxLen) + `\n...(截断，共 ${str.length} 字符)`;
}

function extractLastHandoff(content) {
  const matches = [...content.matchAll(/^## Handoff:.+$/gm)];
  if (matches.length === 0) return null;
  const lastMatch = matches[matches.length - 1];
  return content.slice(lastMatch.index).trim();
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ─── 入口 ─────────────────────────────────────────────────────────────────────

main().catch((err) => {
  console.error(`[dispatch] 错误: ${err.message}`);
  process.exit(1);
});
