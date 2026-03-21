import { execFileSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";

const RESEARCH_SKILL_IDS = [
  "academic-researcher",
  "biorxiv-database",
  "bioinformatics-init-analysis",
  "dataset-discovery",
  "gemini-deep-research",
  "inno-code-survey",
  "inno-deep-research",
  "inno-experiment-analysis",
  "inno-experiment-dev",
  "inno-figure-gen",
  "inno-grant-proposal",
  "inno-idea-eval",
  "inno-idea-generation",
  "inno-paper-reviewer",
  "inno-paper-writing",
  "inno-pipeline-planner",
  "inno-prepare-resources",
  "inno-rclone-to-overleaf",
  "inno-reference-audit",
  "making-academic-presentations",
  "ml-paper-writing",
  "paper-analyzer",
  "paper-finder",
  "paper-image-extractor",
  "research-news",
  "scientific-writing",
];

const STAGE_FALLBACKS = {
  "academic-researcher": ["survey", "publication"],
  "biorxiv-database": ["survey"],
  "bioinformatics-init-analysis": ["experiment"],
  "dataset-discovery": ["survey", "ideation", "experiment"],
  "gemini-deep-research": ["survey"],
  "inno-code-survey": ["ideation", "experiment"],
  "inno-deep-research": ["survey", "ideation", "experiment", "publication"],
  "inno-experiment-analysis": ["experiment"],
  "inno-experiment-dev": ["experiment"],
  "inno-figure-gen": ["publication"],
  "inno-grant-proposal": ["publication"],
  "inno-idea-eval": ["ideation"],
  "inno-idea-generation": ["ideation"],
  "inno-paper-reviewer": ["publication"],
  "inno-paper-writing": ["publication"],
  "inno-pipeline-planner": ["survey", "ideation", "experiment", "publication", "promotion"],
  "inno-prepare-resources": ["survey", "ideation"],
  "inno-rclone-to-overleaf": ["publication"],
  "inno-reference-audit": ["publication"],
  "making-academic-presentations": ["promotion"],
  "ml-paper-writing": ["publication"],
  "paper-analyzer": ["survey", "publication"],
  "paper-finder": ["survey"],
  "paper-image-extractor": ["publication"],
  "research-news": ["survey"],
  "scientific-writing": ["publication"],
};

const DEFAULT_TOOLS = ["read_file", "search_project", "write_file"];

const repoRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const outputSkillsRoot = path.join(repoRoot, "skills");
const outputCatalogPath = path.join(outputSkillsRoot, "research-catalog.json");
const outputStageMapPath = path.join(outputSkillsRoot, "research-stage-map.json");
const outputScopePath = path.join(outputSkillsRoot, "research-scope.json");

function main() {
  const options = parseArgs(process.argv.slice(2));
  const sourceRoot = resolveSourceRoot(options.source);
  const sourceSkillsRoot = path.join(sourceRoot, "skills");
  const sourceCatalog = readJson(path.join(sourceRoot, "skills", "skills-catalog-v2.json"));
  const sourceStageMap = readJson(path.join(sourceRoot, "skills", "stage-skill-map.json"));
  const upstreamRevision = getGitRevision(sourceRoot);
  const scopeSet = new Set(RESEARCH_SKILL_IDS);
  const catalogIndex = new Map(
    (sourceCatalog.skills || [])
      .filter((item) => scopeSet.has(item.name))
      .map((item) => [item.name, item]),
  );

  const filteredStageMap = filterStageMap(sourceStageMap, scopeSet);
  const generatedAt = sourceCatalog.generatedAt || upstreamRevision || "unknown";
  const skillArtifacts = RESEARCH_SKILL_IDS.map((skillId) =>
    buildSkillArtifact({
      skillId,
      sourceRoot,
      sourceSkillsRoot,
      catalogEntry: catalogIndex.get(skillId),
      stageMap: filteredStageMap,
      upstreamRevision,
    }),
  );

  const researchCatalog = {
    schema: "viewerleaf-research-catalog-v1",
    generatedAt,
    upstream: {
      repo: "dr-claw",
      revision: upstreamRevision,
    },
    skills: skillArtifacts.map(({ manifest }) => manifest),
    stageSkillMap: filteredStageMap,
  };

  const scopeManifest = {
    schema: "viewerleaf-research-scope-v1",
    generatedAt,
    skills: RESEARCH_SKILL_IDS,
  };

  const expectedFiles = buildExpectedFiles({
    skillArtifacts,
    researchCatalog,
    filteredStageMap,
    scopeManifest,
  });
  const report = diffExpectedFiles(expectedFiles);

  if (options.mode === "report") {
    process.stdout.write(`${formatReport(report)}\n`);
    return;
  }

  if (options.mode === "check") {
    if (report.hasDifferences) {
      process.stderr.write(`${formatReport(report)}\n`);
      process.exitCode = 1;
      return;
    }
    process.stdout.write("Research skills are in sync.\n");
    return;
  }

  syncExpectedFiles(expectedFiles, skillArtifacts);
  const postReport = diffExpectedFiles(expectedFiles);
  if (postReport.hasDifferences) {
    process.stderr.write(`${formatReport(postReport)}\n`);
    process.exitCode = 1;
    return;
  }
  process.stdout.write(
    `Synced ${skillArtifacts.length} research skills from ${sourceRoot}.\n`,
  );
}

function parseArgs(args) {
  const options = {
    mode: "sync",
    source: "",
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "sync" || arg === "check" || arg === "report") {
      options.mode = arg;
      continue;
    }
    if (arg === "--source" && args[index + 1]) {
      options.source = args[index + 1];
      index += 1;
      continue;
    }
    if (arg.startsWith("--source=")) {
      options.source = arg.slice("--source=".length);
      continue;
    }
    throw new Error(`Unknown argument: ${arg}`);
  }

  return options;
}

