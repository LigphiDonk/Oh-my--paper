use std::io::{Read, Write};
use std::path::PathBuf;
use std::sync::{Arc, Mutex};
use std::thread;

use anyhow::{anyhow, Context, Result};
use portable_pty::{native_pty_system, Child, CommandBuilder, MasterPty, PtySize};
use tauri::{Emitter, Manager, WebviewWindow};

use crate::models::{TerminalEvent, TerminalSessionInfo};
use crate::services::enriched_path;
use crate::state::AppState;

pub struct TerminalSessionHandle {
    master: Mutex<Box<dyn MasterPty + Send>>,
    writer: Mutex<Box<dyn Write + Send>>,
    child: Mutex<Box<dyn Child + Send + Sync>>,
}

pub fn start_terminal(
    window: &WebviewWindow,
    state: &AppState,
    cwd: Option<&str>,
    cols: u16,
    rows: u16,
) -> Result<TerminalSessionInfo> {
    let working_dir = resolve_cwd(state, cwd)?;
    let pty_system = native_pty_system();
    let pair = pty_system
        .openpty(pty_size(cols, rows))
        .context("failed to open terminal pty")?;

    let (shell_path, shell_label, shell_args) = resolve_shell();
    let mut command = CommandBuilder::new(&shell_path);
    for arg in shell_args {
        command.arg(arg);
    }
    command.cwd(&working_dir);
    command.env("TERM", "xterm-256color");
    command.env("COLORTERM", "truecolor");
    command.env("PATH", enriched_path());

    let child = pair
        .slave
        .spawn_command(command)
        .with_context(|| format!("failed to spawn shell {}", shell_path.display()))?;
    drop(pair.slave);

    let reader = pair
        .master
        .try_clone_reader()
        .context("failed to clone terminal reader")?;
    let writer = pair
        .master
        .take_writer()
        .context("failed to open terminal writer")?;

    let session_id = uuid::Uuid::new_v4().to_string();
    let session = Arc::new(TerminalSessionHandle {
        master: Mutex::new(pair.master),
        writer: Mutex::new(writer),
        child: Mutex::new(child),
    });

    state
        .terminals
        .lock()
        .map_err(|_| anyhow!("terminal registry is poisoned"))?
        .insert(session_id.clone(), Arc::clone(&session));

    spawn_output_thread(window, session_id.clone(), reader);
    spawn_exit_thread(window, session_id.clone(), session);

    Ok(TerminalSessionInfo {
        session_id,
        cwd: working_dir.to_string_lossy().to_string(),
        shell: shell_label,
    })
}

pub fn write_terminal(state: &AppState, session_id: &str, data: &str) -> Result<()> {
    if data.is_empty() {
        return Ok(());
    }

    let session = get_session(state, session_id)?;
    let mut writer = session
        .writer
        .lock()
        .map_err(|_| anyhow!("terminal writer is poisoned"))?;
    writer
        .write_all(data.as_bytes())
        .context("failed to write to terminal")?;
    let _ = writer.flush();
    Ok(())
}

pub fn resize_terminal(state: &AppState, session_id: &str, cols: u16, rows: u16) -> Result<()> {
    let session = get_session(state, session_id)?;
    let master = session
        .master
        .lock()
        .map_err(|_| anyhow!("terminal master is poisoned"))?;
    master
        .resize(pty_size(cols, rows))
        .context("failed to resize terminal")?;
    Ok(())
}

pub fn close_terminal(state: &AppState, session_id: &str) -> Result<()> {
    let session = state
        .terminals
        .lock()
        .map_err(|_| anyhow!("terminal registry is poisoned"))?
        .remove(session_id);

    if let Some(session) = session {
        if let Ok(mut child) = session.child.lock() {
            let _ = child.kill();
        }
    }

    Ok(())
}

fn get_session(state: &AppState, session_id: &str) -> Result<Arc<TerminalSessionHandle>> {
    let sessions = state
        .terminals
        .lock()
        .map_err(|_| anyhow!("terminal registry is poisoned"))?;
    sessions
        .get(session_id)
        .cloned()
        .ok_or_else(|| anyhow!("terminal session not found"))
}

