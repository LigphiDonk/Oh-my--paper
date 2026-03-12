use std::collections::HashSet;
use std::io::{BufRead, Write};
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};

use anyhow::{Context, Result};
use rusqlite::{params, OptionalExtension};
use tauri::{AppHandle, Emitter};
use uuid::Uuid;

use crate::models::{
    AgentContext, AgentConversationMessage, AgentMessage, AgentProvider, AgentRequest,
    AgentRunResult, AgentSessionSummary, StreamChunk, UsageInfo,
};
use crate::services::{profile, provider, sidecar, skill};
use crate::state::AppState;

/// Insert the user message and ensure the session exists in the DB.
/// Called synchronously from the command handler *before* spawning the
/// background thread so the frontend can read the message immediately.
pub fn prepare_user_message(
    state: &AppState,
    profile_id: &str,
    session_id: &str,
    file_path: &str,
    user_message: &str,
) -> Result<()> {
    let project_root = {
        let config = state
            .project_config
            .read()
            .expect("project config lock poisoned");
        config.root_path.clone()
    };
    let effective_msg = if user_message.trim().is_empty() {
        format!("Run agent on {file_path}")
    } else {
        user_message.to_owned()
    };
    let conn = state.db.lock().expect("db lock poisoned");
    ensure_session(
        &conn,
        session_id,
        profile_id,
        &project_root,
        &build_session_title(&effective_msg),
    )?;
    conn.execute(
        "INSERT INTO messages (id, session_id, role, content, profile_id) VALUES (?1, ?2, 'user', ?3, ?4)",
        params![Uuid::new_v4().to_string(), session_id, effective_msg, profile_id],
    )?;
    touch_session(&conn, session_id)?;
    Ok(())
}

