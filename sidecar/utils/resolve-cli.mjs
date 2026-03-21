import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const CLI_CONFIG = {
  "claude-code": {
    label: "Claude Code",
    command: "claude",
    envKeys: [
      "VIEWERLEAF_CLAUDE_PATH",
      "CLAUDE_CLI_PATH",
      "CLAUDE_CODE_PATH",
    ],
  },
  codex: {
    label: "Codex",
    command: "codex",
    envKeys: ["VIEWERLEAF_CODEX_PATH", "CODEX_CLI_PATH"],
  },
};

export async function detectCliStatus(name) {
  const resolved = await resolveCliExecutable(name);
  return {
    name,
    available: resolved.available,
    path: resolved.path,
    version: resolved.version,
  };
}

export async function requireCliExecutable(name) {
  const resolved = await resolveCliExecutable(name);
  if (resolved.available && resolved.path) {
    return resolved.path;
  }

  const config = getCliConfig(name);
  throw new Error(
    `${config.label} CLI not found. Install the local ${config.command} command or set ${config.envKeys.join(
      " / ",
    )} to its executable path.`,
  );
}

export async function resolveCliExecutable(name) {
  const config = getCliConfig(name);
  const seen = new Set();
  const candidates = [];

  for (const envKey of config.envKeys) {
    const value = process.env[envKey];
    if (value && value.trim()) {
      candidates.push(value.trim());
    }
  }

  const currentPathMatch = await resolveOnCurrentPath(config.command);
  if (currentPathMatch) {
    candidates.push(currentPathMatch);
  }

  const loginShellMatch = await resolveFromLoginShell(config.command);
  if (loginShellMatch) {
    candidates.push(loginShellMatch);
  }

  candidates.push(...buildCommonCandidates(config.command));

  for (const rawCandidate of candidates) {
    const candidate = normalizeCandidate(rawCandidate);
    if (!candidate || seen.has(candidate)) {
      continue;
    }
    seen.add(candidate);

    const version = await readVersion(candidate);
    if (version) {
      return {
        available: true,
        path: candidate,
        version,
      };
    }
  }

  return { available: false };
}

function getCliConfig(name) {
  const config = CLI_CONFIG[name];
  if (!config) {
    throw new Error(`Unsupported CLI name: ${name}`);
  }
  return config;
}

function normalizeCandidate(candidate) {
  if (!candidate) {
    return null;
  }

  const trimmed = expandHome(candidate.trim());
  if (!trimmed) {
    return null;
  }

  if (looksLikePath(trimmed)) {
    return path.resolve(trimmed);
  }

  return trimmed;
}

function looksLikePath(candidate) {
  return (
    path.isAbsolute(candidate) ||
    candidate.includes("/") ||
    candidate.includes("\\") ||
    candidate.startsWith(".")
  );
}

function expandHome(candidate) {
  if (candidate === "~") {
    return os.homedir();
  }
  if (candidate.startsWith("~/") || candidate.startsWith("~\\")) {
    return path.join(os.homedir(), candidate.slice(2));
  }
  return candidate;
}

async function resolveOnCurrentPath(command) {
  const locator = process.platform === "win32" ? "where" : "which";

  try {
    const { stdout } = await execFileAsync(locator, [command], {
      timeout: 10_000,
      windowsHide: true,
    });
    return firstExistingPath(stdout);
  } catch {
    return null;
  }
}

async function resolveFromLoginShell(command) {
  if (process.platform === "win32") {
    return null;
  }

  const shells = unique([
    process.env.SHELL,
    "/bin/zsh",
    "/bin/bash",
  ]).filter(Boolean);

  for (const shell of shells) {
    try {
      const { stdout } = await execFileAsync(
        shell,
        ["-lc", `command -v ${command}`],
        {
          timeout: 10_000,
          windowsHide: true,
        },
      );
      const resolved = firstExistingPath(stdout);
      if (resolved) {
        return resolved;
      }
    } catch {
      // Fall through to the next shell.
    }
  }

  return null;
}

function buildCommonCandidates(command) {
  const names = process.platform === "win32"
    ? [`${command}.cmd`, `${command}.exe`, `${command}.bat`, command]
    : [command];

  const directories = process.platform === "win32"
    ? unique([
        path.join(process.env.APPDATA || path.join(os.homedir(), "AppData", "Roaming"), "npm"),
        path.join(process.env.ProgramFiles || "C:\\Program Files", "nodejs"),
        path.join(
          process.env["ProgramFiles(x86)"] || "C:\\Program Files (x86)",
          "nodejs",
        ),
      ])
    : unique([
        "/opt/homebrew/bin",
        "/usr/local/bin",
        "/usr/bin",
        path.join(os.homedir(), ".local", "bin"),
        path.join(os.homedir(), ".npm-global", "bin"),
        path.join(os.homedir(), ".yarn", "bin"),
        path.join(os.homedir(), ".bun", "bin"),
        path.join(os.homedir(), "Library", "pnpm"),
        path.join(os.homedir(), "bin"),
      ]);

  return directories.flatMap((directory) =>
    names.map((name) => path.join(directory, name)),
  );
}

function firstExistingPath(stdout) {
  const candidates = String(stdout || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  for (const candidate of candidates) {
    const normalized = normalizeCandidate(candidate);
    if (!normalized) {
      continue;
    }
    if (!looksLikePath(normalized)) {
      continue;
    }
    if (existsSync(normalized)) {
      return normalized;
    }
  }

  return null;
}

async function readVersion(executablePath) {
  try {
    const { stdout, stderr } = await execFileAsync(
      executablePath,
      ["--version"],
      {
        timeout: 10_000,
        windowsHide: true,
      },
    );
    return extractVersion(stdout, stderr);
  } catch {
    return null;
  }
}

function extractVersion(stdout, stderr) {
  const text = `${stdout || ""}\n${stderr || ""}`
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find(Boolean);

  if (!text) {
    return "unknown";
  }

  const semverMatch = text.match(/\b\d+\.\d+\.\d+(?:[-+._0-9A-Za-z]*)?\b/);
  if (semverMatch) {
    return semverMatch[0];
  }

  return text.replace(/^[vV]/, "");
}

function unique(values) {
  return [...new Set(values)];
}
