//! OpenClaw Gateway lifecycle management.
//!
//! Manages the OpenClaw Gateway as a child process of the viwerleaf desktop app.
//! - Detects whether `openclaw` CLI is installed
//! - Starts `openclaw gateway` on a configurable port
//! - Monitors the process and restarts on crash
//! - Generates AGENTS.md / SOUL.md for research-scoped operation
//! - Gracefully shuts down Gateway on app exit

use std::fs;
use std::path::{Path, PathBuf};
use std::process::{Child, Command, Stdio};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::Duration;

/// Default Gateway WebSocket port.
pub const DEFAULT_GATEWAY_PORT: u16 = 18789;

/// Managed state for the OpenClaw Gateway process.
pub struct OpenClawGatewayState {
    /// PID of the running Gateway process.
    pub child: Arc<Mutex<Option<Child>>>,
    /// Whether the supervisor should keep the Gateway alive.
    pub should_run: Arc<AtomicBool>,
    /// Current workspace root (the user's research project directory).
    pub workspace_root: Arc<Mutex<Option<PathBuf>>>,
    /// Gateway WebSocket URL.
    pub ws_url: Arc<Mutex<String>>,
    /// Gateway port.
    pub port: u16,
}

impl Default for OpenClawGatewayState {
    fn default() -> Self {
        Self {
            child: Arc::new(Mutex::new(None)),
            should_run: Arc::new(AtomicBool::new(false)),
            workspace_root: Arc::new(Mutex::new(None)),
            ws_url: Arc::new(Mutex::new(format!(
                "ws://127.0.0.1:{}",
                DEFAULT_GATEWAY_PORT
            ))),
            port: DEFAULT_GATEWAY_PORT,
        }
    }
}

/// Status of the OpenClaw Gateway.
#[derive(serde::Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct GatewayStatus {
    /// One of: "running", "stopped", "not_installed", "error"
    pub state: String,
    /// Human-readable message.
    pub message: String,
    /// PID of the Gateway process, if running.
    pub pid: Option<u32>,
    /// WebSocket URL.
    pub ws_url: String,
    /// Current workspace root.
    pub workspace_root: Option<String>,
}

// ─── CLI detection ──────────────────────────────────────────────────────

/// Check if `openclaw` CLI is available on PATH.
pub fn detect_openclaw_cli() -> Option<String> {
    let output = Command::new("which")
        .arg("openclaw")
        .stdout(Stdio::piped())
        .stderr(Stdio::null())
        .output()
        .ok()?;

    if output.status.success() {
        let path = String::from_utf8_lossy(&output.stdout).trim().to_string();
        if !path.is_empty() {
            return Some(path);
        }
    }
    None
}

/// Get the installed OpenClaw version.
pub fn get_openclaw_version() -> Option<String> {
    let output = Command::new("openclaw")
        .args(["--version"])
        .stdout(Stdio::piped())
        .stderr(Stdio::null())
        .output()
        .ok()?;

    if output.status.success() {
        Some(String::from_utf8_lossy(&output.stdout).trim().to_string())
    } else {
        None
    }
}

// ─── Gateway process management ─────────────────────────────────────────

/// Start the OpenClaw Gateway process.
///
/// The Gateway is started with the workspace pointing to the user's
/// research project directory, not the viwerleaf application source.
pub fn start_gateway(
    state: &OpenClawGatewayState,
    workspace: Option<&Path>,
) -> Result<(), String> {
    // Check if already running
    {
        let mut child_lock = state.child.lock().map_err(|e| e.to_string())?;
        if let Some(ref mut child) = *child_lock {
            // Check if process is still alive
            match child.try_wait() {
                Ok(None) => return Ok(()), // Still running
                Ok(Some(_)) => {
                    *child_lock = None; // Exited, clean up
                }
                Err(_) => {
                    *child_lock = None;
                }
            }
        }
    }

    if detect_openclaw_cli().is_none() {
        return Err(
            "OpenClaw CLI not found. Please install it: npm install -g openclaw@latest".into(),
        );
    }

    // Update workspace if provided
    if let Some(ws) = workspace {
        if let Ok(mut ws_lock) = state.workspace_root.lock() {
            *ws_lock = Some(ws.to_path_buf());
        }
        // Generate research-scoped AGENTS.md and SOUL.md
        generate_research_scope_files(ws)?;
    }

    let port = state.port;
    let mut cmd = Command::new("openclaw");
    cmd.args(["gateway", "--port", &port.to_string()])
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());

    // Set workspace via environment or working directory
    if let Some(ws) = workspace {
        cmd.current_dir(ws);
    }

    let child = cmd
        .spawn()
        .map_err(|e| format!("Failed to start OpenClaw Gateway: {e}"))?;

    eprintln!(
        "[OpenClaw] Gateway started (pid={}, port={})",
        child.id(),
        port
    );

    {
        let mut child_lock = state.child.lock().map_err(|e| e.to_string())?;
        *child_lock = Some(child);
    }
    state.should_run.store(true, Ordering::SeqCst);

    // Update WS URL
    if let Ok(mut url_lock) = state.ws_url.lock() {
        *url_lock = format!("ws://127.0.0.1:{}", port);
    }

    Ok(())
}