pub fn run_agent(
    app_handle: &AppHandle,
    state: &AppState,
    profile_id: &str,
    session_id: Option<&str>,
    file_path: &str,
    selected_text: &str,
    user_message: Option<&str>,
) -> Result<AgentRunResult> {
    let project_root = {
        let config = state
            .project_config
            .read()
            .expect("project config lock poisoned");
        config.root_path.clone()
    };

    let conn = state.db.lock().expect("db lock poisoned");
    let profile = profile::get_profile(&conn, profile_id).map_err(anyhow::Error::msg)?;
    let prov = provider::get_provider(&conn, &profile.provider_id).map_err(anyhow::Error::msg)?;
    let system_prompt =
        skill::load_skill_prompts(&conn, &profile.skill_ids).map_err(anyhow::Error::msg)?;
    drop(conn);

    let user_message = user_message
        .filter(|value| !value.trim().is_empty())
        .map(ToOwned::to_owned)
        .unwrap_or_else(|| {
            if selected_text.trim().is_empty() {
                format!("Run agent on {file_path}")
            } else {
                selected_text.to_string()
            }
        });

    let session_id = session_id
        .filter(|value| !value.trim().is_empty())
        .map(ToOwned::to_owned)
        .unwrap_or_else(|| Uuid::new_v4().to_string());

    let history = {
        let conn = state.db.lock().expect("db lock poisoned");
        load_session_history(&conn, &session_id)?
    };

    let request = AgentRequest {
        session_id: session_id.clone(),
        profile_id: profile_id.to_string(),
        provider: AgentProvider {
            vendor: prov.vendor.clone(),
            base_url: prov.base_url.clone(),
            api_key: prov.api_key.clone(),
            model: profile.model.clone(),
        },
        system_prompt,
        tools: profile.tool_allowlist.clone(),
        user_message: user_message.clone(),
        history,
        context: AgentContext {
            project_root: project_root.clone(),
            active_file_path: file_path.to_string(),
            selected_text: selected_text.to_string(),
            // Keep schema compatibility, but avoid eager full-file injection into prompts.
            full_file_content: String::new(),
            cursor_line: 1,
        },
    };
    let payload = serde_json::to_string(&request)?;

    // Session and user message are already inserted by prepare_user_message().
    // Only insert here if called without a prior prepare (e.g. in tests or
    // direct call path without the command wrapper).
    {
        let conn = state.db.lock().expect("db lock poisoned");
        let already_exists = conn
            .query_row(
                "SELECT id FROM sessions WHERE id=?1 LIMIT 1",
                params![session_id],
                |row| row.get::<_, String>(0),
            )
            .optional()?
            .is_some();
        if !already_exists {
            ensure_session(
                &conn,
                &session_id,
                profile_id,
                &project_root,
                &build_session_title(&user_message),
            )?;
            conn.execute(
                "INSERT INTO messages (id, session_id, role, content, profile_id) VALUES (?1, ?2, 'user', ?3, ?4)",
                params![
                    Uuid::new_v4().to_string(),
                    session_id,
                    user_message,
                    profile_id
                ],
            )?;
            touch_session(&conn, &session_id)?;
        }
    }

    let mut child = match sidecar::spawn_sidecar(state, "agent", &payload) {
        Ok(child) => child,
        Err(sidecar_err) => {
            return run_agent_with_opencode_binary(
                app_handle,
                state,
                &request,
                &profile.provider_id,
                profile_id,
                &session_id,
            )
            .with_context(|| format!("failed to spawn agent sidecar: {sidecar_err}"));
        }
    };

    let stdout = child.stdout.take().context("sidecar stdout unavailable")?;
    let reader = std::io::BufReader::new(stdout);
    let mut full_response = String::new();
    let mut last_error: Option<String> = None;
    let mut done_usage: Option<UsageInfo> = None;

    for line in reader.lines() {
        let line = line?;
        if line.trim().is_empty() {
            continue;
        }

        match serde_json::from_str::<StreamChunk>(&line) {
            Ok(chunk) => match &chunk {
                StreamChunk::TextDelta { content } => {
                    full_response.push_str(content);
                    let _ = app_handle.emit("agent:stream", &chunk);
                }
                StreamChunk::Done { usage } => {
                    done_usage = Some(usage.clone());
                }
                StreamChunk::Error { message } => {
                    last_error = Some(message.clone());
                    let _ = app_handle.emit("agent:stream", &chunk);
                }
                _ => {
                    let _ = app_handle.emit("agent:stream", &chunk);
                }
            },
            Err(err) => {
                let _ = app_handle.emit(
                    "agent:stream",
                    &StreamChunk::Error {
                        message: format!("failed to decode sidecar chunk: {err}"),
                    },
                );
            }
        }
    }

    let output = child
        .wait_with_output()
        .context("failed to wait for sidecar")?;
    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        let error_message = if stderr.trim().is_empty() {
            last_error.unwrap_or_else(|| "agent sidecar failed with empty stderr".to_string())
        } else {
            stderr.to_string()
        };
        let _ = app_handle.emit(
            "agent:stream",
            &StreamChunk::Error {
                message: error_message.clone(),
            },
        );
        persist_assistant_message(
            state,
            &session_id,
            profile_id,
            &format!("Error: {error_message}"),
        )?;
        return Err(anyhow::anyhow!("agent sidecar failed: {error_message}"));
    }

    if !full_response.is_empty() {
        persist_assistant_message(state, &session_id, profile_id, &full_response)?;
    } else if let Some(error_message) = last_error {
        persist_assistant_message(
            state,
            &session_id,
            profile_id,
            &format!("Error: {error_message}"),
        )?;
    }

    let usage = done_usage.unwrap_or_else(|| UsageInfo {
        input_tokens: 0,
        output_tokens: 0,
        model: profile.model.clone(),
    });

    {
        let conn = state.db.lock().expect("db lock poisoned");
        let _ = conn.execute(
            "INSERT INTO usage_logs (id, session_id, provider_id, model, input_tokens, output_tokens) VALUES (?1,?2,?3,?4,?5,?6)",
            params![
                Uuid::new_v4().to_string(),
                session_id,
                profile.provider_id,
                usage.model.clone(),
                usage.input_tokens,
                usage.output_tokens
            ],
        );
    }

    let _ = app_handle.emit("agent:stream", &StreamChunk::Done { usage });

    Ok(AgentRunResult {
        session_id: Some(session_id),
        message: None,
        suggested_patch: None,
    })
}

