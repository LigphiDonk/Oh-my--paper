use std::fs;
use std::path::{Path, PathBuf};
use std::sync::RwLock;

use serde_json::json;

use crate::models::{
    AgentMessage, CompileResult, FigureBriefDraft, GeneratedAsset, ProjectConfig, ProviderConfig,
    SkillManifest,
};

pub struct AppStore {
    pub project_config: ProjectConfig,
    pub providers: Vec<ProviderConfig>,
    pub skills: Vec<SkillManifest>,
    pub briefs: Vec<FigureBriefDraft>,
    pub assets: Vec<GeneratedAsset>,
    pub agent_messages: Vec<AgentMessage>,
    pub last_compile: CompileResult,
}

pub struct AppState {
    pub store: RwLock<AppStore>,
}

impl Default for AppState {
    fn default() -> Self {
        let project_config = ProjectConfig {
            root_path: default_workspace_root(),
            main_tex: "main.tex".into(),
            engine: "xelatex".into(),
            bib_tool: "biber".into(),
            auto_compile: true,
            forward_sync: true,
        };

        let last_compile = CompileResult {
            status: "idle".into(),
            pdf_path: None,
            synctex_path: None,
            diagnostics: vec![],
            log_path: ".viewerleaf/logs/latest.log".into(),
            log_output: "Compile service is idle.".into(),
            timestamp: chrono_like_now(),
        };

        Self {
            store: RwLock::new(AppStore {
                project_config,
                providers: vec![
                    ProviderConfig {
                        id: "openai-main".into(),
                        vendor: "OpenAI".into(),
                        base_url: "https://api.openai.com/v1".into(),
                        auth_ref: "keychain://viewerleaf/openai-main".into(),
                        default_model: "gpt-4.1".into(),
                    },
                    ProviderConfig {
                        id: "anthropic-main".into(),
                        vendor: "Anthropic".into(),
                        base_url: "https://api.anthropic.com".into(),
                        auth_ref: "keychain://viewerleaf/anthropic-main".into(),
                        default_model: "claude-sonnet-4".into(),
                    },
                ],
                skills: vec![
                    SkillManifest {
                        id: "academic-outline".into(),
                        name: "Academic Outline".into(),
                        version: "1.0.0".into(),
                        stages: vec!["planning".into()],
                        prompt_files: vec!["outline.md".into()],
                        tool_allowlist: vec!["read_section".into(), "insert_outline_into_section".into()],
                        enabled: true,
                        source: "local".into(),
                    },
                    SkillManifest {
                        id: "banana-figure-workflow".into(),
                        name: "Banana Figure Workflow".into(),
                        version: "1.0.0".into(),
                        stages: vec!["figures".into()],
                        prompt_files: vec!["figure-brief.md".into(), "banana-payload.md".into()],
                        tool_allowlist: vec!["create_figure_brief".into(), "run_banana_generation".into()],
                        enabled: true,
                        source: "local".into(),
                    },
                ],
                briefs: vec![],
                assets: vec![],
                agent_messages: vec![AgentMessage {
                    id: "boot".into(),
                    role: "system".into(),
                    profile_id: "outline".into(),
                    content: "ViewerLeaf runtime ready.".into(),
                    timestamp: chrono_like_now(),
                }],
                last_compile,
            }),
        }
    }
}

fn default_workspace_root() -> String {
    if let Ok(current_dir) = std::env::current_dir() {
        if looks_like_dev_workspace(&current_dir) {
            return current_dir.to_string_lossy().to_string();
        }
    }

    let base_dir = dirs::document_dir()
        .or_else(dirs::home_dir)
        .or_else(|| std::env::current_dir().ok())
        .unwrap_or_else(|| PathBuf::from("."));
    let root = base_dir.join("ViewerLeaf Demo");

    if let Err(err) = seed_demo_workspace(&root) {
        eprintln!("failed to prepare demo workspace at {}: {err}", root.display());
    }

    root.to_string_lossy().to_string()
}

fn looks_like_dev_workspace(path: &Path) -> bool {
    path.join("package.json").exists() && path.join("src-tauri").exists()
}