function resolveSourceRoot(explicitSource) {
  const candidates = [
    explicitSource,
    process.env.DR_CLAW_ROOT,
    path.resolve(repoRoot, "../dr-claw"),
    "/Users/donkfeng/Desktop/dr-claw",
  ].filter(Boolean);

  for (const candidate of candidates) {
    const resolved = path.resolve(candidate);
    if (existsSync(path.join(resolved, "skills", "skills-catalog-v2.json"))) {
      return resolved;
    }
  }

  throw new Error("Unable to locate dr-claw source root. Use --source or DR_CLAW_ROOT.");
}

function readJson(filePath) {
  return JSON.parse(readFileSync(filePath, "utf8"));
}

function getGitRevision(sourceRoot) {
  try {
    return execFileSync("git", ["rev-parse", "HEAD"], {
      cwd: sourceRoot,
      encoding: "utf8",
    }).trim();
  } catch {
    return "unknown";
  }
}

function filterStageMap(stageMap, scopeSet) {
  const result = {};
  for (const [stage, config] of Object.entries(stageMap)) {
    const base = (config.base || []).filter((skillId) => scopeSet.has(skillId));
    const byTaskType = {};
    for (const [taskType, skillIds] of Object.entries(config.byTaskType || {})) {
      const filtered = skillIds.filter((skillId) => scopeSet.has(skillId));
      if (filtered.length > 0) {
        byTaskType[taskType] = filtered;
      }
    }
    result[stage] = { base, byTaskType };
  }
  return result;
}

function buildSkillArtifact({
  skillId,
  sourceRoot,
  sourceSkillsRoot,
  catalogEntry,
  stageMap,
  upstreamRevision,
}) {
  const sourceDir = path.join(sourceSkillsRoot, skillId);
  const sourceSkillFile = findSourceSkillFile(sourceDir);
  const sourceBody = stripFrontmatter(readFileSync(sourceSkillFile, "utf8")).trim();
  const resourceFlags = buildResourceFlags(sourceDir);
  const stages = inferStages(skillId, stageMap, catalogEntry);
  const version = inferVersion(readFileSync(sourceSkillFile, "utf8"));
  const fallbackSummary = firstParagraph(sourceBody);
  const manifest = {
    id: skillId,
    name: skillId,
    version,
    description: firstSentence(catalogEntry?.summary || fallbackSummary || ""),
    summary: catalogEntry?.summary || fallbackSummary || skillId,
    stages,
    tools: inferTools(resourceFlags),
    primaryIntent: catalogEntry?.primaryIntent || "research",
    intents: catalogEntry?.intents || [catalogEntry?.primaryIntent || "research"],
    capabilities: catalogEntry?.capabilities || inferCapabilities(stages),
    domains: catalogEntry?.domains || inferDomains(skillId),
    keywords: catalogEntry?.keywords || [skillId, ...stages],
    source: "builtin",
    status: catalogEntry?.status || "verified",
    upstream: {
      repo: "dr-claw",
      path: path.relative(sourceRoot, sourceDir).replaceAll(path.sep, "/"),
      revision: upstreamRevision,
    },
    resourceFlags,
    legacy: catalogEntry?.legacy || null,
  };

  return {
    manifest,
    sourceDir,
    sourceSkillFile,
    canonicalSkillMd: buildCanonicalSkillMd(manifest, sourceBody),
  };
}

