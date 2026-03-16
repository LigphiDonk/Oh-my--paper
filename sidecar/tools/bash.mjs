import { spawn } from "node:child_process";

const DANGEROUS_PATTERNS = [
  /\brm\s+(-[a-zA-Z]*r[a-zA-Z]*f|-[a-zA-Z]*f[a-zA-Z]*r)[a-zA-Z]*\s+\/(\s|$)/,
  /\bmkfs\b/,
  /\bdd\s+.*\bif=/,
  /:\(\)\s*\{\s*:\|:&\s*\}\s*;/,
  /\b(shutdown|reboot|halt|poweroff)\b/,
];

function isDangerous(command) {
  return DANGEROUS_PATTERNS.some((pattern) => pattern.test(command));
}

function truncateOutput(text, maxLength = 8000) {
  if (text.length <= maxLength) return text;
  const half = Math.floor(maxLength / 2) - 50;
  return (
    text.slice(0, half) +
    `\n\n... [truncated ${text.length - maxLength} chars] ...\n\n` +
    text.slice(-half)
  );
}

export const bashTool = {
  id: "bash",
  description:
    "Run a shell command in the project directory. Use for builds, tests, git, package management, and other CLI tasks.",
  parameters: {
    type: "object",
    properties: {
      command: {
        type: "string",
        description: "The shell command to execute.",
      },
      timeout: {
        type: "number",
        description: "Timeout in seconds. Default 30, max 120.",
      },
    },
    required: ["command"],
  },
  async execute(args, ctx) {
    const command = String(args.command || "").trim();
    if (!command) {
      return { output: "Error: empty command." };
    }

    if (isDangerous(command)) {
      return { output: "Error: this command is blocked for safety reasons." };
    }

    const timeoutSec = Math.min(Math.max(Number(args.timeout) || 30, 1), 120);
    const cwd = ctx.projectRoot || process.cwd();

    return new Promise((resolve) => {
      const child = spawn("sh", ["-c", command], {
        cwd,
        env: { ...process.env, TERM: "dumb" },
        timeout: timeoutSec * 1000,
        stdio: ["ignore", "pipe", "pipe"],
      });

      let stdout = "";
      let stderr = "";

      child.stdout.on("data", (data) => {
        stdout += data.toString();
      });
      child.stderr.on("data", (data) => {
        stderr += data.toString();
      });

      child.on("error", (err) => {
        resolve({ output: `Error spawning command: ${err.message}` });
      });

      child.on("close", (code) => {
        const combined = (
          stdout + (stderr ? `\n[stderr]\n${stderr}` : "")
        ).trim();
        const output = truncateOutput(
          combined || `(no output, exit code ${code})`,
        );
        resolve({
          output: code === 0 ? output : `[exit code ${code}]\n${output}`,
        });
      });
    });
  },
};