fn seed_demo_workspace(root: &Path) -> std::io::Result<()> {
    fs::create_dir_all(root.join("sections"))?;
    fs::create_dir_all(root.join("refs"))?;
    fs::create_dir_all(root.join(".viewerleaf"))?;

    write_if_missing(
        &root.join("main.tex"),
        r"\documentclass[11pt]{article}
\usepackage{graphicx}
\usepackage{booktabs}
\usepackage{hyperref}
\usepackage{biblatex}
\addbibresource{refs/references.bib}
\title{ViewerLeaf Demo Paper}
\author{ViewerLeaf}
\begin{document}
\maketitle
\input{sections/abstract}
\input{sections/introduction}
\printbibliography
\end{document}
",
    )?;

    write_if_missing(
        &root.join("sections/abstract.tex"),
        r"\begin{abstract}
ViewerLeaf ships with a writable demo workspace so the installed app opens into a valid project instead of an empty shell.
\end{abstract}
",
    )?;

    write_if_missing(
        &root.join("sections/introduction.tex"),
        r"\section{Introduction}
This sample project is created automatically for packaged builds.

\subsection{Why it exists}
Desktop apps launched from Finder do not start inside your repository, so ViewerLeaf needs its own default workspace.
",
    )?;

    write_if_missing(
        &root.join("refs/references.bib"),
        r"@article{viewerleaf2026,
  title={ViewerLeaf Demo Workspace},
  author={ViewerLeaf},
  year={2026}
}
",
    )?;

    let config = serde_json::json!({
        "rootPath": root.to_string_lossy(),
        "mainTex": "main.tex",
        "engine": "xelatex",
        "bibTool": "biber",
        "autoCompile": true,
        "forwardSync": true
    });
    write_if_missing(
        &root.join(".viewerleaf/project.json"),
        &serde_json::to_string_pretty(&config).unwrap_or_else(|_| "{}".into()),
    )?;

    Ok(())
}

fn write_if_missing(path: &Path, contents: &str) -> std::io::Result<()> {
    if path.exists() {
        return Ok(());
    }
    fs::write(path, contents)
}

pub fn default_profiles() -> Vec<serde_json::Value> {
    vec![
        json!({
          "id": "outline",
          "label": "Outline",
          "summary": "Generate section structure and section-level claims.",
          "stage": "planning",
          "providerId": "openai-main",
          "model": "gpt-4.1",
          "skillIds": ["academic-outline"],
          "toolAllowlist": ["read_section", "insert_outline_into_section"],
          "outputMode": "outline"
        }),
        json!({
          "id": "draft",
          "label": "Draft",
          "summary": "Expand notes into prose while keeping the paper voice stable.",
          "stage": "drafting",
          "providerId": "anthropic-main",
          "model": "claude-sonnet-4",
          "skillIds": ["academic-draft"],
          "toolAllowlist": ["read_section", "apply_text_patch"],
          "outputMode": "rewrite"
        }),
        json!({
          "id": "polish",
          "label": "Polish",
          "summary": "Tighten academic style and compress repeated phrasing.",
          "stage": "revision",
          "providerId": "openrouter-lab",
          "model": "claude-3.7-sonnet",
          "skillIds": ["academic-polish"],
          "toolAllowlist": ["read_section", "apply_text_patch"],
          "outputMode": "rewrite"
        }),
        json!({
          "id": "de_ai",
          "label": "De-AI",
          "summary": "Remove generic AI rhythms and over-explained transitions.",
          "stage": "revision",
          "providerId": "openai-main",
          "model": "gpt-4.1-mini",
          "skillIds": ["academic-de-ai"],
          "toolAllowlist": ["read_section", "apply_text_patch"],
          "outputMode": "rewrite"
        }),
        json!({
          "id": "review",
          "label": "Review",
          "summary": "Review the argument structure like a hard reviewer.",
          "stage": "submission",
          "providerId": "anthropic-main",
          "model": "claude-sonnet-4",
          "skillIds": ["academic-review"],
          "toolAllowlist": ["read_section", "search_project"],
          "outputMode": "review"
        }),
    ]
}

fn chrono_like_now() -> String {
    use std::time::{SystemTime, UNIX_EPOCH};

    let secs = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|dur| dur.as_secs())
        .unwrap_or_default();
    secs.to_string()
}