function findSourceSkillFile(sourceDir) {
  const candidates = ["SKILL.md", "README.md"];
  for (const candidate of candidates) {
    const filePath = path.join(sourceDir, candidate);
    if (existsSync(filePath)) {
      return filePath;
    }
  }
  throw new Error(`No SKILL.md or README.md found in ${sourceDir}`);
}

function stripFrontmatter(content) {
  const normalized = content.replace(/\r\n/g, "\n");
  if (!normalized.startsWith("---\n")) {
    return normalized.trim();
  }
  const closingIndex = normalized.indexOf("\n---\n", 4);
  if (closingIndex === -1) {
    return normalized.trim();
  }
  return normalized.slice(closingIndex + 5).trim();
}

function inferVersion(content) {
  const directMatch = content.match(/^version:\s*["']?([^"'\n]+)["']?\s*$/m);
  if (directMatch?.[1]) {
    return directMatch[1].trim();
  }
  const nestedMatch = content.match(/^\s+version:\s*["']?([^"'\n]+)["']?\s*$/m);
  if (nestedMatch?.[1]) {
    return nestedMatch[1].trim();
  }
  return "1.0.0";
}

function buildResourceFlags(sourceDir) {
  const referencesDir = path.join(sourceDir, "references");
  const scriptsDir = path.join(sourceDir, "scripts");
  const templatesDir = path.join(sourceDir, "templates");
  const assetsDir = path.join(sourceDir, "assets");
  return {
    hasReferences: existsSync(referencesDir),
    hasScripts: existsSync(scriptsDir),
    hasTemplates: existsSync(templatesDir),
    hasAssets: existsSync(assetsDir),
    referenceCount: countFiles(referencesDir),
    scriptCount: countFiles(scriptsDir),
    templateCount: countFiles(templatesDir),
    assetCount: countFiles(assetsDir),
    optionalScripts: existsSync(scriptsDir),
  };
}

function countFiles(targetDir) {
  if (!existsSync(targetDir)) {
    return 0;
  }
  let count = 0;
  for (const entry of walkFiles(targetDir)) {
    if (entry.isFile()) {
      count += 1;
    }
  }
  return count;
}

function inferStages(skillId, stageMap, catalogEntry) {
  const stages = [];
  for (const [stage, config] of Object.entries(stageMap)) {
    const inBase = (config.base || []).includes(skillId);
    const inTasks = Object.values(config.byTaskType || {}).some((skillIds) =>
      skillIds.includes(skillId),
    );
    if (inBase || inTasks) {
      stages.push(stage);
    }
  }
  if (stages.length > 0) {
    return stages;
  }

  const fallback = STAGE_FALLBACKS[skillId];
  if (fallback) {
    return fallback;
  }

  const legacyCollection = catalogEntry?.legacy?.collection || "";
  if (/Paper|Publication|Writing|Promotion/i.test(legacyCollection)) {
    return ["publication"];
  }
  if (/Experiment|Analysis/i.test(legacyCollection)) {
    return ["experiment"];
  }
  if (/Idea|Ideation/i.test(legacyCollection)) {
    return ["ideation"];
  }
  return ["survey"];
}

function inferTools(resourceFlags) {
  const tools = [...DEFAULT_TOOLS];
  if (resourceFlags.hasScripts) {
    tools.push("run_terminal");
  }
  return tools;
}