pub fn apply_agent_patch(root_path: &str, file_path: &str, content: &str) -> Result<()> {
    let absolute = Path::new(root_path).join(file_path);
    std::fs::write(absolute, content).context("failed to apply agent patch")?;
    Ok(())
}

pub fn get_agent_messages(state: &AppState, session_id: Option<&str>) -> Result<Vec<AgentMessage>> {
    let conn = state.db.lock().expect("db lock poisoned");
    let sql = if session_id.is_some() {
        "SELECT id, session_id, role, content, profile_id, tool_id, tool_args, created_at FROM messages WHERE session_id=?1 ORDER BY created_at"
    } else {
        "SELECT id, session_id, role, content, profile_id, tool_id, tool_args, created_at FROM messages ORDER BY created_at"
    };
    let mut stmt = conn.prepare(sql)?;
    let map_row = |row: &rusqlite::Row<'_>| {
        Ok(AgentMessage {
            id: row.get(0)?,
            session_id: row.get(1)?,
            role: row.get(2)?,
            content: row.get(3)?,
            profile_id: row.get(4)?,
            tool_id: row.get(5)?,
            tool_args: row.get(6)?,
            created_at: row.get(7)?,
        })
    };

    if let Some(session_id) = session_id {
        let rows = stmt.query_map(params![session_id], map_row)?;
        rows.collect::<Result<Vec<_>, _>>().map_err(Into::into)
    } else {
        let rows = stmt.query_map([], map_row)?;
        rows.collect::<Result<Vec<_>, _>>().map_err(Into::into)
    }
}

pub fn list_agent_sessions(state: &AppState) -> Result<Vec<AgentSessionSummary>> {
    let conn = state.db.lock().expect("db lock poisoned");
    let mut stmt = conn.prepare(
        "
        SELECT
          s.id,
          s.profile_id,
          s.title,
          s.created_at,
          s.updated_at,
          COUNT(m.id) AS message_count,
          COALESCE((
            SELECT mm.content
            FROM messages mm
            WHERE mm.session_id = s.id
            ORDER BY mm.created_at DESC
            LIMIT 1
          ), '') AS last_message
        FROM sessions s
        LEFT JOIN messages m ON m.session_id = s.id
        GROUP BY s.id
        ORDER BY datetime(s.updated_at) DESC, datetime(s.created_at) DESC
        ",
    )?;

    let rows = stmt.query_map([], |row| {
        let title: String = row.get(2)?;
        let last_message: String = row.get(6)?;
        Ok(AgentSessionSummary {
            id: row.get(0)?,
            profile_id: row.get(1)?,
            title: if title.trim().is_empty() {
                build_session_title(&last_message)
            } else {
                title
            },
            created_at: row.get(3)?,
            updated_at: row.get(4)?,
            message_count: row.get(5)?,
            last_message_preview: truncate_preview(&last_message, 80),
        })
    })?;

    rows.collect::<Result<Vec<_>, _>>().map_err(Into::into)
}

fn load_session_history(
    conn: &rusqlite::Connection,
    session_id: &str,
) -> Result<Vec<AgentConversationMessage>> {
    let mut stmt = conn.prepare(
        "SELECT role, content FROM messages WHERE session_id=?1 AND role IN ('user','assistant') ORDER BY created_at LIMIT 40",
    )?;
    let rows = stmt.query_map(params![session_id], |row| {
        Ok(AgentConversationMessage {
            role: row.get(0)?,
            content: row.get(1)?,
        })
    })?;

    rows.collect::<Result<Vec<_>, _>>().map_err(Into::into)
}

fn ensure_session(
    conn: &rusqlite::Connection,
    session_id: &str,
    profile_id: &str,
    project_root: &str,
    title: &str,
) -> Result<()> {
    let exists = conn
        .query_row(
            "SELECT id FROM sessions WHERE id=?1 LIMIT 1",
            params![session_id],
            |row| row.get::<_, String>(0),
        )
        .optional()?;

    if exists.is_none() {
        conn.execute(
            "INSERT INTO sessions (id, profile_id, project_dir, title) VALUES (?1, ?2, ?3, ?4)",
            params![session_id, profile_id, project_root, title],
        )?;
    }

    Ok(())
}

