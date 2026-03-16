import crypto from "node:crypto";
import { spawn } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const cwd = process.cwd();
const templatePath = path.join(cwd, "wrangler.template.toml");
const configPath = path.join(cwd, "wrangler.toml");
const wranglerBin = path.join(
  cwd,
  "node_modules",
  ".bin",
  process.platform === "win32" ? "wrangler.cmd" : "wrangler",
);

function log(message) {
  process.stdout.write(`[ViewerLeaf] ${message}\n`);
}

function readText(filePath) {
  return readFileSync(filePath, "utf8");
}

function writeText(filePath, contents) {
  writeFileSync(filePath, contents, "utf8");
}

function randomSuffix() {
  return crypto.randomBytes(3).toString("hex");
}

function sanitizeName(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function parseTomlString(text, key) {
  const match = text.match(new RegExp(`^${key}\\s*=\\s*"([^"]+)"`, "m"));
  return match?.[1] ?? "";
}

function hasD1Binding(text) {
  return /\[\[d1_databases\]\]/.test(text) && /binding\s*=\s*"DB"/.test(text);
}

function ensureWranglerBinary() {
  if (existsSync(wranglerBin)) {
    return wranglerBin;
  }
  throw new Error("缺少本地 wrangler，可先执行 npm install。");
}

function ensureWranglerConfig() {
  if (!existsSync(templatePath)) {
    throw new Error("缺少 wrangler.template.toml，无法初始化部署模板。");
  }

  const template = readText(templatePath);
  const current = existsSync(configPath) ? readText(configPath) : template;
  let workerName = parseTomlString(current, "name");
  let nextConfig = current;

  if (!workerName || workerName.includes("__VIEWERLEAF_WORKER_NAME__")) {
    workerName = sanitizeName(`viewerleaf-collab-${randomSuffix()}`) || `viewerleaf-collab-${randomSuffix()}`;
    nextConfig = template.replace("__VIEWERLEAF_WORKER_NAME__", workerName);
    writeText(configPath, nextConfig);
    log(`已生成专属 Worker 名称: ${workerName}`);
  } else if (!existsSync(configPath)) {
    writeText(configPath, current);
  }

  return {
    workerName,
    configText: readText(configPath),
  };
}

function runWrangler(args, extraEnv = {}) {
  const executable = ensureWranglerBinary();

  return new Promise((resolve, reject) => {
    const child = spawn(executable, args, {
      cwd,
      env: {
        ...process.env,
        ...extraEnv,
      },
      stdio: ["inherit", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      const text = String(chunk);
      stdout += text;
      process.stdout.write(text);
    });

    child.stderr.on("data", (chunk) => {
      const text = String(chunk);
      stderr += text;
      process.stderr.write(text);
    });

    child.on("error", (error) => {
      reject(error);
    });

    child.on("close", (code) => {
      if (code === 0) {
        resolve({ stdout, stderr });
        return;
      }
      reject(new Error(`wrangler ${args.join(" ")} 失败，退出码 ${code}`));
    });
  });
}

async function ensureDatabase(configText, workerName) {
  if (hasD1Binding(configText)) {
    const databaseName = parseTomlString(configText, "database_name");
    if (databaseName) {
      log(`复用现有 D1 数据库: ${databaseName}`);
    }
    return;
  }

  const suffix = sanitizeName(workerName.replace(/^viewerleaf-collab-?/, "") || randomSuffix());
  const databaseName = sanitizeName(`viewerleaf-${suffix}`) || `viewerleaf-${randomSuffix()}`;
  log(`正在创建 D1 数据库: ${databaseName}`);
  await runWrangler([
    "d1",
    "create",
    databaseName,
    "--binding",
    "DB",
    "--update-config",
    "-c",
    "wrangler.toml",
  ]);
}

function printResolvedUrls(output) {
  const match = output.match(/https:\/\/[a-z0-9._-]+\.workers\.dev\b/i);
  if (!match) {
    log("部署完成，但 Wrangler 输出里没有拿到 workers.dev 地址。");
    log("请在上面的日志中查找你的 Worker URL，并填回 ViewerLeaf 的协作配置。");
    return;
  }

  const httpBaseUrl = match[0].replace(/\/$/, "");
  const wsBaseUrl = httpBaseUrl.replace(/^https:/, "wss:");
  log(`HTTP Base URL: ${httpBaseUrl}`);
  log(`WS Base URL: ${wsBaseUrl}`);
  log("把这两个地址填到 ViewerLeaf 的协作配置后即可使用云协作。");
}

async function main() {
  const { workerName, configText } = ensureWranglerConfig();
  await ensureDatabase(configText, workerName);

  log("正在应用 D1 migrations…");
  await runWrangler(
    ["d1", "migrations", "apply", "DB", "--remote", "-c", "wrangler.toml"],
    { CI: "1" },
  );

  log(`正在部署 Worker: ${workerName}`);
  const deployResult = await runWrangler(["deploy", "-c", "wrangler.toml"]);
  printResolvedUrls(`${deployResult.stdout}\n${deployResult.stderr}`);
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`[ViewerLeaf] 部署失败: ${message}\n`);
  process.exitCode = 1;
});