function inferCapabilities(stages) {
  if (stages.includes("publication")) {
    return ["research-planning", "visualization-reporting"];
  }
  if (stages.includes("experiment")) {
    return ["research-planning", "data-processing"];
  }
  return ["search-retrieval", "research-planning"];
}

function inferDomains(skillId) {
  if (skillId.includes("bio")) {
    return ["bioinformatics"];
  }
  return ["cs-ai"];
}

function buildCanonicalSkillMd(manifest, sourceBody) {
  const frontmatter = [
    `id: ${manifest.id}`,
    `name: ${manifest.name}`,
    `version: ${manifest.version}`,
    "description: |-",
    ...indentBlock(manifest.description || manifest.summary || manifest.name),
    `stages: ${toInlineYamlList(manifest.stages)}`,
    `tools: ${toInlineYamlList(manifest.tools)}`,
    "summary: |-",
    ...indentBlock(manifest.summary || manifest.description || manifest.name),
    `primaryIntent: ${manifest.primaryIntent}`,
    `intents: ${toInlineYamlList(manifest.intents)}`,
    `capabilities: ${toInlineYamlList(manifest.capabilities)}`,
    `domains: ${toInlineYamlList(manifest.domains)}`,
    `keywords: ${toInlineYamlList(manifest.keywords)}`,
    `source: ${manifest.source}`,
    `status: ${manifest.status}`,
    "upstream:",
    `  repo: ${manifest.upstream.repo}`,
    `  path: ${manifest.upstream.path}`,
    `  revision: ${manifest.upstream.revision}`,
    "resourceFlags:",
    `  hasReferences: ${manifest.resourceFlags.hasReferences}`,
    `  hasScripts: ${manifest.resourceFlags.hasScripts}`,
    `  hasTemplates: ${manifest.resourceFlags.hasTemplates}`,
    `  hasAssets: ${manifest.resourceFlags.hasAssets}`,
    `  referenceCount: ${manifest.resourceFlags.referenceCount}`,
    `  scriptCount: ${manifest.resourceFlags.scriptCount}`,
    `  templateCount: ${manifest.resourceFlags.templateCount}`,
    `  assetCount: ${manifest.resourceFlags.assetCount}`,
    `  optionalScripts: ${manifest.resourceFlags.optionalScripts}`,
  ].join("\n");

  const bundledResources = [];
  if (manifest.resourceFlags.hasReferences) {
    bundledResources.push(
      `- Read from \`references/\` only when the current task needs the extra detail.`,
    );
  }
  if (manifest.resourceFlags.hasScripts) {
    bundledResources.push(
      "- Treat `scripts/` as optional helpers. Run them only when their dependencies are available, keep outputs in the project workspace, and explain a manual fallback if execution is blocked.",
    );
  }
  if (manifest.resourceFlags.hasTemplates) {
    bundledResources.push(
      "- Reuse files under `templates/` instead of recreating equivalent structure from scratch when the user asks for the matching deliverable.",
    );
  }
  if (manifest.resourceFlags.hasAssets) {
    bundledResources.push(
      "- Reuse bundled files under `assets/` when they directly support the requested output.",
    );
  }
  if (bundledResources.length === 0) {
    bundledResources.push("- This skill has no bundled resource directories beyond its main instructions.");
  }

  return `---\n${frontmatter}\n---\n\n# ${manifest.name}\n\n## Canonical Summary\n\n${manifest.summary || manifest.description || manifest.name}\n\n## Trigger Rules\n\nUse this skill when the user request matches its research workflow scope. Prefer the bundled resources instead of recreating templates or reference material. Keep outputs traceable to project files, citations, scripts, or upstream evidence.\n\n## Resource Use Rules\n\n${bundledResources.join("\n")}\n\n## Execution Contract\n\n- Resolve every relative path from this skill directory first.\n- Prefer inspection before mutation when invoking bundled scripts.\n- If a required runtime, CLI, credential, or API is unavailable, explain the blocker and continue with the best manual fallback instead of silently skipping the step.\n- Do not write generated artifacts back into the skill directory; save them inside the active project workspace.\n\n## Upstream Instructions\n\n${sourceBody}\n`;
}

function indentBlock(text) {
  return String(text || "")
    .split("\n")
    .map((line) => `  ${line}`);
}

function toInlineYamlList(values) {
  return `[${values.map((value) => JSON.stringify(value)).join(", ")}]`;
}