fn touch_session(conn: &rusqlite::Connection, session_id: &str) -> Result<()> {
    conn.execute(
        "UPDATE sessions SET updated_at=datetime('now') WHERE id=?1",
        params![session_id],
    )?;
    Ok(())
}

fn persist_assistant_message(
    state: &AppState,
    session_id: &str,
    profile_id: &str,
    content: &str,
) -> Result<()> {
    let conn = state.db.lock().expect("db lock poisoned");
    conn.execute(
        "INSERT INTO messages (id, session_id, role, content, profile_id) VALUES (?1, ?2, 'assistant', ?3, ?4)",
        params![
            Uuid::new_v4().to_string(),
            session_id,
            content,
            profile_id
        ],
    )?;
    touch_session(&conn, session_id)?;
    Ok(())
}

fn run_agent_with_opencode_binary(
    app_handle: &AppHandle,
    state: &AppState,
    request: &AgentRequest,
    provider_db_id: &str,
    profile_id: &str,
    session_id: &str,
) -> Result<AgentRunResult> {
    let opencode_provider_id = map_vendor_to_opencode_provider(&request.provider.vendor)
        .context("unsupported provider vendor")?;
    let model_ref = build_opencode_model_ref(opencode_provider_id, &request.provider.model);
    if model_ref.trim().is_empty() {
        anyhow::bail!("missing model for opencode fallback runner");
    }

    let opencode_bin = resolve_opencode_binary(&state.sidecar_dir)?;
    let prompt = build_opencode_prompt(request);
    let mut provider_options = serde_json::Map::new();
    if !request.provider.api_key.trim().is_empty() {
        provider_options.insert(
            "apiKey".to_string(),
            serde_json::Value::String(request.provider.api_key.clone()),
        );
    }
    if !request.provider.base_url.trim().is_empty() {
        provider_options.insert(
            "baseURL".to_string(),
            serde_json::Value::String(request.provider.base_url.clone()),
        );
    }

    let mut provider_entry = serde_json::Map::new();
    provider_entry.insert(
        "options".to_string(),
        serde_json::Value::Object(provider_options),
    );

    let mut provider_map = serde_json::Map::new();
    provider_map.insert(
        opencode_provider_id.to_string(),
        serde_json::Value::Object(provider_entry),
    );

    let config = serde_json::json!({
        "$schema": "https://opencode.ai/config.json",
        "share": "disabled",
        "model": model_ref,
        "enabled_providers": [opencode_provider_id],
        "provider": provider_map,
    });
    let config_raw = serde_json::to_string(&config)?;

    let project_root = if request.context.project_root.trim().is_empty() {
        ".".to_string()
    } else {
        request.context.project_root.clone()
    };
    let opencode_home = Path::new(&project_root)
        .join(".viewerleaf")
        .join("opencode-home");
    std::fs::create_dir_all(&opencode_home).ok();

    let mut child = Command::new(&opencode_bin)
        .args(["run", "--format", "json", "--model", &model_ref])
        .current_dir(&project_root)
        .env("OPENCODE_CLIENT", "viewerleaf")
        .env("OPENCODE_TEST_HOME", &opencode_home)
        .env("OPENCODE_DISABLE_PROJECT_CONFIG", "1")
        .env("OPENCODE_DISABLE_AUTOUPDATE", "1")
        .env("OPENCODE_AUTO_SHARE", "0")
        .env("OPENCODE_CONFIG_CONTENT", config_raw)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .with_context(|| {
            format!(
                "failed to spawn opencode binary at {}",
                opencode_bin.to_string_lossy()
            )
        })?;

    if let Some(mut stdin) = child.stdin.take() {
        stdin
            .write_all(prompt.as_bytes())
            .context("failed to write opencode prompt")?;
        drop(stdin);
    }

    let stdout = child.stdout.take().context("opencode stdout unavailable")?;
    let reader = std::io::BufReader::new(stdout);
    let mut full_response = String::new();
    let mut last_error: Option<String> = None;
    let mut started_tools = HashSet::new();

    for line in reader.lines() {
        let line = line?;
        let trimmed = line.trim();
        if trimmed.is_empty() {
            continue;
        }

        let Ok(event) = serde_json::from_str::<serde_json::Value>(trimmed) else {
            continue;
        };

        let event_type = event
            .get("type")
            .and_then(|value| value.as_str())
            .unwrap_or_default();
        match event_type {
            "text" => {
                let text = event
                    .get("part")
                    .and_then(|part| part.get("text"))
                    .and_then(|value| value.as_str())
                    .unwrap_or_default()
                    .to_string();
                if !text.is_empty() {
                    full_response.push_str(&text);
                    let _ =
                        app_handle.emit("agent:stream", &StreamChunk::TextDelta { content: text });
                }
            }
            "tool_use" => {
                let part = event.get("part").cloned().unwrap_or_default();
                let part_id = part
                    .get("id")
                    .and_then(|value| value.as_str())
                    .unwrap_or_default()
                    .to_string();
                let tool_id = part
                    .get("tool")
                    .and_then(|value| value.as_str())
                    .unwrap_or("tool")
                    .to_string();
                let input = part
                    .get("state")
                    .and_then(|state| state.get("input"))
                    .cloned()
                    .unwrap_or_else(|| serde_json::json!({}));
                let status = part
                    .get("state")
                    .and_then(|state| state.get("status"))
                    .and_then(|value| value.as_str())
                    .unwrap_or_default();

                if !part_id.is_empty() && !started_tools.contains(&part_id) {
                    started_tools.insert(part_id.clone());
                    let _ = app_handle.emit(
                        "agent:stream",
                        &StreamChunk::ToolCallStart {
                            tool_id: tool_id.clone(),
                            args: input,
                        },
                    );
                }

                if status == "completed" {
                    let output = value_to_text(
                        part.get("state")
                            .and_then(|state| state.get("output"))
                            .unwrap_or(&serde_json::Value::Null),
                    );
                    let _ = app_handle.emit(
                        "agent:stream",
                        &StreamChunk::ToolCallResult {
                            tool_id,
                            output,
                            status: Some("completed".to_string()),
                        },
                    );
                } else if status == "error" {
                    let output = value_to_text(
                        part.get("state")
                            .and_then(|state| state.get("error"))
                            .unwrap_or(&serde_json::Value::Null),
                    );
                    let _ = app_handle.emit(
                        "agent:stream",
                        &StreamChunk::ToolCallResult {
                            tool_id,
                            output,
                            status: Some("error".to_string()),
                        },
                    );
                }
            }
            "error" => {
                let message = extract_opencode_error_message(&event);
                last_error = Some(message.clone());
                let _ = app_handle.emit("agent:stream", &StreamChunk::Error { message });
            }
            _ => {}
        }
    }

    let output = child
        .wait_with_output()
        .context("failed to wait for opencode fallback")?;
    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
        let error_message = if stderr.is_empty() {
            last_error.unwrap_or_else(|| "opencode fallback failed".to_string())
        } else {
            stderr
        };
        let _ = app_handle.emit(
            "agent:stream",
            &StreamChunk::Error {
                message: error_message.clone(),
            },
        );
        persist_assistant_message(
            state,
            session_id,
            profile_id,
            &format!("Error: {error_message}"),
        )?;
        anyhow::bail!("opencode fallback failed: {error_message}");
    }

    if !full_response.is_empty() {
        persist_assistant_message(state, session_id, profile_id, &full_response)?;
    } else if let Some(error_message) = last_error {
        persist_assistant_message(
            state,
            session_id,
            profile_id,
            &format!("Error: {error_message}"),
        )?;
    }

    {
        let conn = state.db.lock().expect("db lock poisoned");
        let _ = conn.execute(
            "INSERT INTO usage_logs (id, session_id, provider_id, model, input_tokens, output_tokens) VALUES (?1,?2,?3,?4,0,0)",
            params![
                Uuid::new_v4().to_string(),
                session_id,
                provider_db_id,
                request.provider.model
            ],
        );
    }

    let _ = app_handle.emit(
        "agent:stream",
        &StreamChunk::Done {
            usage: UsageInfo {
                input_tokens: 0,
                output_tokens: 0,
                model: request.provider.model.clone(),
            },
        },
    );

    Ok(AgentRunResult {
        session_id: Some(session_id.to_string()),
        message: None,
        suggested_patch: None,
    })
}

