import { detectCliStatus } from "./resolve-cli.mjs";

/**
 * Detect Claude Code CLI availability.
 */
export async function detectClaudeCode() {
  return detectCliStatus("claude-code");
}

/**
 * Detect OpenAI Codex CLI availability.
 */
export async function detectCodex() {
  return detectCliStatus("codex");
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