/// Stop the OpenClaw Gateway process gracefully.
pub fn stop_gateway(state: &OpenClawGatewayState) -> Result<(), String> {
    state.should_run.store(false, Ordering::SeqCst);

    let mut child_lock = state.child.lock().map_err(|e| e.to_string())?;
    if let Some(ref mut child) = *child_lock {
        eprintln!("[OpenClaw] Stopping Gateway (pid={})", child.id());

        // Try SIGTERM first (graceful shutdown)
        #[cfg(unix)]
        {
            use std::os::unix::process::CommandExt;
            let pid = child.id();
            unsafe {
                libc::kill(pid as i32, libc::SIGTERM);
            }
        }

        #[cfg(not(unix))]
        {
            let _ = child.kill();
        }

        // Wait up to 5 seconds for graceful exit
        let start = std::time::Instant::now();
        loop {
            match child.try_wait() {
                Ok(Some(_)) => break,
                Ok(None) if start.elapsed() > Duration::from_secs(5) => {
                    let _ = child.kill();
                    let _ = child.wait();
                    break;
                }
                Ok(None) => thread::sleep(Duration::from_millis(100)),
                Err(_) => break,
            }
        }
    }
    *child_lock = None;
    eprintln!("[OpenClaw] Gateway stopped");
    Ok(())
}

/// Start the Gateway supervisor thread that auto-restarts on crash.
pub fn start_supervisor(state: Arc<OpenClawGatewayState>) {
    let child_arc = Arc::clone(&state.child);
    let should_run = Arc::clone(&state.should_run);
    let workspace_root = Arc::clone(&state.workspace_root);

    thread::spawn(move || {
        loop {
            thread::sleep(Duration::from_secs(3));

            if !should_run.load(Ordering::SeqCst) {
                continue;
            }

            let needs_restart = {
                let mut child_lock = match child_arc.lock() {
                    Ok(lock) => lock,
                    Err(_) => continue,
                };

                match child_lock.as_mut() {
                    Some(child) => match child.try_wait() {
                        Ok(Some(status)) => {
                            eprintln!(
                                "[OpenClaw] Gateway exited with status: {}. Restarting...",
                                status
                            );
                            *child_lock = None;
                            true
                        }
                        Ok(None) => false, // Still running
                        Err(_) => {
                            *child_lock = None;
                            true
                        }
                    },
                    None => true, // No child process
                }
            };

            if needs_restart {
                let ws = workspace_root.lock().ok().and_then(|w| w.clone());
                if let Err(e) = start_gateway(&state, ws.as_deref()) {
                    eprintln!("[OpenClaw] Failed to restart Gateway: {e}");
                }
            }
        }
    });
}

/// Restart the Gateway with a new workspace (e.g. when user switches projects).
pub fn restart_with_workspace(
    state: &OpenClawGatewayState,
    workspace: &Path,
) -> Result<(), String> {
    stop_gateway(state)?;
    // Brief pause to let port be released
    thread::sleep(Duration::from_millis(500));
    start_gateway(state, Some(workspace))
}