fn resolve_opencode_binary(sidecar_dir: &Path) -> Result<PathBuf> {
    let binary_name = if cfg!(windows) {
        "opencode.exe"
    } else {
        "opencode"
    };
    let node_modules = sidecar_dir.join("node_modules");
    if !node_modules.is_dir() {
        anyhow::bail!(
            "sidecar node_modules not found at {}. Run `npm install --prefix sidecar` first.",
            node_modules.to_string_lossy()
        );
    }

    let mut candidates = Vec::new();
    for entry in std::fs::read_dir(&node_modules)? {
        let Ok(entry) = entry else {
            continue;
        };
        let name = entry.file_name();
        let name = name.to_string_lossy();
        if !name.starts_with("opencode-") || name == "opencode-ai" {
            continue;
        }
        let path = entry.path().join("bin").join(binary_name);
        if path.is_file() {
            candidates.push(path);
        }
    }

    candidates.sort();
    candidates
        .into_iter()
        .next()
        .context("opencode binary not found in sidecar/node_modules")
}

fn map_vendor_to_opencode_provider(vendor: &str) -> Option<&'static str> {
    match vendor {
        "openai" => Some("openai"),
        "anthropic" => Some("anthropic"),
        "openrouter" => Some("openrouter"),
        "deepseek" => Some("deepseek"),
        "google" => Some("google"),
        "custom" => Some("openai"),
        _ => None,
    }
}