function firstSentence(input) {
  const normalized = String(input || "").replace(/\s+/g, " ").trim();
  if (!normalized) {
    return "";
  }
  const match = normalized.match(/^(.+?[.!?])(\s|$)/);
  return match ? match[1] : normalized;
}

function firstParagraph(input) {
  const normalized = String(input || "").trim();
  if (!normalized) {
    return "";
  }
  return normalized.split(/\n\s*\n/u)[0].replace(/\s+/g, " ").trim();
}

function buildExpectedFiles({
  skillArtifacts,
  researchCatalog,
  filteredStageMap,
  scopeManifest,
}) {
  const files = new Map();

  files.set(outputCatalogPath, `${JSON.stringify(researchCatalog, null, 2)}\n`);
  files.set(outputStageMapPath, `${JSON.stringify(filteredStageMap, null, 2)}\n`);
  files.set(outputScopePath, `${JSON.stringify(scopeManifest, null, 2)}\n`);

  for (const artifact of skillArtifacts) {
    const targetDir = path.join(outputSkillsRoot, artifact.manifest.id);
    for (const sourceFile of walkFiles(artifact.sourceDir)) {
      if (!sourceFile.isFile()) {
        continue;
      }
      const relativePath = path.relative(artifact.sourceDir, sourceFile.fullPath);
      if (relativePath === "SKILL.md") {
        continue;
      }
      const targetPath = path.join(targetDir, relativePath);
      files.set(targetPath, readFileSync(sourceFile.fullPath));
    }
    files.set(path.join(targetDir, "SKILL.md"), artifact.canonicalSkillMd);
  }

  return files;
}

function diffExpectedFiles(expectedFiles) {
  const missing = [];
  const changed = [];

  for (const [filePath, expectedContent] of expectedFiles.entries()) {
    if (!existsSync(filePath)) {
      missing.push(rel(filePath));
      continue;
    }
    const actualContent = readFileSync(filePath);
    const expectedBuffer =
      typeof expectedContent === "string" ? Buffer.from(expectedContent) : expectedContent;
    if (!actualContent.equals(expectedBuffer)) {
      changed.push(rel(filePath));
    }
  }

  return {
    expectedCount: expectedFiles.size,
    missing,
    changed,
    hasDifferences: missing.length > 0 || changed.length > 0,
  };
}

function formatReport(report) {
  const lines = [
    `Expected managed files: ${report.expectedCount}`,
    `Missing: ${report.missing.length}`,
    `Changed: ${report.changed.length}`,
  ];
  if (report.missing.length > 0) {
    lines.push("Missing files:");
    lines.push(...report.missing.map((item) => `  - ${item}`));
  }
  if (report.changed.length > 0) {
    lines.push("Changed files:");
    lines.push(...report.changed.map((item) => `  - ${item}`));
  }
  return lines.join("\n");
}

function syncExpectedFiles(expectedFiles, skillArtifacts) {
  for (const artifact of skillArtifacts) {
    const targetDir = path.join(outputSkillsRoot, artifact.manifest.id);
    rmSync(targetDir, { recursive: true, force: true });
  }

  for (const [filePath, content] of expectedFiles.entries()) {
    mkdirSync(path.dirname(filePath), { recursive: true });
    if (typeof content === "string") {
      writeFileSync(filePath, content, "utf8");
    } else {
      writeFileSync(filePath, content);
    }
  }
}

function* walkFiles(targetDir) {
  if (!existsSync(targetDir)) {
    return;
  }
  for (const entryName of readdirSync(targetDir)) {
    if (entryName === ".DS_Store" || entryName === "__pycache__") {
      continue;
    }
    const fullPath = path.join(targetDir, entryName);
    const stats = statSync(fullPath);
    const entry = {
      fullPath,
      isFile: () => stats.isFile(),
      isDirectory: () => stats.isDirectory(),
    };
    if (stats.isDirectory()) {
      yield* walkFiles(fullPath);
      continue;
    }
    if (fullPath.endsWith(".pyc")) {
      continue;
    }
    yield entry;
  }
}

function rel(filePath) {
  return path.relative(repoRoot, filePath).replaceAll(path.sep, "/");
}

main();
