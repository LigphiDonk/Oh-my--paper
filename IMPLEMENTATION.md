# ViewerLeaf V1 技术实现文档

> 本文档面向 AI 编码代理（Codex / Claude Code），提供可直接执行的实现指令。
> 每个任务包含：要修改的文件、完整代码规格、验证命令。

---

## 目录

1. [项目概述与现状](#1-项目概述与现状)
2. [Phase 1: 数据层 + Provider 管理](#2-phase-1-数据层--provider-管理)
3. [Phase 2: Agent 引擎](#3-phase-2-agent-引擎)
4. [Phase 3: Skill 系统 + Banana 集成](#4-phase-3-skill-系统--banana-集成)
5. [Phase 4: 编辑器增强](#5-phase-4-编辑器增强)
6. [附录: 完整 SQLite Schema](#6-附录-完整-sqlite-schema)
7. [附录: 完整类型定义](#7-附录-完整类型定义)
8. [附录: Sidecar 目录结构](#8-附录-sidecar-目录结构)

---

## 1. 项目概述与现状

### 1.1 项目定位

ViewerLeaf 是 macOS 桌面端学术论文写作工具，集成 LaTeX 编辑、AI Agent 辅助写作、配图生成。

### 1.2 技术栈

| 层 | 技术 | 版本 |
|----|------|------|
| 桌面框架 | Tauri | 2.8 |
| 前端 | React + TypeScript | 19 / 5.9 |
| 构建 | Vite | 7.3 |
| 编辑器 | CodeMirror 6 | @uiw/react-codemirror 4.25 |
| PDF | react-pdf + pdfjs-dist | 10.2 / 5.4 |
| 后端 | Rust (Tokio, Serde) | 2024 edition |
| Sidecar | Node.js (ES Modules) | 20+ |
| 数据库 | SQLite (rusqlite) | 新增 |

### 1.3 现有目录结构

```
viwerleaf/
├── src/                        # React 前端
│   ├── App.tsx                 # 主组件 (347 行)
│   ├── components/
│   │   ├── ProjectTree.tsx     # 文件树
│   │   ├── EditorPane.tsx      # CodeMirror 编辑器
│   │   ├── PdfPane.tsx         # PDF 预览
│   │   └── BottomDock.tsx      # 底部面板 (228 行)
│   ├── lib/
│   │   ├── desktop.ts          # Tauri IPC 桥接
│   │   ├── mockRuntime.ts      # 浏览器 mock (658 行)
│   │   └── latex.ts            # LaTeX 工具函数
│   ├── types.ts                # TypeScript 类型
│   └── index.css               # 样式 (588 行)
├── src-tauri/                  # Rust 后端
│   ├── src/
│   │   ├── main.rs
│   │   ├── lib.rs
│   │   ├── commands.rs         # 18 个 Tauri 命令
│   │   ├── models.rs           # 数据模型
│   │   ├── state.rs            # AppState (内存)
│   │   └── services/
│   │       ├── project.rs      # 文件 I/O
│   │       ├── compile.rs      # latexmk 编译
│   │       ├── agent.rs        # Agent 调用 (mock)
│   │       ├── figure.rs       # 图表流程
│   │       ├── sync.rs         # SyncTeX
│   │       ├── provider.rs     # Provider (基础)
│   │       └── skill.rs        # Skill (基础)
├── sidecar/
│   ├── index.mjs               # 126 行，全部 mock
│   └── package.json
└── .viewerleaf/
    └── project.json
```

### 1.4 当前状态

- LaTeX 编辑→编译→PDF 预览链路可用
- Agent/Provider/Skill/Banana 全部返回 mock 数据
- 状态全部存在内存 `RwLock<AppStore>` 中，无持久化
- sidecar 无真实 API 调用

---

## 2. Phase 1: 数据层 + Provider 管理

### 2.1 任务概述

将应用从内存状态迁移到 SQLite，实现 Provider 完整 CRUD。

### 2.2 新增依赖

**文件: `src-tauri/Cargo.toml`**

在 `[dependencies]` 中新增：
```toml
rusqlite = { version = "0.31", features = ["bundled"] }
```

**文件: `sidecar/package.json`**

添加依赖（Phase 2 会用到，提前安装）：
```json
{
  "private": true,
  "type": "module",
  "dependencies": {
    "openai": "^4.80.0",
    "@anthropic-ai/sdk": "^0.40.0"
  }
}
```

### 2.3 新建 `src-tauri/src/schema.sql`

```sql
-- Provider 表
CREATE TABLE IF NOT EXISTS providers (
    id            TEXT PRIMARY KEY,
    name          TEXT NOT NULL,
    vendor        TEXT NOT NULL CHECK(vendor IN ('openai','anthropic','openrouter','deepseek','google','banana','custom')),
    base_url      TEXT NOT NULL,
    api_key       TEXT NOT NULL DEFAULT '',
    default_model TEXT NOT NULL DEFAULT '',
    is_enabled    INTEGER NOT NULL DEFAULT 1,
    sort_order    INTEGER NOT NULL DEFAULT 0,
    meta_json     TEXT NOT NULL DEFAULT '{}',
    created_at    TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Profile 表
CREATE TABLE IF NOT EXISTS profiles (
    id              TEXT PRIMARY KEY,
    label           TEXT NOT NULL,
    summary         TEXT NOT NULL DEFAULT '',
    stage           TEXT NOT NULL CHECK(stage IN ('planning','drafting','revision','submission','figures')),
    provider_id     TEXT NOT NULL,
    model           TEXT NOT NULL,
    skill_ids_json  TEXT NOT NULL DEFAULT '[]',
    tool_allowlist_json TEXT NOT NULL DEFAULT '[]',
    output_mode     TEXT NOT NULL CHECK(output_mode IN ('outline','rewrite','review')),
    sort_order      INTEGER NOT NULL DEFAULT 0,
    is_builtin      INTEGER NOT NULL DEFAULT 0,
    FOREIGN KEY (provider_id) REFERENCES providers(id)
);

-- Skill 表
CREATE TABLE IF NOT EXISTS skills (
    id          TEXT PRIMARY KEY,
    name        TEXT NOT NULL,
    version     TEXT NOT NULL DEFAULT '1.0.0',
    stages_json TEXT NOT NULL DEFAULT '[]',
    tools_json  TEXT NOT NULL DEFAULT '[]',
    source      TEXT NOT NULL CHECK(source IN ('builtin','local','project')),
    dir_path    TEXT NOT NULL DEFAULT '',
    is_enabled  INTEGER NOT NULL DEFAULT 1,
    created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Session 表
CREATE TABLE IF NOT EXISTS sessions (
    id          TEXT PRIMARY KEY,
    profile_id  TEXT NOT NULL,
    project_dir TEXT NOT NULL,
    title       TEXT NOT NULL DEFAULT '',
    created_at  TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Message 表
CREATE TABLE IF NOT EXISTS messages (
    id          TEXT PRIMARY KEY,
    session_id  TEXT NOT NULL,
    role        TEXT NOT NULL CHECK(role IN ('user','assistant','system','tool')),
    content     TEXT NOT NULL,
    profile_id  TEXT NOT NULL DEFAULT '',
    tool_id     TEXT NOT NULL DEFAULT '',
    tool_args   TEXT NOT NULL DEFAULT '',
    created_at  TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
);

-- Usage 日志表
CREATE TABLE IF NOT EXISTS usage_logs (
    id            TEXT PRIMARY KEY,
    session_id    TEXT NOT NULL DEFAULT '',
    provider_id   TEXT NOT NULL DEFAULT '',
    model         TEXT NOT NULL DEFAULT '',
    input_tokens  INTEGER NOT NULL DEFAULT 0,
    output_tokens INTEGER NOT NULL DEFAULT 0,
    created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Figure Brief 表
CREATE TABLE IF NOT EXISTS figure_briefs (
    id                TEXT PRIMARY KEY,
    source_section    TEXT NOT NULL DEFAULT '',
    brief_markdown    TEXT NOT NULL DEFAULT '',
    prompt_payload    TEXT NOT NULL DEFAULT '',
    status            TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','ready','generated')),
    created_at        TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Asset 表
CREATE TABLE IF NOT EXISTS assets (
    id              TEXT PRIMARY KEY,
    kind            TEXT NOT NULL DEFAULT 'figure' CHECK(kind IN ('figure','table','diagram')),
    file_path       TEXT NOT NULL,
    source_brief_id TEXT NOT NULL DEFAULT '',
    metadata_json   TEXT NOT NULL DEFAULT '{}',
    created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);
```

### 2.4 新建 `src-tauri/src/db.rs`

```rust
use std::path::Path;
use rusqlite::{Connection, Result as SqlResult};
use uuid::Uuid;

/// 初始化数据库，返回连接。自动建表 + 种子数据。
pub fn init_db(app_data_dir: &Path) -> SqlResult<Connection> {
    std::fs::create_dir_all(app_data_dir).ok();
    let db_path = app_data_dir.join("viewerleaf.db");
    let conn = Connection::open(db_path)?;

    // 启用 WAL 模式和外键
    conn.execute_batch("PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;")?;

    // 建表
    conn.execute_batch(include_str!("schema.sql"))?;

    // 种子数据（仅当 providers 表为空时）
    let count: i64 = conn.query_row("SELECT COUNT(*) FROM providers", [], |r| r.get(0))?;
    if count == 0 {
        seed_providers(&conn)?;
        seed_profiles(&conn)?;
        seed_skills(&conn)?;
    }

    Ok(conn)
}

fn seed_providers(conn: &Connection) -> SqlResult<()> {
    let providers = vec![
        ("openai-main",    "OpenAI",      "openai",     "https://api.openai.com/v1",          "gpt-4.1"),
        ("anthropic-main", "Anthropic",   "anthropic",  "https://api.anthropic.com",           "claude-sonnet-4"),
        ("openrouter-lab", "OpenRouter",  "openrouter", "https://openrouter.ai/api/v1",        "claude-3.7-sonnet"),
        ("deepseek-main",  "DeepSeek",    "deepseek",   "https://api.deepseek.com/v1",         "deepseek-chat"),
    ];
    for (id, name, vendor, url, model) in providers {
        conn.execute(
            "INSERT INTO providers (id, name, vendor, base_url, default_model) VALUES (?1, ?2, ?3, ?4, ?5)",
            rusqlite::params![id, name, vendor, url, model],
        )?;
    }
    Ok(())
}

fn seed_profiles(conn: &Connection) -> SqlResult<()> {
    let profiles = vec![
        ("outline", "Outline",  "Generate section structure",                         "planning",   "openai-main",    "gpt-4.1",            r#"["academic-outline"]"#,           r#"["read_section","list_sections","insert_at_line"]"#,  "outline"),
        ("draft",   "Draft",    "Expand notes into academic prose",                   "drafting",   "anthropic-main", "claude-sonnet-4",     r#"["academic-draft"]"#,             r#"["read_section","apply_text_patch"]"#,                "rewrite"),
        ("polish",  "Polish",   "Tighten style and compress phrasing",                "revision",   "openrouter-lab", "claude-3.7-sonnet",   r#"["academic-polish"]"#,            r#"["read_section","apply_text_patch"]"#,                "rewrite"),
        ("de_ai",   "De-AI",    "Remove AI writing artifacts",                        "revision",   "openai-main",    "gpt-4.1-mini",        r#"["academic-de-ai"]"#,             r#"["read_section","apply_text_patch"]"#,                "rewrite"),
        ("review",  "Review",   "Critical review like a tough reviewer",              "submission", "anthropic-main", "claude-sonnet-4",     r#"["academic-review"]"#,            r#"["read_section","search_project","read_bib_entries"]"#, "review"),
    ];
    for (id, label, summary, stage, provider, model, skills, tools, mode) in profiles {
        conn.execute(
            "INSERT INTO profiles (id, label, summary, stage, provider_id, model, skill_ids_json, tool_allowlist_json, output_mode, is_builtin) VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,1)",
            rusqlite::params![id, label, summary, stage, provider, model, skills, tools, mode],
        )?;
    }
    Ok(())
}

fn seed_skills(conn: &Connection) -> SqlResult<()> {
    let skills = vec![
        ("academic-outline", "Academic Outline",  r#"["planning"]"#,   r#"["read_section","list_sections","insert_at_line"]"#),
        ("academic-draft",   "Academic Draft",    r#"["drafting"]"#,   r#"["read_section","apply_text_patch"]"#),
        ("academic-polish",  "Academic Polish",   r#"["revision"]"#,   r#"["read_section","apply_text_patch"]"#),
        ("academic-de-ai",   "Academic De-AI",    r#"["revision"]"#,   r#"["read_section","apply_text_patch"]"#),
        ("academic-review",  "Academic Review",   r#"["submission"]"#, r#"["read_section","search_project","read_bib_entries"]"#),
        ("banana-figure",    "Banana Figure",     r#"["figures"]"#,    r#"["read_section"]"#),
    ];
    for (id, name, stages, tools) in skills {
        conn.execute(
            "INSERT INTO skills (id, name, stages_json, tools_json, source) VALUES (?1,?2,?3,?4,'builtin')",
            rusqlite::params![id, name, stages, tools],
        )?;
    }
    Ok(())
}
```

### 2.5 重写 `src-tauri/src/state.rs`

```rust
use std::sync::RwLock;
use rusqlite::Connection;
use crate::models::ProjectConfig;

pub struct AppState {
    pub db: RwLock<Connection>,
    pub project_config: RwLock<ProjectConfig>,
}
```

### 2.6 修改 `src-tauri/src/lib.rs`

在 Tauri 初始化流程中：

```rust
mod db;
mod state;
// ... 其他 mod

use state::AppState;
use tauri::Manager;

pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            let app_data_dir = app.path().app_data_dir()
                .expect("failed to resolve app data dir");
            let conn = db::init_db(&app_data_dir)
                .expect("failed to init database");

            let project_config = /* 加载 .viewerleaf/project.json 或使用默认值 */;

            app.manage(AppState {
                db: RwLock::new(conn),
                project_config: RwLock::new(project_config),
            });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            // 注册所有命令
            commands::open_project,
            commands::save_file,
            commands::compile_project,
            commands::forward_search,
            commands::reverse_search,
            commands::run_agent,
            commands::apply_agent_patch,
            commands::get_agent_messages,
            commands::list_skills,
            commands::install_skill,
            commands::enable_skill,
            commands::list_providers,
            commands::add_provider,
            commands::update_provider,
            commands::delete_provider,
            commands::test_provider,
            commands::list_profiles,
            commands::update_profile,
            commands::create_figure_brief,
            commands::run_figure_skill,
            commands::run_banana_generation,
            commands::register_generated_asset,
            commands::insert_figure_snippet,
            commands::get_usage_stats,
        ])
        .run(tauri::generate_context!())
        .expect("error running tauri application");
}
```

### 2.7 重写 `src-tauri/src/models.rs`

```rust
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ProjectConfig {
    pub root_path: String,
    pub main_tex: String,
    pub engine: String,
    pub bib_tool: String,
    pub auto_compile: bool,
    pub forward_sync: bool,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ProviderConfig {
    pub id: String,
    pub name: String,
    pub vendor: String,
    pub base_url: String,
    pub api_key: String,
    pub default_model: String,
    pub is_enabled: bool,
    pub sort_order: i32,
    pub meta_json: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ProfileConfig {
    pub id: String,
    pub label: String,
    pub summary: String,
    pub stage: String,
    pub provider_id: String,
    pub model: String,
    pub skill_ids: Vec<String>,       // 反序列化自 skill_ids_json
    pub tool_allowlist: Vec<String>,  // 反序列化自 tool_allowlist_json
    pub output_mode: String,
    pub sort_order: i32,
    pub is_builtin: bool,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct SkillManifest {
    pub id: String,
    pub name: String,
    pub version: String,
    pub stages: Vec<String>,
    pub tools: Vec<String>,
    pub source: String,
    pub dir_path: String,
    pub is_enabled: bool,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct AgentMessage {
    pub id: String,
    pub session_id: String,
    pub role: String,
    pub content: String,
    pub profile_id: String,
    pub tool_id: String,
    pub tool_args: String,
    pub created_at: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct CompileResult {
    pub status: String,
    pub pdf_path: Option<String>,
    pub synctex_path: Option<String>,
    pub diagnostics: Vec<Diagnostic>,
    pub log_path: String,
    pub log_output: String,
    pub timestamp: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Diagnostic {
    pub file: String,
    pub line: u32,
    pub level: String,
    pub message: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct FigureBriefDraft {
    pub id: String,
    pub source_section_ref: String,
    pub brief_markdown: String,
    pub prompt_payload: String,
    pub status: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct GeneratedAsset {
    pub id: String,
    pub kind: String,
    pub file_path: String,
    pub source_brief_id: String,
    pub metadata: serde_json::Value,
    pub preview_uri: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct UsageRecord {
    pub id: String,
    pub session_id: String,
    pub provider_id: String,
    pub model: String,
    pub input_tokens: i64,
    pub output_tokens: i64,
    pub created_at: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct TestResult {
    pub success: bool,
    pub latency_ms: u64,
    pub error: Option<String>,
}

// Agent 运行时需要的请求结构
#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct AgentRequest {
    pub session_id: String,
    pub profile_id: String,
    pub provider: AgentProvider,
    pub system_prompt: String,
    pub tools: Vec<String>,
    pub context: AgentContext,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct AgentProvider {
    pub vendor: String,
    pub base_url: String,
    pub api_key: String,
    pub model: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct AgentContext {
    pub project_root: String,
    pub active_file_path: String,
    pub selected_text: String,
    pub full_file_content: String,
    pub cursor_line: u32,
}

// 流式事件 (Rust → React via Tauri event)
#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(tag = "type", rename_all = "camelCase")]
pub enum StreamChunk {
    #[serde(rename = "text_delta")]
    TextDelta { content: String },
    #[serde(rename = "tool_call_start")]
    ToolCallStart { tool_id: String, args: serde_json::Value },
    #[serde(rename = "tool_call_result")]
    ToolCallResult { tool_id: String, output: String },
    #[serde(rename = "patch")]
    Patch { file_path: String, start_line: u32, end_line: u32, new_content: String },
    #[serde(rename = "error")]
    Error { message: String },
    #[serde(rename = "done")]
    Done { usage: UsageInfo },
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct UsageInfo {
    pub input_tokens: i64,
    pub output_tokens: i64,
    pub model: String,
}
```

### 2.8 重写 `src-tauri/src/services/provider.rs`

```rust
use rusqlite::{params, Connection};
use crate::models::ProviderConfig;

pub fn list_providers(conn: &Connection) -> Result<Vec<ProviderConfig>, String> {
    let mut stmt = conn.prepare(
        "SELECT id, name, vendor, base_url, api_key, default_model, is_enabled, sort_order, meta_json FROM providers ORDER BY sort_order"
    ).map_err(|e| e.to_string())?;

    let rows = stmt.query_map([], |row| {
        Ok(ProviderConfig {
            id: row.get(0)?,
            name: row.get(1)?,
            vendor: row.get(2)?,
            base_url: row.get(3)?,
            api_key: row.get(4)?,
            default_model: row.get(5)?,
            is_enabled: row.get::<_, i32>(6)? != 0,
            sort_order: row.get(7)?,
            meta_json: row.get(8)?,
        })
    }).map_err(|e| e.to_string())?;

    let mut providers = Vec::new();
    for row in rows {
        providers.push(row.map_err(|e| e.to_string())?);
    }
    Ok(providers)
}

pub fn add_provider(conn: &Connection, config: &ProviderConfig) -> Result<(), String> {
    conn.execute(
        "INSERT INTO providers (id, name, vendor, base_url, api_key, default_model, is_enabled, sort_order, meta_json) VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9)",
        params![config.id, config.name, config.vendor, config.base_url, config.api_key, config.default_model, config.is_enabled as i32, config.sort_order, config.meta_json],
    ).map_err(|e| e.to_string())?;
    Ok(())
}

pub fn update_provider(conn: &Connection, config: &ProviderConfig) -> Result<(), String> {
    conn.execute(
        "UPDATE providers SET name=?2, vendor=?3, base_url=?4, api_key=?5, default_model=?6, is_enabled=?7, sort_order=?8, meta_json=?9, updated_at=datetime('now') WHERE id=?1",
        params![config.id, config.name, config.vendor, config.base_url, config.api_key, config.default_model, config.is_enabled as i32, config.sort_order, config.meta_json],
    ).map_err(|e| e.to_string())?;
    Ok(())
}

pub fn delete_provider(conn: &Connection, id: &str) -> Result<(), String> {
    conn.execute("DELETE FROM providers WHERE id=?1", params![id])
        .map_err(|e| e.to_string())?;
    Ok(())
}

pub fn get_provider(conn: &Connection, id: &str) -> Result<ProviderConfig, String> {
    conn.query_row(
        "SELECT id, name, vendor, base_url, api_key, default_model, is_enabled, sort_order, meta_json FROM providers WHERE id=?1",
        params![id],
        |row| Ok(ProviderConfig {
            id: row.get(0)?,
            name: row.get(1)?,
            vendor: row.get(2)?,
            base_url: row.get(3)?,
            api_key: row.get(4)?,
            default_model: row.get(5)?,
            is_enabled: row.get::<_, i32>(6)? != 0,
            sort_order: row.get(7)?,
            meta_json: row.get(8)?,
        }),
    ).map_err(|e| e.to_string())
}
```

### 2.9 新增 `src-tauri/src/services/profile.rs`

```rust
use rusqlite::{params, Connection};
use crate::models::ProfileConfig;

pub fn list_profiles(conn: &Connection) -> Result<Vec<ProfileConfig>, String> {
    let mut stmt = conn.prepare(
        "SELECT id, label, summary, stage, provider_id, model, skill_ids_json, tool_allowlist_json, output_mode, sort_order, is_builtin FROM profiles ORDER BY sort_order"
    ).map_err(|e| e.to_string())?;

    let rows = stmt.query_map([], |row| {
        let skill_ids_raw: String = row.get(6)?;
        let tool_allowlist_raw: String = row.get(7)?;
        Ok(ProfileConfig {
            id: row.get(0)?,
            label: row.get(1)?,
            summary: row.get(2)?,
            stage: row.get(3)?,
            provider_id: row.get(4)?,
            model: row.get(5)?,
            skill_ids: serde_json::from_str(&skill_ids_raw).unwrap_or_default(),
            tool_allowlist: serde_json::from_str(&tool_allowlist_raw).unwrap_or_default(),
            output_mode: row.get(8)?,
            sort_order: row.get(9)?,
            is_builtin: row.get::<_, i32>(10)? != 0,
        })
    }).map_err(|e| e.to_string())?;

    let mut profiles = Vec::new();
    for row in rows {
        profiles.push(row.map_err(|e| e.to_string())?);
    }
    Ok(profiles)
}

pub fn update_profile(conn: &Connection, config: &ProfileConfig) -> Result<(), String> {
    let skill_ids_json = serde_json::to_string(&config.skill_ids).unwrap_or_default();
    let tool_allowlist_json = serde_json::to_string(&config.tool_allowlist).unwrap_or_default();
    conn.execute(
        "UPDATE profiles SET label=?2, summary=?3, stage=?4, provider_id=?5, model=?6, skill_ids_json=?7, tool_allowlist_json=?8, output_mode=?9, sort_order=?10 WHERE id=?1",
        params![config.id, config.label, config.summary, config.stage, config.provider_id, config.model, skill_ids_json, tool_allowlist_json, config.output_mode, config.sort_order],
    ).map_err(|e| e.to_string())?;
    Ok(())
}
```

### 2.10 重写 `src-tauri/src/commands.rs` — Provider/Profile 部分

```rust
use tauri::State;
use crate::state::AppState;
use crate::models::*;
use crate::services::{provider, profile};

#[tauri::command]
pub fn list_providers(state: State<'_, AppState>) -> Result<Vec<ProviderConfig>, String> {
    let conn = state.db.read().map_err(|e| e.to_string())?;
    provider::list_providers(&conn)
}

#[tauri::command]
pub fn add_provider(state: State<'_, AppState>, config: ProviderConfig) -> Result<(), String> {
    let conn = state.db.read().map_err(|e| e.to_string())?;
    provider::add_provider(&conn, &config)
}

#[tauri::command]
pub fn update_provider(state: State<'_, AppState>, config: ProviderConfig) -> Result<(), String> {
    let conn = state.db.read().map_err(|e| e.to_string())?;
    provider::update_provider(&conn, &config)
}

#[tauri::command]
pub fn delete_provider(state: State<'_, AppState>, id: String) -> Result<(), String> {
    let conn = state.db.read().map_err(|e| e.to_string())?;
    provider::delete_provider(&conn, &id)
}

#[tauri::command]
pub fn list_profiles(state: State<'_, AppState>) -> Result<Vec<ProfileConfig>, String> {
    let conn = state.db.read().map_err(|e| e.to_string())?;
    profile::list_profiles(&conn)
}

#[tauri::command]
pub fn update_profile(state: State<'_, AppState>, config: ProfileConfig) -> Result<(), String> {
    let conn = state.db.read().map_err(|e| e.to_string())?;
    profile::update_profile(&conn, &config)
}

#[tauri::command]
pub fn test_provider(state: State<'_, AppState>, id: String) -> Result<TestResult, String> {
    let conn = state.db.read().map_err(|e| e.to_string())?;
    let prov = provider::get_provider(&conn, &id)?;
    // 通过 sidecar 测试连通性
    // node sidecar/index.mjs test-provider '{"baseUrl":"...","apiKey":"...","model":"..."}'
    let start = std::time::Instant::now();
    let output = std::process::Command::new("node")
        .args(["sidecar/index.mjs", "test-provider", &serde_json::json!({
            "vendor": prov.vendor,
            "baseUrl": prov.base_url,
            "apiKey": prov.api_key,
            "model": prov.default_model,
        }).to_string()])
        .output()
        .map_err(|e| e.to_string())?;
    let latency = start.elapsed().as_millis() as u64;

    if output.status.success() {
        Ok(TestResult { success: true, latency_ms: latency, error: None })
    } else {
        let err = String::from_utf8_lossy(&output.stderr).to_string();
        Ok(TestResult { success: false, latency_ms: latency, error: Some(err) })
    }
}
```

### 2.11 更新 `src/types.ts`

```typescript
// ===== Provider =====
export interface ProviderConfig {
  id: string;
  name: string;
  vendor: "openai" | "anthropic" | "openrouter" | "deepseek" | "google" | "banana" | "custom";
  baseUrl: string;
  apiKey: string;
  defaultModel: string;
  isEnabled: boolean;
  sortOrder: number;
  metaJson: string;
}

export interface ProviderPreset {
  vendor: string;
  name: string;
  baseUrl: string;
  models: string[];
}

// ===== Profile =====
export interface ProfileConfig {
  id: string;
  label: string;
  summary: string;
  stage: "planning" | "drafting" | "revision" | "submission" | "figures";
  providerId: string;
  model: string;
  skillIds: string[];
  toolAllowlist: string[];
  outputMode: "outline" | "rewrite" | "review";
  sortOrder: number;
  isBuiltin: boolean;
}

// ===== Skill =====
export interface SkillManifest {
  id: string;
  name: string;
  version: string;
  stages: string[];
  tools: string[];
  source: "builtin" | "local" | "project";
  dirPath: string;
  isEnabled: boolean;
}

// ===== Agent Streaming =====
export type StreamChunk =
  | { type: "text_delta"; content: string }
  | { type: "tool_call_start"; toolId: string; args: Record<string, unknown> }
  | { type: "tool_call_result"; toolId: string; output: string }
  | { type: "patch"; filePath: string; startLine: number; endLine: number; newContent: string }
  | { type: "error"; message: string }
  | { type: "done"; usage: { inputTokens: number; outputTokens: number; model: string } };

// ===== Agent Message =====
export interface AgentMessage {
  id: string;
  sessionId: string;
  role: "user" | "assistant" | "system" | "tool";
  content: string;
  profileId: string;
  toolId: string;
  toolArgs: string;
  createdAt: string;
}

// ===== Figure =====
export interface FigureBriefDraft {
  id: string;
  sourceSectionRef: string;
  briefMarkdown: string;
  promptPayload: string;
  status: "draft" | "ready" | "generated";
}

export interface GeneratedAsset {
  id: string;
  kind: "figure" | "table" | "diagram";
  filePath: string;
  sourceBriefId: string;
  metadata: Record<string, unknown>;
  previewUri?: string;
}

// ===== Usage =====
export interface UsageRecord {
  id: string;
  sessionId: string;
  providerId: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  createdAt: string;
}

export interface TestResult {
  success: boolean;
  latencyMs: number;
  error?: string;
}

// ===== Existing types (keep) =====
export interface ProjectFile {
  path: string;
  content: string;
}

export interface ProjectConfig {
  rootPath: string;
  mainTex: string;
  engine: string;
  bibTool: string;
  autoCompile: boolean;
  forwardSync: boolean;
}

export interface CompileResult {
  status: string;
  pdfPath?: string;
  synctexPath?: string;
  diagnostics: Diagnostic[];
  logPath: string;
  logOutput: string;
  timestamp: string;
}

export interface Diagnostic {
  file: string;
  line: number;
  level: string;
  message: string;
}

export type DrawerTab = "ai" | "logs" | "figures" | "skills" | "providers" | "usage";

export type AgentProfileId = "outline" | "draft" | "polish" | "de_ai" | "review";

export interface TreeNode {
  name: string;
  path: string;
  isDir: boolean;
  children?: TreeNode[];
}

export interface WorkspaceSnapshot {
  files: ProjectFile[];
  tree: TreeNode[];
  activeFile: string;
  projectConfig: ProjectConfig;
  compileResult: CompileResult;
  profiles: ProfileConfig[];
  figureBriefs: FigureBriefDraft[];
  assets: GeneratedAsset[];
  skills: SkillManifest[];
  providers: ProviderConfig[];
}
```

### 2.12 更新 `src/lib/desktop.ts`

添加新命令和事件监听：

```typescript
import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import type {
  ProviderConfig,
  ProfileConfig,
  SkillManifest,
  TestResult,
  UsageRecord,
  StreamChunk,
  WorkspaceSnapshot,
  CompileResult,
  AgentMessage,
  FigureBriefDraft,
  GeneratedAsset,
} from "../types";

// 判断是否在 Tauri 环境
const isTauri = "__TAURI__" in window;

// ===== 已有命令 =====
async function openProject(): Promise<WorkspaceSnapshot> {
  if (!isTauri) return (await import("./mockRuntime")).mockRuntime.openProject();
  return invoke("open_project");
}

async function saveFile(filePath: string, content: string): Promise<void> {
  if (!isTauri) return;
  return invoke("save_file", { filePath, content });
}

async function compileProject(filePath: string): Promise<CompileResult> {
  if (!isTauri) return (await import("./mockRuntime")).mockRuntime.compileProject();
  return invoke("compile_project", { filePath });
}

async function forwardSearch(filePath: string, line: number): Promise<{ page: number }> {
  if (!isTauri) return { page: 1 };
  return invoke("forward_search", { filePath, line });
}

async function reverseSearch(page: number): Promise<{ filePath: string; line: number }> {
  if (!isTauri) return { filePath: "main.tex", line: 1 };
  return invoke("reverse_search", { page });
}

// ===== Agent 命令 =====
async function runAgent(profileId: string, filePath: string, selectedText: string): Promise<{ sessionId: string }> {
  if (!isTauri) return (await import("./mockRuntime")).mockRuntime.runAgent(profileId, filePath, selectedText);
  return invoke("run_agent", { profileId, filePath, selectedText });
}

async function applyAgentPatch(filePath: string, content: string): Promise<void> {
  if (!isTauri) return;
  return invoke("apply_agent_patch", { filePath, content });
}

async function getAgentMessages(sessionId?: string): Promise<AgentMessage[]> {
  if (!isTauri) return [];
  return invoke("get_agent_messages", { sessionId });
}

// ===== Provider 命令 =====
async function listProviders(): Promise<ProviderConfig[]> {
  if (!isTauri) return (await import("./mockRuntime")).mockRuntime.listProviders();
  return invoke("list_providers");
}

async function addProvider(config: ProviderConfig): Promise<void> {
  return invoke("add_provider", { config });
}

async function updateProvider(config: ProviderConfig): Promise<void> {
  return invoke("update_provider", { config });
}

async function deleteProvider(id: string): Promise<void> {
  return invoke("delete_provider", { id });
}

async function testProvider(id: string): Promise<TestResult> {
  return invoke("test_provider", { id });
}

// ===== Profile 命令 =====
async function listProfiles(): Promise<ProfileConfig[]> {
  if (!isTauri) return (await import("./mockRuntime")).mockRuntime.listProfiles();
  return invoke("list_profiles");
}

async function updateProfile(config: ProfileConfig): Promise<void> {
  return invoke("update_profile", { config });
}

// ===== Skill 命令 =====
async function listSkills(): Promise<SkillManifest[]> {
  if (!isTauri) return (await import("./mockRuntime")).mockRuntime.listSkills();
  return invoke("list_skills");
}

async function enableSkill(id: string, enabled: boolean): Promise<void> {
  return invoke("enable_skill", { id, enabled });
}

// ===== Figure 命令 =====
async function createFigureBrief(filePath: string, selectedText: string): Promise<FigureBriefDraft> {
  if (!isTauri) return (await import("./mockRuntime")).mockRuntime.createFigureBrief(filePath, selectedText);
  return invoke("create_figure_brief", { filePath, selectedText });
}

async function runFigureSkill(briefId: string): Promise<FigureBriefDraft> {
  if (!isTauri) return (await import("./mockRuntime")).mockRuntime.runFigureSkill(briefId);
  return invoke("run_figure_skill", { briefId });
}

async function runBananaGeneration(briefId: string): Promise<GeneratedAsset> {
  if (!isTauri) return (await import("./mockRuntime")).mockRuntime.runBananaGeneration(briefId);
  return invoke("run_banana_generation", { briefId });
}

async function registerGeneratedAsset(asset: GeneratedAsset): Promise<void> {
  return invoke("register_generated_asset", { asset });
}

async function insertFigureSnippet(filePath: string, assetId: string, caption: string, line: number): Promise<{ filePath: string; content: string }> {
  return invoke("insert_figure_snippet", { filePath, assetId, caption, line });
}

// ===== Usage 命令 =====
async function getUsageStats(): Promise<UsageRecord[]> {
  return invoke("get_usage_stats");
}

// ===== 流式事件监听 =====
function onAgentStream(callback: (chunk: StreamChunk) => void): Promise<UnlistenFn> {
  return listen<StreamChunk>("agent:stream", (event) => {
    callback(event.payload);
  });
}

export const desktop = {
  openProject,
  saveFile,
  compileProject,
  forwardSearch,
  reverseSearch,
  runAgent,
  applyAgentPatch,
  getAgentMessages,
  listProviders,
  addProvider,
  updateProvider,
  deleteProvider,
  testProvider,
  listProfiles,
  updateProfile,
  listSkills,
  enableSkill,
  createFigureBrief,
  runFigureSkill,
  runBananaGeneration,
  registerGeneratedAsset,
  insertFigureSnippet,
  getUsageStats,
  onAgentStream,
};
```

### 2.13 前端 Provider 预设数据

**新建 `src/lib/providerPresets.ts`**

```typescript
import type { ProviderPreset } from "../types";

export const PROVIDER_PRESETS: ProviderPreset[] = [
  {
    vendor: "openai",
    name: "OpenAI",
    baseUrl: "https://api.openai.com/v1",
    models: ["gpt-4.1", "gpt-4.1-mini", "gpt-4o", "o3-mini"],
  },
  {
    vendor: "anthropic",
    name: "Anthropic",
    baseUrl: "https://api.anthropic.com",
    models: ["claude-sonnet-4", "claude-haiku-4-5", "claude-opus-4"],
  },
  {
    vendor: "openrouter",
    name: "OpenRouter",
    baseUrl: "https://openrouter.ai/api/v1",
    models: ["anthropic/claude-3.7-sonnet", "deepseek/deepseek-chat", "google/gemini-2.5-pro"],
  },
  {
    vendor: "deepseek",
    name: "DeepSeek",
    baseUrl: "https://api.deepseek.com/v1",
    models: ["deepseek-chat", "deepseek-reasoner"],
  },
  {
    vendor: "google",
    name: "Google AI",
    baseUrl: "https://generativelanguage.googleapis.com/v1beta",
    models: ["gemini-2.5-pro", "gemini-2.5-flash"],
  },
  {
    vendor: "banana",
    name: "Banana (ikun)",
    baseUrl: "https://api.ikuncode.cc/v1",
    models: ["gemini-3-pro-image-preview"],
  },
  {
    vendor: "custom",
    name: "Custom (OpenAI-compatible)",
    baseUrl: "",
    models: [],
  },
];
```

### 2.14 Phase 1 验证

```bash
# 1. 编译 Rust 后端
cd src-tauri && cargo build

# 2. 验证数据库创建
ls ~/Library/Application\ Support/com.viewerleaf.app/viewerleaf.db

# 3. 启动应用
npm run tauri dev

# 4. 手动验证
# - 打开 Providers 面板，应看到 4 个预设 Provider
# - 点击"添加"，选择 DeepSeek 预设，填入 API Key，保存
# - 关闭应用，重新打开，DeepSeek Provider 仍在
# - 点击"测试连接"，验证连通性
# - 打开 Profile，验证 Provider 下拉框可切换
```

---

## 3. Phase 2: Agent 引擎

### 3.1 Sidecar 重构

#### 3.1.1 新建 `sidecar/utils/ndjson.mjs`

```javascript
/**
 * 输出一行 NDJSON 到 stdout（Rust 端逐行读取）
 */
export function emit(obj) {
  process.stdout.write(JSON.stringify(obj) + "\n");
}
```

#### 3.1.2 新建 `sidecar/providers/openai.mjs`

```javascript
import OpenAI from "openai";

export function createOpenAIProvider(config) {
  const client = new OpenAI({
    apiKey: config.apiKey,
    baseURL: config.baseUrl,
  });

  let totalInputTokens = 0;
  let totalOutputTokens = 0;

  return {
    async *chat({ messages, tools, toolChoice = "auto" }) {
      const openaiTools = tools.map((t) => ({
        type: "function",
        function: {
          name: t.id,
          description: t.description,
          parameters: t.parameters,
        },
      }));

      const stream = await client.chat.completions.create({
        model: config.model,
        messages,
        tools: openaiTools.length > 0 ? openaiTools : undefined,
        tool_choice: openaiTools.length > 0 ? toolChoice : undefined,
        stream: true,
        stream_options: { include_usage: true },
      });

      let currentToolCalls = [];

      for await (const chunk of stream) {
        const delta = chunk.choices?.[0]?.delta;
        if (!delta) {
          // usage chunk
          if (chunk.usage) {
            totalInputTokens += chunk.usage.prompt_tokens || 0;
            totalOutputTokens += chunk.usage.completion_tokens || 0;
          }
          continue;
        }

        if (delta.content) {
          yield { type: "text", text: delta.content };
        }

        if (delta.tool_calls) {
          for (const tc of delta.tool_calls) {
            if (tc.index !== undefined) {
              if (!currentToolCalls[tc.index]) {
                currentToolCalls[tc.index] = { id: tc.id, name: "", arguments: "" };
              }
              if (tc.id) currentToolCalls[tc.index].id = tc.id;
              if (tc.function?.name) currentToolCalls[tc.index].name += tc.function.name;
              if (tc.function?.arguments) currentToolCalls[tc.index].arguments += tc.function.arguments;
            }
          }
        }

        if (chunk.choices?.[0]?.finish_reason === "tool_calls") {
          for (const tc of currentToolCalls) {
            if (tc && tc.name) {
              yield {
                type: "tool_call",
                id: tc.id,
                name: tc.name,
                args: JSON.parse(tc.arguments || "{}"),
              };
            }
          }
          currentToolCalls = [];
        }
      }
    },

    getUsage() {
      return { inputTokens: totalInputTokens, outputTokens: totalOutputTokens, model: config.model };
    },
  };
}
```

#### 3.1.3 新建 `sidecar/providers/anthropic.mjs`

```javascript
import Anthropic from "@anthropic-ai/sdk";

export function createAnthropicProvider(config) {
  const client = new Anthropic({
    apiKey: config.apiKey,
    baseURL: config.baseUrl || undefined,
  });

  let totalInputTokens = 0;
  let totalOutputTokens = 0;

  return {
    async *chat({ messages, tools }) {
      // 分离 system message
      const systemMessages = messages.filter((m) => m.role === "system");
      const nonSystemMessages = messages.filter((m) => m.role !== "system");
      const system = systemMessages.map((m) => m.content).join("\n\n");

      const anthropicTools = tools.map((t) => ({
        name: t.id,
        description: t.description,
        input_schema: t.parameters,
      }));

      const stream = client.messages.stream({
        model: config.model,
        max_tokens: 4096,
        system,
        messages: nonSystemMessages,
        tools: anthropicTools.length > 0 ? anthropicTools : undefined,
      });

      for await (const event of stream) {
        if (event.type === "content_block_delta") {
          if (event.delta.type === "text_delta") {
            yield { type: "text", text: event.delta.text };
          } else if (event.delta.type === "input_json_delta") {
            // tool input 正在流式拼接，先不 yield
          }
        } else if (event.type === "content_block_stop") {
          // 检查是否是 tool_use block
        } else if (event.type === "message_delta") {
          if (event.usage) {
            totalOutputTokens += event.usage.output_tokens || 0;
          }
        }
      }

      // 获取最终消息
      const finalMessage = await stream.finalMessage();
      totalInputTokens += finalMessage.usage?.input_tokens || 0;
      totalOutputTokens = finalMessage.usage?.output_tokens || 0;

      // 提取 tool_use blocks
      for (const block of finalMessage.content) {
        if (block.type === "tool_use") {
          yield {
            type: "tool_call",
            id: block.id,
            name: block.name,
            args: block.input,
          };
        }
      }
    },

    getUsage() {
      return { inputTokens: totalInputTokens, outputTokens: totalOutputTokens, model: config.model };
    },
  };
}
```

#### 3.1.4 新建 `sidecar/providers/generic.mjs`

```javascript
// OpenAI-compatible 通用适配器（OpenRouter, DeepSeek 等）
import { createOpenAIProvider } from "./openai.mjs";

export function createGenericProvider(config) {
  // OpenAI-compatible API 直接复用 OpenAI adapter
  return createOpenAIProvider(config);
}
```

#### 3.1.5 新建 `sidecar/providers/index.mjs`

```javascript
import { createOpenAIProvider } from "./openai.mjs";
import { createAnthropicProvider } from "./anthropic.mjs";
import { createGenericProvider } from "./generic.mjs";

export function loadProvider(providerConfig) {
  switch (providerConfig.vendor) {
    case "openai":
      return createOpenAIProvider(providerConfig);
    case "anthropic":
      return createAnthropicProvider(providerConfig);
    case "openrouter":
    case "deepseek":
    case "google":
    case "custom":
    default:
      return createGenericProvider(providerConfig);
  }
}
```

#### 3.1.6 实现 6 个学术工具

**新建 `sidecar/tools/read-section.mjs`**
```javascript
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

export const readSection = {
  id: "read_section",
  description: "Read the content of a .tex file, optionally a specific line range.",
  parameters: {
    type: "object",
    properties: {
      filePath: { type: "string", description: "Relative path to .tex file from project root" },
      startLine: { type: "number", description: "Start line (1-based, inclusive). Omit to read entire file." },
      endLine: { type: "number", description: "End line (1-based, inclusive). Omit to read to end." },
    },
    required: ["filePath"],
  },
  execute(args, ctx) {
    const fullPath = resolve(ctx.projectRoot, args.filePath);
    const lines = readFileSync(fullPath, "utf-8").split("\n");
    const start = (args.startLine || 1) - 1;
    const end = args.endLine || lines.length;
    const slice = lines.slice(start, end);
    return {
      output: slice.map((l, i) => `${start + i + 1}: ${l}`).join("\n"),
      metadata: { lineCount: slice.length },
    };
  },
};
```

**新建 `sidecar/tools/apply-text-patch.mjs`**
```javascript
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

export const applyTextPatch = {
  id: "apply_text_patch",
  description: "Replace a range of lines in a .tex file with new content.",
  parameters: {
    type: "object",
    properties: {
      filePath: { type: "string", description: "Relative path to .tex file" },
      startLine: { type: "number", description: "Start line to replace (1-based, inclusive)" },
      endLine: { type: "number", description: "End line to replace (1-based, inclusive)" },
      newContent: { type: "string", description: "Replacement text (can be multiple lines)" },
    },
    required: ["filePath", "startLine", "endLine", "newContent"],
  },
  execute(args, ctx) {
    const fullPath = resolve(ctx.projectRoot, args.filePath);
    const lines = readFileSync(fullPath, "utf-8").split("\n");
    const before = lines.slice(0, args.startLine - 1);
    const after = lines.slice(args.endLine);
    const newLines = args.newContent.split("\n");
    const result = [...before, ...newLines, ...after].join("\n");
    writeFileSync(fullPath, result, "utf-8");
    return {
      output: `Replaced lines ${args.startLine}-${args.endLine} with ${newLines.length} new lines.`,
      sideEffects: [{ type: "file_changed", filePath: args.filePath, content: result }],
    };
  },
};
```

**新建 `sidecar/tools/search-project.mjs`**
```javascript
import { readFileSync, readdirSync, statSync } from "node:fs";
import { resolve, relative, extname } from "node:path";

export const searchProject = {
  id: "search_project",
  description: "Search for a keyword across all .tex and .bib files in the project.",
  parameters: {
    type: "object",
    properties: {
      query: { type: "string", description: "Search keyword or regex pattern" },
      fileGlob: { type: "string", description: "Optional: file extension filter, e.g. '.tex' or '.bib'" },
    },
    required: ["query"],
  },
  execute(args, ctx) {
    const matches = [];
    const pattern = new RegExp(args.query, "gi");
    const allowedExts = args.fileGlob ? [args.fileGlob] : [".tex", ".bib"];

    function walk(dir) {
      for (const entry of readdirSync(dir)) {
        const full = resolve(dir, entry);
        const stat = statSync(full);
        if (stat.isDirectory() && !entry.startsWith(".")) {
          walk(full);
        } else if (allowedExts.some((ext) => entry.endsWith(ext))) {
          const content = readFileSync(full, "utf-8");
          const lines = content.split("\n");
          for (let i = 0; i < lines.length; i++) {
            if (pattern.test(lines[i])) {
              matches.push({
                file: relative(ctx.projectRoot, full),
                line: i + 1,
                text: lines[i].trim(),
              });
            }
          }
        }
      }
    }

    walk(ctx.projectRoot);
    return { output: JSON.stringify(matches.slice(0, 50), null, 2) };
  },
};
```

**新建 `sidecar/tools/insert-at-line.mjs`**
```javascript
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

export const insertAtLine = {
  id: "insert_at_line",
  description: "Insert new content at a specific line in a .tex file (content is added BEFORE the specified line).",
  parameters: {
    type: "object",
    properties: {
      filePath: { type: "string", description: "Relative path to .tex file" },
      line: { type: "number", description: "Line number to insert before (1-based)" },
      content: { type: "string", description: "Content to insert" },
    },
    required: ["filePath", "line", "content"],
  },
  execute(args, ctx) {
    const fullPath = resolve(ctx.projectRoot, args.filePath);
    const lines = readFileSync(fullPath, "utf-8").split("\n");
    const newLines = args.content.split("\n");
    lines.splice(args.line - 1, 0, ...newLines);
    const result = lines.join("\n");
    writeFileSync(fullPath, result, "utf-8");
    return {
      output: `Inserted ${newLines.length} lines at line ${args.line}.`,
      sideEffects: [{ type: "file_changed", filePath: args.filePath, content: result }],
    };
  },
};
```

**新建 `sidecar/tools/list-sections.mjs`**
```javascript
import { readFileSync, readdirSync, statSync } from "node:fs";
import { resolve, relative } from "node:path";

export const listSections = {
  id: "list_sections",
  description: "List all \\section, \\subsection, \\subsubsection headings in the project.",
  parameters: {
    type: "object",
    properties: {
      filePath: { type: "string", description: "Optional: limit to a specific .tex file" },
    },
  },
  execute(args, ctx) {
    const sectionPattern = /\\(section|subsection|subsubsection)\{([^}]+)\}/g;
    const sections = [];

    function scanFile(fullPath) {
      const content = readFileSync(fullPath, "utf-8");
      const lines = content.split("\n");
      for (let i = 0; i < lines.length; i++) {
        let match;
        while ((match = sectionPattern.exec(lines[i])) !== null) {
          const level = match[1] === "section" ? 1 : match[1] === "subsection" ? 2 : 3;
          sections.push({
            level,
            title: match[2],
            file: relative(ctx.projectRoot, fullPath),
            line: i + 1,
          });
        }
      }
    }

    if (args.filePath) {
      scanFile(resolve(ctx.projectRoot, args.filePath));
    } else {
      function walk(dir) {
        for (const entry of readdirSync(dir)) {
          const full = resolve(dir, entry);
          if (statSync(full).isDirectory() && !entry.startsWith(".")) walk(full);
          else if (entry.endsWith(".tex")) scanFile(full);
        }
      }
      walk(ctx.projectRoot);
    }

    return { output: JSON.stringify(sections, null, 2) };
  },
};
```

**新建 `sidecar/tools/read-bib-entries.mjs`**
```javascript
import { readFileSync, readdirSync } from "node:fs";
import { resolve, relative } from "node:path";

export const readBibEntries = {
  id: "read_bib_entries",
  description: "Read bibliography entries from .bib files. Optionally filter by keyword.",
  parameters: {
    type: "object",
    properties: {
      query: { type: "string", description: "Optional keyword to filter entries by title/author/key" },
    },
  },
  execute(args, ctx) {
    const entries = [];
    const entryPattern = /@(\w+)\{([^,]+),\s*([\s\S]*?)(?=\n@|\n*$)/g;

    function scanBib(fullPath) {
      const content = readFileSync(fullPath, "utf-8");
      let match;
      while ((match = entryPattern.exec(content)) !== null) {
        const type = match[1];
        const key = match[2].trim();
        const body = match[3];
        const title = body.match(/title\s*=\s*\{([^}]+)\}/i)?.[1] || "";
        const author = body.match(/author\s*=\s*\{([^}]+)\}/i)?.[1] || "";
        const year = body.match(/year\s*=\s*\{?(\d{4})\}?/i)?.[1] || "";

        if (!args.query || [key, title, author].some((f) => f.toLowerCase().includes(args.query.toLowerCase()))) {
          entries.push({ key, type, title, author, year, file: relative(ctx.projectRoot, fullPath) });
        }
      }
    }

    // 查找所有 .bib 文件
    function walk(dir) {
      for (const entry of readdirSync(dir)) {
        const full = resolve(dir, entry);
        if (entry.endsWith(".bib")) scanBib(full);
      }
    }
    walk(ctx.projectRoot);
    // 也检查 refs/ 子目录
    try { walk(resolve(ctx.projectRoot, "refs")); } catch {}

    return { output: JSON.stringify(entries, null, 2) };
  },
};
```

#### 3.1.7 新建 `sidecar/tools/registry.mjs`

```javascript
import { readSection } from "./read-section.mjs";
import { applyTextPatch } from "./apply-text-patch.mjs";
import { searchProject } from "./search-project.mjs";
import { insertAtLine } from "./insert-at-line.mjs";
import { listSections } from "./list-sections.mjs";
import { readBibEntries } from "./read-bib-entries.mjs";

const ALL_TOOLS = [readSection, applyTextPatch, searchProject, insertAtLine, listSections, readBibEntries];

const TOOL_MAP = Object.fromEntries(ALL_TOOLS.map((t) => [t.id, t]));

/**
 * 根据允许的工具 ID 列表获取工具定义
 */
export function getTools(toolIds) {
  return toolIds.map((id) => TOOL_MAP[id]).filter(Boolean);
}

/**
 * 获取所有工具定义（用于 schema 导出）
 */
export function getAllTools() {
  return ALL_TOOLS;
}
```

#### 3.1.8 新建 `sidecar/agent.mjs`

```javascript
import { loadProvider } from "./providers/index.mjs";
import { getTools } from "./tools/registry.mjs";
import { emit } from "./utils/ndjson.mjs";

/**
 * 主 Agent 运行函数
 * @param {import('./types').AgentRequest} request
 */
export async function runAgent(request) {
  const { provider: providerConfig, systemPrompt, tools: toolIds, context } = request;

  // 1. 初始化 provider
  const provider = loadProvider(providerConfig);

  // 2. 加载工具
  const tools = getTools(toolIds);
  const toolCtx = {
    projectRoot: context.projectRoot,
    activeFilePath: context.activeFilePath,
    sessionId: request.sessionId,
  };

  // 3. 构造初始消息
  const messages = [
    { role: "system", content: systemPrompt },
    {
      role: "user",
      content: buildUserMessage(context),
    },
  ];

  // 4. Agent loop
  const MAX_TOOL_ROUNDS = 10;
  let round = 0;

  while (round < MAX_TOOL_ROUNDS) {
    round++;
    let hasToolCalls = false;
    let textAccum = "";
    const pendingToolCalls = [];

    try {
      for await (const chunk of provider.chat({ messages, tools })) {
        if (chunk.type === "text") {
          emit({ type: "text_delta", content: chunk.text });
          textAccum += chunk.text;
        } else if (chunk.type === "tool_call") {
          hasToolCalls = true;
          pendingToolCalls.push(chunk);
        }
      }
    } catch (err) {
      emit({ type: "error", message: err.message || String(err) });
      break;
    }

    // 如果有文本输出，加入消息历史
    if (textAccum) {
      messages.push({ role: "assistant", content: textAccum });
    }

    // 处理工具调用
    if (!hasToolCalls) break;

    // 构造 assistant message with tool_calls (for OpenAI format)
    const assistantMsg = {
      role: "assistant",
      content: textAccum || null,
      tool_calls: pendingToolCalls.map((tc) => ({
        id: tc.id,
        type: "function",
        function: { name: tc.name, arguments: JSON.stringify(tc.args) },
      })),
    };
    // 替换最后的纯文本 assistant message
    if (textAccum) messages.pop();
    messages.push(assistantMsg);

    // 执行每个工具
    for (const tc of pendingToolCalls) {
      emit({ type: "tool_call_start", toolId: tc.name, args: tc.args });

      const tool = tools.find((t) => t.id === tc.name);
      if (!tool) {
        const errMsg = `Unknown tool: ${tc.name}`;
        emit({ type: "tool_call_result", toolId: tc.name, output: errMsg });
        messages.push({ role: "tool", tool_call_id: tc.id, content: errMsg });
        continue;
      }

      try {
        const result = tool.execute(tc.args, toolCtx);
        emit({ type: "tool_call_result", toolId: tc.name, output: result.output });

        // 如果有文件变更副作用，也推送 patch 事件
        if (result.sideEffects) {
          for (const effect of result.sideEffects) {
            if (effect.type === "file_changed") {
              emit({ type: "patch", filePath: effect.filePath, startLine: 0, endLine: 0, newContent: effect.content });
            }
          }
        }

        messages.push({ role: "tool", tool_call_id: tc.id, content: result.output });
      } catch (err) {
        const errMsg = `Tool error: ${err.message}`;
        emit({ type: "tool_call_result", toolId: tc.name, output: errMsg });
        messages.push({ role: "tool", tool_call_id: tc.id, content: errMsg });
      }
    }
  }

  // 5. 输出最终 usage
  const usage = provider.getUsage();
  emit({ type: "done", usage });
}

function buildUserMessage(context) {
  const parts = [];
  if (context.selectedText) {
    parts.push(`## Selected Text\n\n${context.selectedText}`);
  }
  parts.push(`## Current File: ${context.activeFilePath}\n\n${context.fullFileContent}`);
  parts.push(`## Cursor Position: Line ${context.cursorLine}`);
  return parts.join("\n\n---\n\n");
}
```

#### 3.1.9 重写 `sidecar/index.mjs`

```javascript
import process from "node:process";
import { runAgent } from "./agent.mjs";

function parsePayload() {
  const raw = process.argv[3] ?? "{}";
  return JSON.parse(raw);
}

async function main() {
  const command = process.argv[2];

  switch (command) {
    case "agent": {
      const payload = parsePayload();
      await runAgent(payload);
      break;
    }
    case "test-provider": {
      const payload = parsePayload();
      await testProvider(payload);
      break;
    }
    case "figure-skill": {
      const payload = parsePayload();
      await runFigureSkill(payload);
      break;
    }
    case "banana": {
      const payload = parsePayload();
      await runBanana(payload);
      break;
    }
    default:
      process.stderr.write(`Unknown sidecar command: ${command}\n`);
      process.exitCode = 1;
  }
}

async function testProvider(config) {
  const { loadProvider } = await import("./providers/index.mjs");
  const provider = loadProvider(config);
  try {
    const messages = [{ role: "user", content: "Say 'ok' and nothing else." }];
    for await (const chunk of provider.chat({ messages, tools: [] })) {
      // 只需要成功即可
    }
    process.stdout.write(JSON.stringify({ success: true }));
  } catch (err) {
    process.stderr.write(err.message || String(err));
    process.exitCode = 1;
  }
}

async function runFigureSkill(payload) {
  // Phase 3 会用 LLM 优化 prompt，目前先保留基础逻辑
  process.stdout.write(
    JSON.stringify({
      id: payload.briefId,
      sourceSectionRef: "active-section",
      briefMarkdown: `${payload.briefMarkdown}\n\n## Style direction\nUse a journal-style figure with restrained color.`,
      promptPayload: `${payload.promptPayload} Return a clean wide workflow figure.`,
      status: "ready",
    })
  );
}

async function runBanana(payload) {
  // Phase 3 实现真实 API 调用
  const { randomUUID } = await import("node:crypto");
  process.stdout.write(
    JSON.stringify({
      id: randomUUID(),
      kind: "figure",
      filePath: `assets/figures/figure-${Date.now()}.png`,
      sourceBriefId: payload.briefId,
      metadata: { generator: "banana", createdAt: new Date().toISOString(), format: "png" },
      previewUri: "",
    })
  );
}

main().catch((err) => {
  process.stderr.write(String(err));
  process.exitCode = 1;
});
```

### 3.2 Rust 端 Agent 流式读取

**重写 `src-tauri/src/services/agent.rs`**

```rust
use std::io::BufRead;
use std::process::{Command, Stdio};
use tauri::{AppHandle, Emitter};
use uuid::Uuid;
use rusqlite::{params, Connection};

use crate::models::*;
use crate::services::provider;
use crate::services::skill;

/// 运行 Agent：构造请求 → 启动 sidecar → 流式转发 → 存储结果
pub fn run_agent(
    app_handle: &AppHandle,
    conn: &Connection,
    project_root: &str,
    profile_id: &str,
    file_path: &str,
    selected_text: &str,
) -> Result<String, String> {
    // 1. 加载 profile
    let profile = get_profile(conn, profile_id)?;

    // 2. 加载 provider
    let prov = provider::get_provider(conn, &profile.provider_id)?;

    // 3. 加载 skill prompts
    let system_prompt = skill::load_skill_prompts(conn, &profile.skill_ids)?;

    // 4. 读取当前文件内容
    let full_path = std::path::Path::new(project_root).join(file_path);
    let full_content = std::fs::read_to_string(&full_path).unwrap_or_default();

    // 5. 构造 AgentRequest
    let session_id = Uuid::new_v4().to_string();
    let request = AgentRequest {
        session_id: session_id.clone(),
        profile_id: profile_id.to_string(),
        provider: AgentProvider {
            vendor: prov.vendor,
            base_url: prov.base_url,
            api_key: prov.api_key,
            model: profile.model,
        },
        system_prompt,
        tools: profile.tool_allowlist.clone(),
        context: AgentContext {
            project_root: project_root.to_string(),
            active_file_path: file_path.to_string(),
            selected_text: selected_text.to_string(),
            full_file_content: full_content,
            cursor_line: 1,
        },
    };

    let payload = serde_json::to_string(&request).map_err(|e| e.to_string())?;

    // 6. 创建 session 记录
    conn.execute(
        "INSERT INTO sessions (id, profile_id, project_dir) VALUES (?1, ?2, ?3)",
        params![session_id, profile_id, project_root],
    ).map_err(|e| e.to_string())?;

    // 7. 存储用户消息
    conn.execute(
        "INSERT INTO messages (id, session_id, role, content, profile_id) VALUES (?1, ?2, 'user', ?3, ?4)",
        params![Uuid::new_v4().to_string(), session_id, selected_text, profile_id],
    ).map_err(|e| e.to_string())?;

    // 8. 启动 sidecar 子进程
    let mut child = Command::new("node")
        .args(["sidecar/index.mjs", "agent", &payload])
        .current_dir(project_root)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| format!("Failed to spawn sidecar: {}", e))?;

    // 9. 逐行读取 NDJSON stdout → emit Tauri event
    let stdout = child.stdout.take().ok_or("No stdout")?;
    let reader = std::io::BufReader::new(stdout);
    let mut full_response = String::new();

    for line in reader.lines() {
        let line = line.map_err(|e| e.to_string())?;
        if line.trim().is_empty() { continue; }

        // 解析 chunk
        if let Ok(chunk) = serde_json::from_str::<StreamChunk>(&line) {
            // 转发给前端
            let _ = app_handle.emit("agent:stream", &chunk);

            // 累积文本
            match &chunk {
                StreamChunk::TextDelta { content } => {
                    full_response.push_str(content);
                }
                StreamChunk::Done { usage } => {
                    // 记录 usage
                    let _ = conn.execute(
                        "INSERT INTO usage_logs (id, session_id, provider_id, model, input_tokens, output_tokens) VALUES (?1,?2,?3,?4,?5,?6)",
                        params![Uuid::new_v4().to_string(), session_id, profile.provider_id, usage.model, usage.input_tokens, usage.output_tokens],
                    );
                }
                _ => {}
            }
        }
    }

    // 10. 等待子进程结束
    let _ = child.wait();

    // 11. 存储 assistant 消息
    if !full_response.is_empty() {
        conn.execute(
            "INSERT INTO messages (id, session_id, role, content, profile_id) VALUES (?1, ?2, 'assistant', ?3, ?4)",
            params![Uuid::new_v4().to_string(), session_id, full_response, profile_id],
        ).map_err(|e| e.to_string())?;
    }

    Ok(session_id)
}

fn get_profile(conn: &Connection, id: &str) -> Result<ProfileConfig, String> {
    conn.query_row(
        "SELECT id, label, summary, stage, provider_id, model, skill_ids_json, tool_allowlist_json, output_mode, sort_order, is_builtin FROM profiles WHERE id=?1",
        params![id],
        |row| {
            let skill_ids_raw: String = row.get(6)?;
            let tool_allowlist_raw: String = row.get(7)?;
            Ok(ProfileConfig {
                id: row.get(0)?,
                label: row.get(1)?,
                summary: row.get(2)?,
                stage: row.get(3)?,
                provider_id: row.get(4)?,
                model: row.get(5)?,
                skill_ids: serde_json::from_str(&skill_ids_raw).unwrap_or_default(),
                tool_allowlist: serde_json::from_str(&tool_allowlist_raw).unwrap_or_default(),
                output_mode: row.get(8)?,
                sort_order: row.get(9)?,
                is_builtin: row.get::<_, i32>(10)? != 0,
            })
        },
    ).map_err(|e| format!("Profile not found: {}", e))
}
```

### 3.3 React 端流式渲染

在 `src/App.tsx` 中修改 `handleRunAgent`：

```typescript
// 新增 state
const [isStreaming, setIsStreaming] = useState(false);
const [streamText, setStreamText] = useState("");

// 修改 handleRunAgent
async function handleRunAgent() {
  if (!activeFile || isStreaming) return;

  setIsStreaming(true);
  setStreamText("");
  setDrawerTab("ai");

  // 监听流式事件
  const unlisten = await desktop.onAgentStream((chunk) => {
    switch (chunk.type) {
      case "text_delta":
        setStreamText((prev) => prev + chunk.content);
        break;
      case "tool_call_start":
        setStreamText((prev) => prev + `\n[Tool: ${chunk.toolId}]\n`);
        break;
      case "tool_call_result":
        setStreamText((prev) => prev + `\n[Result: ${chunk.output.slice(0, 200)}...]\n`);
        break;
      case "patch":
        setPendingPatch({
          filePath: chunk.filePath,
          content: chunk.newContent,
          summary: `Patch from agent`,
        });
        break;
      case "error":
        setStreamText((prev) => prev + `\n[Error: ${chunk.message}]\n`);
        break;
      case "done":
        setIsStreaming(false);
        break;
    }
  });

  try {
    const result = await desktop.runAgent(activeProfileId, activeFile.path, selectedText);
    // result 包含 sessionId
  } catch (err) {
    setIsStreaming(false);
  }

  unlisten();
}
```

### 3.4 Phase 2 验证

```bash
# 1. 安装 sidecar 依赖
cd sidecar && npm install

# 2. 在某个 Provider 配置中填入真实 API Key

# 3. 启动应用
npm run tauri dev

# 4. 验证流程
# - 打开一个 .tex 文件
# - 选中一段文本
# - 选择 "Polish" profile，点击 "Run"
# - 观察 BottomDock AI 面板：应看到流式文本输出
# - 如果有工具调用（read_section），应看到 [Tool: read_section] 标记
# - 完成后如果有 patch，应显示 diff 预览
# - 点击 "Apply"，文件内容应更新
```

---

## 4. Phase 3: Skill 系统 + Banana 集成

### 4.1 内置 Skill 文件

在应用数据目录创建内置 skill，也可以在构建时打包：

**新建 `skills/academic-outline/SKILL.md`**

```markdown
---
id: academic-outline
name: Academic Outline
version: 1.0.0
stages: [planning]
tools: [read_section, list_sections, insert_at_line]
---

You are an academic writing planner. Generate a structured outline for the given section.

## Rules
1. Analyze the current document structure using `list_sections`
2. Read existing content with `read_section` to understand context
3. Generate a hierarchical outline with clear subsection headings
4. Each subsection should have a one-sentence claim or purpose
5. Use `insert_at_line` to add the outline at the appropriate position
6. Preserve existing LaTeX structure and formatting
7. Output outline items as \subsection{} and \paragraph{} commands

## Output Format
Insert the outline directly into the document using tools.
Explain your structural decisions briefly.
```

**新建 `skills/academic-draft/SKILL.md`**

```markdown
---
id: academic-draft
name: Academic Draft
version: 1.0.0
stages: [drafting]
tools: [read_section, apply_text_patch]
---

You are an academic writer. Expand the selected notes or bullet points into polished academic prose.

## Rules
1. Read the surrounding context with `read_section` to match voice and terminology
2. Convert notes into flowing paragraphs with topic sentences
3. Add appropriate transitions between ideas
4. Maintain formal academic tone (third person, passive where appropriate)
5. Preserve all existing citations (\cite{}) and cross-references (\ref{})
6. Do NOT invent citations or claims — only expand what is given
7. Keep paragraphs to 4-6 sentences each

## Output Format
Use `apply_text_patch` to replace the selected region with your draft.
```

**新建 `skills/academic-polish/SKILL.md`**

```markdown
---
id: academic-polish
name: Academic Polish
version: 1.0.0
stages: [revision]
tools: [read_section, apply_text_patch]
---

You are a senior academic editor. Polish the given LaTeX text for publication quality.

## Rules
1. Reduce redundancy and compress repeated phrasing
2. Replace generic claims with specific, evidence-bearing statements
3. Strengthen topic sentences
4. Eliminate filler phrases ("It is worth noting that", "In order to", etc.)
5. Maintain the paper's existing voice and terminology
6. Preserve all LaTeX commands, citation keys, and cross-references
7. Do NOT add new content — only refine what exists
8. Each edit should have a clear reason

## Output Format
Use `apply_text_patch` to apply changes. Before each patch, briefly explain WHY.
```

**新建 `skills/academic-de-ai/SKILL.md`**

```markdown
---
id: academic-de-ai
name: Academic De-AI
version: 1.0.0
stages: [revision]
tools: [read_section, apply_text_patch]
---

You are a text naturalizer. Remove signs of AI-generated writing from academic text.

## AI Writing Patterns to Remove
1. Predictable transitions ("Furthermore", "Moreover", "Additionally" in every paragraph)
2. Inflated symbolism and overloaded adjectives ("groundbreaking", "innovative", "novel")
3. Rhythmic over-explanation (stating obvious conclusions)
4. Rule-of-three patterns (lists of exactly three items)
5. Em dash overuse
6. Vague attributions ("Researchers have shown", "Studies indicate")
7. Negative parallelisms ("not only X but also Y")
8. Excessive conjunctive phrases ("In conclusion", "As a result")

## Rules
1. Read the section with `read_section` first
2. Vary sentence structure and length
3. Use specific, concrete language
4. Let some sentences be short and direct
5. Preserve all LaTeX commands and citations
6. Make text sound like a real human researcher wrote it

## Output Format
Use `apply_text_patch` to apply changes.
```

**新建 `skills/academic-review/SKILL.md`**

```markdown
---
id: academic-review
name: Academic Review
version: 1.0.0
stages: [submission]
tools: [read_section, search_project, read_bib_entries]
---

You are a critical academic reviewer (like a tough Reviewer 2). Evaluate the paper.

## Review Criteria
1. **Clarity**: Is the argument clear and well-structured?
2. **Novelty**: Are contributions clearly stated and differentiated from prior work?
3. **Methodology**: Is the method sound and reproducible?
4. **Evidence**: Do experiments support the claims?
5. **References**: Are key related works cited? Any missing citations?
6. **Writing quality**: Grammar, consistency, flow

## Rules
1. Use `read_section` to examine each section
2. Use `search_project` to check internal consistency (e.g., claims match results)
3. Use `read_bib_entries` to verify bibliography completeness
4. Be specific — quote problematic sentences
5. Rate severity: Minor / Major / Critical
6. Suggest concrete improvements for each issue

## Output Format
Produce a structured review with numbered points. Do NOT edit the document.
```

**新建 `skills/banana-figure/SKILL.md`**

```markdown
---
id: banana-figure
name: Banana Figure Workflow
version: 1.0.0
stages: [figures]
tools: [read_section]
---

You are a scientific figure prompt engineer. Optimize prompts for AI figure generation.

## Rules
1. Read the relevant section with `read_section` to understand context
2. Generate a detailed, specific prompt for image generation
3. Include: layout description, color scheme, labeled components, style references
4. Prefer clean, minimal scientific illustration style
5. Specify aspect ratio (16:9 for workflow diagrams, 1:1 for comparison figures)
6. Use Okabe-Ito color palette for colorblind accessibility

## Output Format
Return the optimized prompt as plain text.
```

### 4.2 Rust 端 Skill 加载

**重写 `src-tauri/src/services/skill.rs`**

```rust
use std::path::{Path, PathBuf};
use std::fs;
use rusqlite::{params, Connection};

/// 从 SKILL.md frontmatter 解析 skill 元数据
fn parse_skill_md(content: &str) -> Option<(String, String, String, Vec<String>, Vec<String>)> {
    let content = content.trim();
    if !content.starts_with("---") { return None; }
    let end = content[3..].find("---")?;
    let frontmatter = &content[3..3+end];

    let mut id = String::new();
    let mut name = String::new();
    let mut version = String::from("1.0.0");
    let mut stages = Vec::new();
    let mut tools = Vec::new();

    for line in frontmatter.lines() {
        let line = line.trim();
        if let Some(val) = line.strip_prefix("id:") {
            id = val.trim().to_string();
        } else if let Some(val) = line.strip_prefix("name:") {
            name = val.trim().to_string();
        } else if let Some(val) = line.strip_prefix("version:") {
            version = val.trim().to_string();
        } else if let Some(val) = line.strip_prefix("stages:") {
            stages = parse_yaml_array(val.trim());
        } else if let Some(val) = line.strip_prefix("tools:") {
            tools = parse_yaml_array(val.trim());
        }
    }

    if id.is_empty() { return None; }
    Some((id, name, version, stages, tools))
}

fn parse_yaml_array(s: &str) -> Vec<String> {
    // 简单解析 [a, b, c] 格式
    let s = s.trim().trim_start_matches('[').trim_end_matches(']');
    s.split(',').map(|item| item.trim().to_string()).filter(|s| !s.is_empty()).collect()
}

/// 扫描目录发现 skills
pub fn discover_skills(conn: &Connection, search_dirs: &[PathBuf], source: &str) -> Result<(), String> {
    for dir in search_dirs {
        if !dir.exists() { continue; }
        let entries = fs::read_dir(dir).map_err(|e| e.to_string())?;
        for entry in entries.flatten() {
            let skill_dir = entry.path();
            if !skill_dir.is_dir() { continue; }
            let skill_md = skill_dir.join("SKILL.md");
            if !skill_md.exists() { continue; }

            let content = fs::read_to_string(&skill_md).map_err(|e| e.to_string())?;
            if let Some((id, name, version, stages, tools)) = parse_skill_md(&content) {
                let stages_json = serde_json::to_string(&stages).unwrap_or_default();
                let tools_json = serde_json::to_string(&tools).unwrap_or_default();
                let dir_path = skill_dir.to_string_lossy().to_string();

                // upsert
                conn.execute(
                    "INSERT INTO skills (id, name, version, stages_json, tools_json, source, dir_path) VALUES (?1,?2,?3,?4,?5,?6,?7) ON CONFLICT(id) DO UPDATE SET name=?2, version=?3, stages_json=?4, tools_json=?5, dir_path=?7",
                    params![id, name, version, stages_json, tools_json, source, dir_path],
                ).map_err(|e| e.to_string())?;
            }
        }
    }
    Ok(())
}

/// 加载 skill prompt 内容（SKILL.md 的 body 部分，去掉 frontmatter）
pub fn load_skill_prompts(conn: &Connection, skill_ids: &[String]) -> Result<String, String> {
    let mut prompts = Vec::new();

    for skill_id in skill_ids {
        let dir_path: String = conn.query_row(
            "SELECT dir_path FROM skills WHERE id=?1 AND is_enabled=1",
            params![skill_id],
            |row| row.get(0),
        ).unwrap_or_default();

        if dir_path.is_empty() { continue; }

        let skill_md = Path::new(&dir_path).join("SKILL.md");
        if let Ok(content) = fs::read_to_string(&skill_md) {
            // 去掉 frontmatter，取 body
            if let Some(body) = extract_body(&content) {
                prompts.push(body);
            }
        }
    }

    Ok(prompts.join("\n\n---\n\n"))
}

fn extract_body(content: &str) -> Option<String> {
    let content = content.trim();
    if !content.starts_with("---") { return Some(content.to_string()); }
    let rest = &content[3..];
    let end = rest.find("---")?;
    let body = rest[end+3..].trim();
    Some(body.to_string())
}
```

### 4.3 Banana 真实 API 集成

**更新 `sidecar/index.mjs` 中的 `runBanana` 函数**（替换 Phase 2 的占位版本）：

```javascript
async function runBanana(payload) {
  const { randomUUID } = await import("node:crypto");
  const { writeFileSync, mkdirSync } = await import("node:fs");
  const { resolve } = await import("node:path");

  const { apiKey, baseUrl, prompt, aspectRatio, resolution, projectRoot, briefId } = payload;

  // 调用 Banana/ikun API
  const url = `${baseUrl || "https://api.ikuncode.cc/v1"}/images/generations`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gemini-3-pro-image-preview",
      prompt,
      aspect_ratio: aspectRatio || "16:9",
      resolution: resolution || "2k",
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    process.stderr.write(`Banana API error: ${response.status} ${errText}`);
    process.exitCode = 1;
    return;
  }

  const result = await response.json();

  // 假设 API 返回 base64 图片数据或 URL
  const imageData = result.data?.[0]?.b64_json || result.data?.[0]?.url;
  const figureId = randomUUID();
  const fileName = `figure-${figureId.slice(0, 8)}.png`;
  const assetsDir = resolve(projectRoot || ".", "assets", "figures");
  mkdirSync(assetsDir, { recursive: true });
  const filePath = resolve(assetsDir, fileName);

  if (imageData && !imageData.startsWith("http")) {
    // base64 → 写入文件
    const buffer = Buffer.from(imageData, "base64");
    writeFileSync(filePath, buffer);
  } else if (imageData) {
    // URL → 下载
    const imgResponse = await fetch(imageData);
    const buffer = Buffer.from(await imgResponse.arrayBuffer());
    writeFileSync(filePath, buffer);
  }

  const relativePath = `assets/figures/${fileName}`;
  process.stdout.write(
    JSON.stringify({
      id: figureId,
      kind: "figure",
      filePath: relativePath,
      sourceBriefId: briefId,
      metadata: {
        generator: "banana",
        createdAt: new Date().toISOString(),
        format: "png",
        prompt,
      },
      previewUri: `file://${filePath}`,
    })
  );
}
```

### 4.4 Phase 3 验证

```bash
# 1. 确保 skills/ 目录下有 6 个 SKILL.md 文件
ls skills/*/SKILL.md

# 2. 启动应用
npm run tauri dev

# 3. 验证 Skill 加载
# - 打开 Skills 面板，应看到 6 个 skill
# - 每个 skill 显示 stages 和 tools

# 4. 验证 Skill → Agent 注入
# - 选中文本，选择 "Polish" profile，运行
# - 在 AI 面板应能看到 agent 回复符合 academic-polish 的 SKILL.md 规则

# 5. 验证 Banana（需要 Banana API Key）
# - 在 Providers 中添加 Banana provider
# - 创建 Figure Brief → Refine → Generate
# - 应在 assets/figures/ 目录下生成真实 PNG 图片
```

---

## 5. Phase 4: 编辑器增强

### 5.1 CodeMirror Extensions

**修改 `src/components/EditorPane.tsx`**

添加以下 CodeMirror 扩展：

```typescript
import { search, searchKeymap, openSearchPanel, replaceAll } from "@codemirror/search";
import { autocompletion, CompletionContext, CompletionResult } from "@codemirror/autocomplete";
import { commentKeymap } from "@codemirror/commands";
import { keymap } from "@codemirror/view";

// LaTeX 自动补全源
function latexCompletionSource(context: CompletionContext): CompletionResult | null {
  // 匹配 \command 模式
  const word = context.matchBefore(/\\[a-zA-Z]*/);
  if (!word) return null;
  if (word.from === word.to && !context.explicit) return null;

  const commands = [
    // 环境
    { label: "\\begin{figure}", type: "keyword", apply: "\\begin{figure}[htbp]\n\\centering\n\\includegraphics[width=0.8\\textwidth]{}\n\\caption{}\n\\label{fig:}\n\\end{figure}" },
    { label: "\\begin{table}", type: "keyword", apply: "\\begin{table}[htbp]\n\\centering\n\\begin{tabular}{}\n\\end{tabular}\n\\caption{}\n\\label{tab:}\n\\end{table}" },
    { label: "\\begin{equation}", type: "keyword", apply: "\\begin{equation}\n\\label{eq:}\n\\end{equation}" },
    { label: "\\begin{itemize}", type: "keyword", apply: "\\begin{itemize}\n\\item \n\\end{itemize}" },
    { label: "\\begin{enumerate}", type: "keyword", apply: "\\begin{enumerate}\n\\item \n\\end{enumerate}" },
    { label: "\\begin{abstract}", type: "keyword", apply: "\\begin{abstract}\n\n\\end{abstract}" },
    // 文本格式
    { label: "\\textbf{}", type: "function", apply: "\\textbf{}" },
    { label: "\\textit{}", type: "function", apply: "\\textit{}" },
    { label: "\\underline{}", type: "function", apply: "\\underline{}" },
    { label: "\\emph{}", type: "function", apply: "\\emph{}" },
    // 章节
    { label: "\\section{}", type: "keyword" },
    { label: "\\subsection{}", type: "keyword" },
    { label: "\\subsubsection{}", type: "keyword" },
    { label: "\\paragraph{}", type: "keyword" },
    // 引用
    { label: "\\cite{}", type: "function" },
    { label: "\\ref{}", type: "function" },
    { label: "\\label{}", type: "function" },
    { label: "\\eqref{}", type: "function" },
    // 数学
    { label: "\\frac{}{}", type: "function", apply: "\\frac{}{}" },
    { label: "\\sqrt{}", type: "function" },
    { label: "\\sum", type: "function" },
    { label: "\\int", type: "function" },
    { label: "\\alpha", type: "constant" },
    { label: "\\beta", type: "constant" },
    { label: "\\gamma", type: "constant" },
    { label: "\\lambda", type: "constant" },
    { label: "\\theta", type: "constant" },
    // 其他
    { label: "\\includegraphics[]{}", type: "function", apply: "\\includegraphics[width=0.8\\textwidth]{}" },
    { label: "\\usepackage{}", type: "keyword" },
    { label: "\\input{}", type: "keyword" },
  ];

  return {
    from: word.from,
    options: commands,
  };
}

// 在 CodeMirror extensions 数组中添加:
const editorExtensions = [
  // ... 现有 extensions
  search(),
  keymap.of([...searchKeymap, ...commentKeymap]),
  autocompletion({ override: [latexCompletionSource] }),
];
```

### 5.2 快捷键绑定

```typescript
import { EditorView } from "@codemirror/view";

// 自定义快捷键
const customKeymap = keymap.of([
  {
    key: "Mod-s",
    run: (view) => {
      // 触发保存 + 编译（通过 props callback）
      onSave?.(view.state.doc.toString());
      return true;
    },
  },
  {
    key: "Mod-b",
    run: (view) => {
      wrapSelection(view, "\\textbf{", "}");
      return true;
    },
  },
  {
    key: "Mod-i",
    run: (view) => {
      wrapSelection(view, "\\textit{", "}");
      return true;
    },
  },
  {
    key: "Mod-Enter",
    run: () => {
      onRunAgent?.();
      return true;
    },
  },
]);

function wrapSelection(view: EditorView, before: string, after: string) {
  const { from, to } = view.state.selection.main;
  const selected = view.state.sliceDoc(from, to);
  view.dispatch({
    changes: { from, to, insert: `${before}${selected}${after}` },
    selection: { anchor: from + before.length, head: from + before.length + selected.length },
  });
}
```

### 5.3 文件树操作

**修改 `src/components/ProjectTree.tsx`**

添加右键菜单（context menu）：

```typescript
// 新增 props
interface ProjectTreeProps {
  nodes: TreeNode[];
  activeFile: string;
  onOpenFile: (path: string) => void;
  onCreateFile?: (parentDir: string, fileName: string) => void;
  onDeleteFile?: (path: string) => void;
  onRenameFile?: (oldPath: string, newName: string) => void;
}

// 右键菜单状态
const [contextMenu, setContextMenu] = useState<{ x: number; y: number; node: TreeNode } | null>(null);

// 右键处理
function handleContextMenu(e: React.MouseEvent, node: TreeNode) {
  e.preventDefault();
  setContextMenu({ x: e.clientX, y: e.clientY, node });
}

// 渲染右键菜单
{contextMenu && (
  <div className="context-menu" style={{ left: contextMenu.x, top: contextMenu.y }}>
    <button onClick={() => { /* 新建文件对话框 */ }}>New File</button>
    {!contextMenu.node.isDir && (
      <>
        <button onClick={() => onRenameFile?.(contextMenu.node.path, "")}>Rename</button>
        <button onClick={() => onDeleteFile?.(contextMenu.node.path)}>Delete</button>
      </>
    )}
  </div>
)}
```

**对应 Tauri 命令（添加到 `commands.rs`）：**

```rust
#[tauri::command]
pub fn create_file(state: State<'_, AppState>, path: String, content: String) -> Result<(), String> {
    let config = state.project_config.read().map_err(|e| e.to_string())?;
    let full_path = std::path::Path::new(&config.root_path).join(&path);
    if let Some(parent) = full_path.parent() {
        std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    std::fs::write(&full_path, &content).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn delete_file(state: State<'_, AppState>, path: String) -> Result<(), String> {
    let config = state.project_config.read().map_err(|e| e.to_string())?;
    let full_path = std::path::Path::new(&config.root_path).join(&path);
    std::fs::remove_file(&full_path).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn rename_file(state: State<'_, AppState>, old_path: String, new_path: String) -> Result<(), String> {
    let config = state.project_config.read().map_err(|e| e.to_string())?;
    let root = std::path::Path::new(&config.root_path);
    std::fs::rename(root.join(&old_path), root.join(&new_path)).map_err(|e| e.to_string())?;
    Ok(())
}
```

### 5.4 Phase 4 验证

```bash
# 1. 启动应用
npm run tauri dev

# 2. 编辑器验证
# - Cmd+F: 搜索面板弹出
# - Cmd+H: 搜索替换面板弹出
# - Cmd+S: 保存并编译
# - Cmd+B: 选中文本被 \textbf{} 包裹
# - Cmd+I: 选中文本被 \textit{} 包裹
# - Cmd+/: LaTeX 注释 (%)
# - Cmd+Enter: 运行当前 Agent Profile
# - 输入 \beg → 自动补全弹出环境列表
# - 输入 \sec → 自动补全弹出章节命令

# 3. 文件树验证
# - 右键文件 → 出现 Rename/Delete
# - 右键目录 → 出现 New File
# - 新建文件后文件树自动刷新
```

---

## 6. 附录: 完整 SQLite Schema

见 [2.3 节](#23-新建-src-taurisrcschema-sql) 的完整 DDL。

---

## 7. 附录: 完整类型定义

见 [2.11 节](#211-更新-srctypests) 的完整 TypeScript 接口。

---

## 8. 附录: Sidecar 目录结构

```
sidecar/
├── package.json              # openai, @anthropic-ai/sdk
├── index.mjs                 # CLI 入口（命令路由）
├── agent.mjs                 # Agent 核心引擎（LLM + Tool Loop + NDJSON 流式输出）
├── tools/
│   ├── registry.mjs          # 工具注册表
│   ├── read-section.mjs      # 读取 .tex 文件内容
│   ├── apply-text-patch.mjs  # 替换指定行范围
│   ├── search-project.mjs    # 全项目关键词搜索
│   ├── insert-at-line.mjs    # 在指定行插入内容
│   ├── list-sections.mjs     # 列出所有章节结构
│   └── read-bib-entries.mjs  # 读取参考文献
├── providers/
│   ├── index.mjs             # Provider 加载器
│   ├── openai.mjs            # OpenAI SDK 适配器
│   ├── anthropic.mjs         # Anthropic SDK 适配器
│   └── generic.mjs           # OpenAI-compatible 通用适配器
└── utils/
    └── ndjson.mjs            # NDJSON 输出工具
```

---

## 9. 注意事项

1. **API Key 安全**: V1 阶段 API Key 以明文存于 SQLite。生产环境应迁移到 macOS Keychain（`security` CLI 或 `keychain-services` crate）。
2. **Sidecar 路径**: Tauri 打包后 sidecar 路径会变化，需在 `tauri.conf.json` 中配置 `externalBin` 或将 sidecar 打包为资源。
3. **并发安全**: `RwLock<Connection>` 在 Tauri 异步命令中需注意不要持锁过长。Agent 长时间运行时应使用独立连接。
4. **NDJSON 编码**: sidecar 输出必须每行一个完整 JSON，不能跨行。`emit()` 函数末尾的 `\n` 不可省略。
5. **Anthropic 流式 tool_use**: Anthropic SDK 的流式 tool_use 处理比 OpenAI 复杂。`stream.finalMessage()` 获取完整结果更可靠。实际实现时需要根据 SDK 版本调试。
6. **错误处理**: 所有 sidecar 命令的错误输出到 stderr，Rust 端应读取 stderr 并转发给前端。