fn build_opencode_model_ref(provider_id: &str, model: &str) -> String {
    let trimmed = model.trim();
    if trimmed.is_empty() {
        return String::new();
    }
    if trimmed.contains('/') {
        trimmed.to_string()
    } else {
        format!("{provider_id}/{trimmed}")
    }
}

fn build_opencode_prompt(request: &AgentRequest) -> String {
    let user_message = request.user_message.trim();
    let selected = request.context.selected_text.trim();
    let active_file = request.context.active_file_path.trim();

    if selected.is_empty() {
        if user_message.is_empty() {
            return "Continue.".to_string();
        }
        return user_message.to_string();
    }

    let selected_label = if active_file.is_empty() {
        "Selected text:".to_string()
    } else {
        format!("Selected text from {active_file}:")
    };
    let selected_block = format!("{selected_label}\n```\n{selected}\n```");

    if user_message.is_empty() || user_message == selected {
        return selected_block;
    }

    format!("{user_message}\n\n{selected_block}")
}

fn extract_opencode_error_message(event: &serde_json::Value) -> String {
    event
        .get("error")
        .and_then(|error| error.get("data"))
        .and_then(|data| data.get("message"))
        .and_then(|value| value.as_str())
        .filter(|value| !value.trim().is_empty())
        .map(|value| value.trim().to_string())
        .or_else(|| {
            event
                .get("error")
                .and_then(|error| error.get("name"))
                .and_then(|value| value.as_str())
                .map(|value| value.to_string())
        })
        .unwrap_or_else(|| "unknown opencode error".to_string())
}

fn value_to_text(value: &serde_json::Value) -> String {
    match value {
        serde_json::Value::String(text) => text.clone(),
        serde_json::Value::Null => String::new(),
        other => serde_json::to_string_pretty(other).unwrap_or_else(|_| other.to_string()),
    }
}

fn build_session_title(text: &str) -> String {
    let compact = text.replace('\n', " ").trim().to_string();
    if compact.is_empty() {
        return "新对话".to_string();
    }
    truncate_preview(&compact, 40)
}

fn truncate_preview(text: &str, max_chars: usize) -> String {
    if text.chars().count() <= max_chars {
        return text.to_string();
    }
    let mut out = String::new();
    for ch in text.chars().take(max_chars) {
        out.push(ch);
    }
    out.push_str("...");
    out
}
