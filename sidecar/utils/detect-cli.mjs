import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

/**
 * Try to run a CLI command and capture version output.
 * @param {string} command
 * @param {string[]} args
 * @returns {Promise<{available: boolean, path?: string, version?: string}>}
 */
async function probe(command, args = ["--version"]) {
  try {
    const { stdout } = await execFileAsync(command, args, { timeout: 10000 });
    const version = stdout.trim().split("\n")[0] || "unknown";
    return { available: true, path: command, version };
  } catch {
    return { available: false };
  }
}

/**
 * Detect Claude Code CLI availability.
 */
export async function detectClaudeCode() {
  // Try "claude" command (standard install)
  const result = await probe("claude", ["--version"]);
  return { name: "claude-code", ...result };
}

/**
 * Detect OpenAI Codex CLI availability.
 */
export async function detectCodex() {
  const result = await probe("codex", ["--version"]);
  return { name: "codex", ...result };
}

/**
 * Detect all supported CLI agents.
 * @returns {Promise<Array<{name: string, available: boolean, path?: string, version?: string}>>}
 */
export async function detectAllCliAgents() {
  const [claudeCode, codex] = await Promise.all([
    detectClaudeCode(),
    detectCodex(),
  ]);
  return [claudeCode, codex];
}