fn spawn_output_thread(window: &WebviewWindow, session_id: String, mut reader: Box<dyn Read + Send>) {
    let app_handle = window.app_handle().clone();
    let window_label = window.label().to_string();

    thread::spawn(move || {
        let mut buffer = [0_u8; 8192];

        loop {
            match reader.read(&mut buffer) {
                Ok(0) => break,
                Ok(size) => {
                    let data = String::from_utf8_lossy(&buffer[..size]).into_owned();
                    emit_terminal_event(
                        &app_handle,
                        &window_label,
                        TerminalEvent::Output {
                            session_id: session_id.clone(),
                            data,
                        },
                    );
                }
                Err(error) => {
                    emit_terminal_event(
                        &app_handle,
                        &window_label,
                        TerminalEvent::Error {
                            session_id: session_id.clone(),
                            message: error.to_string(),
                        },
                    );
                    break;
                }
            }
        }
    });
}

fn spawn_exit_thread(
    window: &WebviewWindow,
    session_id: String,
    session: Arc<TerminalSessionHandle>,
) {
    let app_handle = window.app_handle().clone();
    let window_label = window.label().to_string();

    thread::spawn(move || {
        let wait_result = {
            let mut child = match session.child.lock() {
                Ok(child) => child,
                Err(_) => {
                    emit_terminal_event(
                        &app_handle,
                        &window_label,
                        TerminalEvent::Error {
                            session_id: session_id.clone(),
                            message: "terminal child lock poisoned".into(),
                        },
                    );
                    return;
                }
            };
            child.wait()
        };

        match wait_result {
            Ok(status) => emit_terminal_event(
                &app_handle,
                &window_label,
                TerminalEvent::Exit {
                    session_id: session_id.clone(),
                    exit_code: Some(status.exit_code()),
                    signal: status.signal().map(str::to_string),
                },
            ),
            Err(error) => emit_terminal_event(
                &app_handle,
                &window_label,
                TerminalEvent::Error {
                    session_id: session_id.clone(),
                    message: error.to_string(),
                },
            ),
        }

        if let Some(state) = app_handle.try_state::<AppState>() {
            if let Ok(mut terminals) = state.terminals.lock() {
                terminals.remove(&session_id);
            }
        }
    });
}

fn emit_terminal_event(app_handle: &tauri::AppHandle, window_label: &str, payload: TerminalEvent) {
    if let Some(window) = app_handle.get_webview_window(window_label) {
        let _ = window.emit("terminal:event", payload);
    }
}

fn resolve_cwd(state: &AppState, cwd: Option<&str>) -> Result<PathBuf> {
    let project_root = state
        .project_config
        .read()
        .map_err(|_| anyhow!("project config lock poisoned"))?
        .root_path
        .clone();

    let candidate = cwd
        .and_then(trimmed_path)
        .or_else(|| trimmed_path(&project_root))
        .or_else(dirs::home_dir)
        .or_else(|| std::env::current_dir().ok())
        .unwrap_or_else(|| PathBuf::from("."));

    if candidate.is_dir() {
        Ok(candidate)
    } else if let Some(parent) = candidate.parent() {
        Ok(parent.to_path_buf())
    } else {
        Err(anyhow!("terminal cwd is not accessible"))
    }
}

fn trimmed_path(value: &str) -> Option<PathBuf> {
    let trimmed = value.trim();
    if trimmed.is_empty() {
        None
    } else {
        Some(PathBuf::from(trimmed))
    }
}

fn resolve_shell() -> (PathBuf, String, Vec<String>) {
    #[cfg(target_os = "windows")]
    {
        let shell = std::env::var("COMSPEC")
            .ok()
            .filter(|value| !value.trim().is_empty())
            .map(PathBuf::from)
            .unwrap_or_else(|| PathBuf::from("powershell.exe"));
        let label = shell
            .file_name()
            .and_then(|name| name.to_str())
            .unwrap_or("powershell")
            .to_string();
        return (shell, label, Vec::new());
    }

    #[cfg(not(target_os = "windows"))]
    {
        let shell = std::env::var("SHELL")
            .ok()
            .filter(|value| !value.trim().is_empty())
            .map(PathBuf::from)
            .filter(|value| value.exists())
            .unwrap_or_else(|| PathBuf::from("/bin/zsh"));
        let label = shell
            .file_name()
            .and_then(|name| name.to_str())
            .unwrap_or("shell")
            .to_string();
        (shell, label, vec!["-l".into()])
    }
}

fn pty_size(cols: u16, rows: u16) -> PtySize {
    PtySize {
        rows: rows.max(6),
        cols: cols.max(24),
        pixel_width: 0,
        pixel_height: 0,
    }
}
