use std::io::Write;
use std::path::{Path, PathBuf};
use std::process::{Child, ChildStdin, Command, Output, Stdio};

#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;

use anyhow::{bail, Context, Result};

use crate::state::AppState;

const SIDECAR_ENTRY: &str = "dist/index.mjs";
const NODE_ENV_KEY: &str = "VIEWERLEAF_NODE_PATH";
#[cfg(target_os = "windows")]
const CREATE_NO_WINDOW: u32 = 0x08000000;

pub fn spawn_sidecar(state: &AppState, command: &str, payload: &str) -> Result<Child> {
    let node = resolve_node_binary()?;
    let sidecar_entry = resolve_sidecar_entry(state)?;

    let mut process = Command::new(&node);
    process
        .arg(&sidecar_entry)
        .arg(command)
        .arg("--stdin-payload")
        .current_dir(&state.sidecar_dir)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());

    // Place sidecar in its own process group so cancel_agent can kill
    // the entire tree (Node entry + Claude CLI child) with a single signal.
    #[cfg(unix)]
    {
        use std::os::unix::process::CommandExt;
        process.process_group(0);
    }

    #[cfg(target_os = "windows")]
    process.creation_flags(CREATE_NO_WINDOW);

    let mut child = process.spawn().with_context(|| {
        format!(
            "failed to spawn sidecar `{command}` with node {}",
            node.to_string_lossy()
        )
    })?;

    write_payload_and_close(&mut child, payload)?;

    Ok(child)
}

/// Like `spawn_sidecar`, but keeps stdin open and returns the `ChildStdin`
/// handle so the caller can send further messages (e.g. permission responses)
/// to the sidecar process during the session.
pub fn spawn_sidecar_with_stdin(
    state: &AppState,
    command: &str,
    payload: &str,
) -> Result<(Child, ChildStdin)> {
    let node = resolve_node_binary()?;
    let sidecar_entry = resolve_sidecar_entry(state)?;

    let mut process = Command::new(&node);
    process
        .arg(&sidecar_entry)
        .arg(command)
        .arg("--stdin-payload")
        .current_dir(&state.sidecar_dir)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());

    #[cfg(unix)]
    {
        use std::os::unix::process::CommandExt;
        process.process_group(0);
    }

    #[cfg(target_os = "windows")]
    process.creation_flags(CREATE_NO_WINDOW);

    let mut child = process.spawn().with_context(|| {
        format!(
            "failed to spawn sidecar `{command}` with node {}",
            node.to_string_lossy()
        )
    })?;

    let stdin = write_payload_keep_open(&mut child, payload)?;

    Ok((child, stdin))
}

pub fn run_sidecar(state: &AppState, command: &str, payload: &str) -> Result<Output> {
    let child = spawn_sidecar(state, command, payload)?;
    child
        .wait_with_output()
        .context("failed to wait for sidecar")
}

fn resolve_sidecar_entry(state: &AppState) -> Result<PathBuf> {
    let entry = state.sidecar_dir.join(SIDECAR_ENTRY);
    if entry.is_file() {
        return Ok(entry);
    }

    bail!(
        "sidecar entry not found at {}. Ensure sidecar resources are bundled.",
        entry.to_string_lossy()
    )
}

fn resolve_node_binary() -> Result<PathBuf> {
    if let Ok(explicit) = std::env::var(NODE_ENV_KEY) {
        let candidate = PathBuf::from(explicit.trim());
        if is_valid_binary(&candidate) {
            return Ok(candidate);
        }
    }

    if let Some(path_node) = resolve_from_path() {
        return Ok(path_node);
    }

    if let Some(shell_node) = resolve_from_login_shell() {
        return Ok(shell_node);
    }

    for candidate in common_node_locations() {
        if is_valid_binary(&candidate) {
            return Ok(candidate);
        }
    }

    bail!(
        "node runtime not found. Install Node.js or set {} to an absolute node binary path.",
        NODE_ENV_KEY
    )
}

fn is_valid_binary(path: &Path) -> bool {
    path.exists() && path.is_file()
}

fn resolve_from_path() -> Option<PathBuf> {
    #[cfg(windows)]
    {
        let output = Command::new("where.exe").arg("node").output().ok()?;
        if !output.status.success() {
            return None;
        }
        parse_output_path(&output.stdout)
    }
    #[cfg(not(windows))]
    {
        let output = Command::new("which").arg("node").output().ok()?;
        if !output.status.success() {
            return None;
        }
        parse_output_path(&output.stdout)
    }
}

fn resolve_from_login_shell() -> Option<PathBuf> {
    // Login shell resolution is Unix-only; Windows finds node via PATH/where.exe above.
    #[cfg(not(windows))]
    {
        let shell = std::env::var("SHELL").unwrap_or_else(|_| "/bin/zsh".into());
        let output = Command::new(shell)
            .args(["-lc", "command -v node"])
            .output()
            .ok()?;
        if !output.status.success() {
            return None;
        }
        parse_output_path(&output.stdout)
    }
    #[cfg(windows)]
    {
        None
    }
}

fn parse_output_path(stdout: &[u8]) -> Option<PathBuf> {
    let path = String::from_utf8_lossy(stdout);
    let first = path.lines().next()?.trim();
    if first.is_empty() {
        return None;
    }

    let candidate = PathBuf::from(first);
    if is_valid_binary(&candidate) {
        Some(candidate)
    } else {
        None
    }
}

fn common_node_locations() -> Vec<PathBuf> {
    #[cfg(windows)]
    {
        vec![
            PathBuf::from(r"C:\Program Files\nodejs\node.exe"),
            PathBuf::from(r"C:\Program Files (x86)\nodejs\node.exe"),
            // Scoop / nvm-windows common locations
            PathBuf::from(r"C:\ProgramData\nvm\node.exe"),
        ]
    }
    #[cfg(not(windows))]
    {
        vec![
            PathBuf::from("/opt/homebrew/bin/node"),
            PathBuf::from("/usr/local/bin/node"),
            PathBuf::from("/usr/bin/node"),
        ]
    }
}

fn write_payload_and_close(child: &mut Child, payload: &str) -> Result<()> {
    let mut stdin = child.stdin.take().context("sidecar stdin unavailable")?;
    if !payload.is_empty() {
        stdin
            .write_all(payload.as_bytes())
            .context("failed to write sidecar payload")?;
    }
    drop(stdin);
    Ok(())
}

/// Write the payload as a single NDJSON line (terminated by newline) and
/// return the stdin handle so the caller can send further messages.
fn write_payload_keep_open(child: &mut Child, payload: &str) -> Result<ChildStdin> {
    let mut stdin = child.stdin.take().context("sidecar stdin unavailable")?;
    if !payload.is_empty() {
        stdin
            .write_all(payload.as_bytes())
            .context("failed to write sidecar payload")?;
        // Ensure a newline terminates the payload line so the sidecar
        // can detect the boundary between payload and subsequent messages.
        if !payload.ends_with('\n') {
            stdin
                .write_all(b"\n")
                .context("failed to write payload newline")?;
        }
    }
    Ok(stdin)
}