/// Get current Gateway status.
pub fn get_status(state: &OpenClawGatewayState) -> GatewayStatus {
    let is_installed = detect_openclaw_cli().is_some();

    let (is_running, pid) = {
        let mut child_lock = state.child.lock().unwrap_or_else(|e| e.into_inner());
        match child_lock.as_mut() {
            Some(child) => match child.try_wait() {
                Ok(None) => (true, Some(child.id())),
                Ok(Some(_)) => {
                    *child_lock = None;
                    (false, None)
                }
                Err(_) => (false, None),
            },
            None => (false, None),
        }
    };

    let ws_url = state
        .ws_url
        .lock()
        .map(|u| u.clone())
        .unwrap_or_default();

    let workspace = state
        .workspace_root
        .lock()
        .ok()
        .and_then(|w| w.as_ref().map(|p| p.to_string_lossy().to_string()));

    if !is_installed {
        GatewayStatus {
            state: "not_installed".into(),
            message: "OpenClaw CLI not found. Run: npm install -g openclaw@latest".into(),
            pid: None,
            ws_url,
            workspace_root: workspace,
        }
    } else if is_running {
        GatewayStatus {
            state: "running".into(),
            message: format!("Gateway running on port {}", state.port),
            pid,
            ws_url,
            workspace_root: workspace,
        }
    } else {
        GatewayStatus {
            state: "stopped".into(),
            message: "Gateway is not running".into(),
            pid: None,
            ws_url,
            workspace_root: workspace,
        }
    }
}

// ─── Research scope file generation ─────────────────────────────────────

/// Generate AGENTS.md and SOUL.md in the project directory to restrict
/// OpenClaw to research-only operations.
pub fn generate_research_scope_files(project_root: &Path) -> Result<(), String> {
    let agents_md = project_root.join("AGENTS.md");
    let soul_md = project_root.join("SOUL.md");

    // Only write if not already present (don't overwrite user customizations)
    if !agents_md.exists() {
        fs::write(
            &agents_md,
            r#"# AGENTS.md — ViewerLeaf Research Assistant

## 身份
你是 ViewerLeaf 科研助手，专注于学术研究工作流程。
你运行在 ViewerLeaf 桌面应用的 OpenClaw 内核中。

## Never 规则
- Never 处理与科研无关的任务（聊天、娱乐、购物、生活建议等）
- Never 修改项目目录之外的文件
- Never 安装系统级软件包（brew install, apt install 等）
- Never 执行 rm -rf 或类似的危险批量删除命令
- Never 在未经用户确认的情况下删除实验数据或结果文件
- Never 向外部服务发送项目数据（除非用户明确指示）

## Always 规则
- Always 在修改实验代码前简要说明你的计划
- Always 使用项目内的 compute-helper 工具执行远程实验
- Always 保存实验日志到 .pipeline/logs/ 目录
- Always 使用中文与用户交流（除非用户使用英文）

## Confirm-before 规则
- 推送代码到远程服务器前需确认
- 覆盖现有实验结果前需确认
- 修改论文主文档（main.tex）内容前需确认
- 删除任何文件前需确认

## 编码任务委派
当遇到复杂的编码任务时，使用 exec 工具调用 Claude Code CLI：
```
claude --print --dangerously-skip-permissions -p "<任务描述>" --cwd <项目目录>
```
"#,
        )
        .map_err(|e| format!("Failed to write AGENTS.md: {e}"))?;
    }

    if !soul_md.exists() {
        fs::write(
            &soul_md,
            r#"# SOUL.md — ViewerLeaf Research Assistant

## 核心身份
你是一个学术科研 AI 助手，运行在 ViewerLeaf 桌面应用中。
你的使命是帮助研究者高效完成学术研究工作。

## 知识领域
- 文献检索与综述（Semantic Scholar、arXiv、Zotero）
- 实验设计与代码编写（Python、PyTorch、JAX）
- 数据分析与可视化（Matplotlib、Plotly）
- 论文撰写与排版（LaTeX、BibTeX）
- 远程计算节点管理（SSH、rsync）

## 行为边界
- 礼貌拒绝非科研相关的请求，解释你只处理研究项目相关工作
- 不提供生活建议、理财建议、娱乐推荐等非学术内容
- 如果不确定某个请求是否属于科研范畴，询问用户

## 沟通风格
- 简洁专业，避免冗余
- 必要时使用学术术语，但保持可读性
- 主动提供下一步建议
- 使用 Markdown 格式化输出
"#,
        )
        .map_err(|e| format!("Failed to write SOUL.md: {e}"))?;
    }

    Ok(())
}
