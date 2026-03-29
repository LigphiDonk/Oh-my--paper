//! AI Session Scanner
//!
//! Scans and parses local Claude Code and Codex conversation histories
//! for visualization in the Session Browser panel.
//!
//! Data sources:
//!   - Claude Code: `~/.claude/projects/<encoded-path>/*.jsonl`
//!   - Codex:       `~/.codex/session_index.jsonl` + `~/.codex/sessions/YYYY/MM/DD/*.jsonl`

use std::collections::HashMap;
use std::fs;
use std::io::{BufRead, BufReader};
use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};

// ── Public Data Types ──────────────────────────────────────────

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct SessionMeta {
    pub provider: String,
    pub session_id: String,
    pub title: String,
    pub summary: String,
    pub project_dir: Option<String>,
    pub created_at: Option<i64>,
    pub last_active_at: Option<i64>,
    pub message_count: u32,
    pub source_path: String,
    pub role_tag: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct SessionMessage {
    pub role: String,
    pub content: String,
    pub timestamp: Option<i64>,
    pub tool_id: Option<String>,
}

// ── Internal JSON Structures (Claude Code) ─────────────────────

#[derive(Deserialize)]
struct ClaudeJsonlEntry {
    #[serde(default, rename = "type")]
    entry_type: String,
    #[serde(default)]
    role: String,
    #[serde(default)]
    message: Option<ClaudeMessagePayload>,
    #[serde(default)]
    timestamp: Option<String>,
    #[serde(default)]
    cwd: Option<String>,
    #[serde(default, rename = "sessionId")]
    session_id: Option<String>,
    #[serde(default, rename = "parentToolUseID")]
    parent_tool_use_id: Option<String>,
}

#[derive(Deserialize)]
struct ClaudeMessagePayload {
    #[serde(default)]
    role: String,
    #[serde(default)]
    content: Option<serde_json::Value>,
}

// ── Internal JSON Structures (Codex) ───────────────────────────

#[derive(Deserialize)]
struct CodexSessionIndexEntry {
    id: String,
    #[serde(default)]
    thread_name: String,
    #[serde(default)]
    updated_at: String,
}

// ── Public API ─────────────────────────────────────────────────

/// Scan all sessions from both Claude Code and Codex providers.
pub fn scan_all_sessions() -> Vec<SessionMeta> {
    let mut sessions = Vec::new();

    if let Ok(claude_sessions) = scan_claude_sessions() {
        sessions.extend(claude_sessions);
    }

    if let Ok(codex_sessions) = scan_codex_sessions() {
        sessions.extend(codex_sessions);
    }

    // Sort by last_active_at descending
    sessions.sort_by(|a, b| {
        let a_time = a.last_active_at.unwrap_or(0);
        let b_time = b.last_active_at.unwrap_or(0);
        b_time.cmp(&a_time)
    });

    sessions
}

/// Load messages for a specific session.
pub fn load_session_messages(provider: &str, session_id: &str) -> Result<Vec<SessionMessage>, String> {
    match provider {
        "claude" => load_claude_session_messages(session_id),
        "codex" => load_codex_session_messages(session_id),
        _ => Err(format!("unknown provider: {}", provider)),
    }
}

/// Generate a resume command for a session.
pub fn get_resume_command(provider: &str, session_id: &str, project_dir: Option<&str>) -> String {
    let resume_cmd = match provider {
        "claude" => format!("claude --resume {}", session_id),
        "codex" => format!("codex --resume {}", session_id),
        _ => format!("echo 'Unknown provider: {}'", provider),
    };

    match project_dir {
        Some(dir) if !dir.is_empty() => {
            format!("cd {} && {}", shell_quote(dir), resume_cmd)
        }
        _ => resume_cmd,
    }
}

// ── Claude Code Scanner ────────────────────────────────────────

fn claude_projects_dir() -> Option<PathBuf> {
    dirs::home_dir().map(|home| home.join(".claude").join("projects"))
}

fn scan_claude_sessions() -> Result<Vec<SessionMeta>, String> {
    let projects_dir = claude_projects_dir()
        .ok_or_else(|| "cannot resolve home directory".to_string())?;

    if !projects_dir.is_dir() {
        return Ok(Vec::new());
    }

    let mut sessions = Vec::new();

    let entries = fs::read_dir(&projects_dir)
        .map_err(|e| format!("failed to read claude projects dir: {e}"))?;

    for project_entry in entries.flatten() {
        let project_path = project_entry.path();
        if !project_path.is_dir() {
            continue;
        }

        let project_dir = decode_claude_project_dir(
            project_path.file_name().unwrap_or_default().to_str().unwrap_or(""),
        );

        let jsonl_files = match fs::read_dir(&project_path) {
            Ok(files) => files,
            Err(_) => continue,
        };

        for file_entry in jsonl_files.flatten() {
            let file_path = file_entry.path();
            if file_path.extension().and_then(|e| e.to_str()) != Some("jsonl") {
                continue;
            }

            let file_name = file_path
                .file_stem()
                .and_then(|s| s.to_str())
                .unwrap_or("")
                .to_string();

            // Skip non-UUID filenames
            if file_name.len() < 32 {
                continue;
            }

            match parse_claude_session_meta(&file_path, &file_name, &project_dir) {
                Ok(meta) => sessions.push(meta),
                Err(_) => continue,
            }
        }
    }

    Ok(sessions)
}

fn parse_claude_session_meta(
    file_path: &Path,
    session_id: &str,
    project_dir: &str,
) -> Result<SessionMeta, String> {
    let file = fs::File::open(file_path)
        .map_err(|e| format!("failed to open {}: {e}", file_path.display()))?;
    let reader = BufReader::new(file);

    let mut title = String::new();
    let mut summary = String::new();
    let mut first_timestamp: Option<i64> = None;
    let mut last_timestamp: Option<i64> = None;
    let mut message_count: u32 = 0;
    let mut cwd: Option<String> = None;
    let mut user_messages = Vec::new();
    let mut assistant_messages = Vec::new();

    for line in reader.lines() {
        let line = match line {
            Ok(l) => l,
            Err(_) => continue,
        };

        if line.trim().is_empty() {
            continue;
        }

        let entry: ClaudeJsonlEntry = match serde_json::from_str(&line) {
            Ok(e) => e,
            Err(_) => continue,
        };

        // Extract timestamp
        if let Some(ts_str) = &entry.timestamp {
            if let Some(ts) = parse_timestamp(ts_str) {
                if first_timestamp.is_none() {
                    first_timestamp = Some(ts);
                }
                last_timestamp = Some(ts);
            }
        }

        // Extract cwd from first entry
        if cwd.is_none() {
            if let Some(entry_cwd) = &entry.cwd {
                if !entry_cwd.is_empty() {
                    cwd = Some(entry_cwd.clone());
                }
            }
        }

        // Count and extract messages
        let message_role = if !entry.role.is_empty() {
            Some(entry.role.clone())
        } else {
            entry.message.as_ref().map(|m| m.role.clone())
        };

        if let Some(ref role) = message_role {
            match role.as_str() {
                "human" | "user" => {
                    message_count += 1;
                    let text = extract_message_text(&entry);
                    if !text.is_empty() {
                        user_messages.push(text);
                    }
                }
                "assistant" => {
                    message_count += 1;
                    let text = extract_message_text(&entry);
                    if !text.is_empty() {
                        assistant_messages.push(text);
                    }
                }
                _ => {}
            }
        }
    }

    // Derive title from first user message
    title = user_messages
        .first()
        .map(|m| truncate_text(m, 80))
        .unwrap_or_else(|| format!("Session {}", &session_id[..8.min(session_id.len())]));

    // Derive summary from last assistant message
    summary = assistant_messages
        .last()
        .or(user_messages.last())
        .map(|m| truncate_text(m, 120))
        .unwrap_or_default();

    let effective_dir = cwd
        .clone()
        .unwrap_or_else(|| project_dir.to_string());

    let role_tag = infer_role_tag(&user_messages, &assistant_messages);

    Ok(SessionMeta {
        provider: "claude".into(),
        session_id: session_id.to_string(),
        title,
        summary,
        project_dir: if effective_dir.is_empty() {
            None
        } else {
            Some(effective_dir)
        },
        created_at: first_timestamp,
        last_active_at: last_timestamp,
        message_count,
        source_path: file_path.to_string_lossy().to_string(),
        role_tag,
    })
}

fn load_claude_session_messages(session_id: &str) -> Result<Vec<SessionMessage>, String> {
    let projects_dir = claude_projects_dir()
        .ok_or_else(|| "cannot resolve home directory".to_string())?;

    // Find the JSONL file across all project directories
    let file_path = find_claude_session_file(&projects_dir, session_id)?;

    let file = fs::File::open(&file_path)
        .map_err(|e| format!("failed to open session file: {e}"))?;
    let reader = BufReader::new(file);

    let mut messages = Vec::new();

    for line in reader.lines() {
        let line = match line {
            Ok(l) => l,
            Err(_) => continue,
        };

        if line.trim().is_empty() {
            continue;
        }

        let entry: ClaudeJsonlEntry = match serde_json::from_str(&line) {
            Ok(e) => e,
            Err(_) => continue,
        };

        let role = if !entry.role.is_empty() {
            entry.role.clone()
        } else if let Some(ref msg) = entry.message {
            msg.role.clone()
        } else {
            continue;
        };

        // Normalize role names
        let normalized_role = match role.as_str() {
            "human" => "user".to_string(),
            r => r.to_string(),
        };

        // Only include user/assistant/tool/system messages
        match normalized_role.as_str() {
            "user" | "assistant" | "tool" | "system" => {}
            _ => continue,
        }

        let text = extract_message_text(&entry);
        if text.is_empty() {
            // Skip progress/hook entries with no readable text
            if entry.entry_type == "progress" || entry.entry_type == "result" {
                continue;
            }
        }

        let timestamp = entry
            .timestamp
            .as_deref()
            .and_then(parse_timestamp);

        let tool_id = entry.parent_tool_use_id.clone();

        messages.push(SessionMessage {
            role: normalized_role,
            content: if text.is_empty() {
                format!("[{}]", entry.entry_type)
            } else {
                text
            },
            timestamp,
            tool_id,
        });
    }

    Ok(messages)
}

fn find_claude_session_file(projects_dir: &Path, session_id: &str) -> Result<PathBuf, String> {
    let target_filename = format!("{}.jsonl", session_id);

    if let Ok(entries) = fs::read_dir(projects_dir) {
        for project_entry in entries.flatten() {
            let project_path = project_entry.path();
            if !project_path.is_dir() {
                continue;
            }

            let candidate = project_path.join(&target_filename);
            if candidate.is_file() {
                return Ok(candidate);
            }
        }
    }

    Err(format!("session file not found: {}", session_id))
}

fn extract_message_text(entry: &ClaudeJsonlEntry) -> String {
    if let Some(ref msg) = entry.message {
        if let Some(ref content) = msg.content {
            return extract_content_text(content);
        }
    }
    String::new()
}

fn extract_content_text(content: &serde_json::Value) -> String {
    match content {
        serde_json::Value::String(s) => s.clone(),
        serde_json::Value::Array(arr) => {
            let mut parts = Vec::new();
            for item in arr {
                if let Some(text) = item.get("text").and_then(|v| v.as_str()) {
                    parts.push(text.to_string());
                } else if let Some(input) = item.get("input").and_then(|v| v.as_str()) {
                    parts.push(input.to_string());
                }
            }
            parts.join("\n")
        }
        _ => String::new(),
    }
}

fn decode_claude_project_dir(encoded: &str) -> String {
    // Claude encodes paths by replacing '/' with '-' in the directory name
    // e.g. "-Users-donkfeng-Desktop-viwerleaf" -> "/Users/donkfeng/Desktop/viwerleaf"
    if encoded.starts_with('-') {
        encoded.replacen('-', "/", 1).replace('-', "/")
    } else {
        encoded.replace('-', "/")
    }
}

// ── Codex Scanner ──────────────────────────────────────────────

fn codex_home_dir() -> Option<PathBuf> {
    dirs::home_dir().map(|home| home.join(".codex"))
}

fn scan_codex_sessions() -> Result<Vec<SessionMeta>, String> {
    let codex_dir = codex_home_dir()
        .ok_or_else(|| "cannot resolve home directory".to_string())?;

    let index_path = codex_dir.join("session_index.jsonl");
    if !index_path.is_file() {
        return Ok(Vec::new());
    }

    let file = fs::File::open(&index_path)
        .map_err(|e| format!("failed to open codex session index: {e}"))?;
    let reader = BufReader::new(file);

    let mut sessions = Vec::new();

    for line in reader.lines() {
        let line = match line {
            Ok(l) => l,
            Err(_) => continue,
        };

        if line.trim().is_empty() {
            continue;
        }

        let entry: CodexSessionIndexEntry = match serde_json::from_str(&line) {
            Ok(e) => e,
            Err(_) => continue,
        };

        let last_active = parse_timestamp(&entry.updated_at);
        let title = if entry.thread_name.trim().is_empty() {
            format!("Session {}", &entry.id[..8.min(entry.id.len())])
        } else {
            truncate_text(&entry.thread_name, 80)
        };

        // Simple role inference from title
        let role_tag = infer_role_from_text(&title);

        sessions.push(SessionMeta {
            provider: "codex".into(),
            session_id: entry.id,
            title,
            summary: String::new(),
            project_dir: None,
            created_at: last_active,
            last_active_at: last_active,
            message_count: 0,
            source_path: index_path.to_string_lossy().to_string(),
            role_tag,
        });
    }

    Ok(sessions)
}

fn load_codex_session_messages(session_id: &str) -> Result<Vec<SessionMessage>, String> {
    let codex_dir = codex_home_dir()
        .ok_or_else(|| "cannot resolve home directory".to_string())?;

    // Search in sessions/ and archived_sessions/
    let sessions_dir = codex_dir.join("sessions");
    let archived_dir = codex_dir.join("archived_sessions");

    let file_path = find_codex_session_file(&sessions_dir, session_id)
        .or_else(|_| find_codex_session_file(&archived_dir, session_id))?;

    let file = fs::File::open(&file_path)
        .map_err(|e| format!("failed to open codex session: {e}"))?;
    let reader = BufReader::new(file);

    let mut messages = Vec::new();

    for line in reader.lines() {
        let line = match line {
            Ok(l) => l,
            Err(_) => continue,
        };

        if line.trim().is_empty() {
            continue;
        }

        let value: serde_json::Value = match serde_json::from_str(&line) {
            Ok(v) => v,
            Err(_) => continue,
        };

        let role = value
            .get("role")
            .and_then(|v| v.as_str())
            .unwrap_or("system")
            .to_string();

        let content = if let Some(text) = value.get("content").and_then(|v| v.as_str()) {
            text.to_string()
        } else if let Some(arr) = value.get("content").and_then(|v| v.as_array()) {
            arr.iter()
                .filter_map(|item| item.get("text").and_then(|v| v.as_str()))
                .collect::<Vec<_>>()
                .join("\n")
        } else {
            continue;
        };

        if content.is_empty() {
            continue;
        }

        let timestamp = value
            .get("timestamp")
            .and_then(|v| v.as_str())
            .and_then(parse_timestamp);

        messages.push(SessionMessage {
            role,
            content,
            timestamp,
            tool_id: None,
        });
    }

    Ok(messages)
}

fn find_codex_session_file(base_dir: &Path, session_id: &str) -> Result<PathBuf, String> {
    if !base_dir.is_dir() {
        return Err("directory not found".into());
    }

    // Walk through YYYY/MM/DD directories and archived_sessions
    for entry in walkdir::WalkDir::new(base_dir)
        .max_depth(5)
        .into_iter()
        .filter_map(|e| e.ok())
    {
        let path = entry.path();
        if path.is_file() {
            if let Some(name) = path.file_name().and_then(|n| n.to_str()) {
                if name.contains(session_id) && name.ends_with(".jsonl") {
                    return Ok(path.to_path_buf());
                }
            }
        }
    }

    Err(format!("codex session not found: {}", session_id))
}

// ── Role Inference ─────────────────────────────────────────────

fn infer_role_tag(user_messages: &[String], assistant_messages: &[String]) -> String {
    let all_text: String = user_messages
        .iter()
        .chain(assistant_messages.iter())
        .take(5) // Only check first few messages for performance
        .map(|s| s.to_lowercase())
        .collect::<Vec<_>>()
        .join(" ");

    infer_role_from_text(&all_text)
}

fn infer_role_from_text(text: &str) -> String {
    let lower = text.to_lowercase();

    // Orchestrator keywords (planning, coordination, architecture)
    let orchestrator_keywords = [
        "plan", "architect", "design", "orchestrat", "coordinate",
        "strategy", "refactor", "restructur", "scaffold", "blueprint",
        "统筹", "规划", "架构", "设计", "重构", "协调",
    ];

    // Executor keywords (implementation, fixing, specific tasks)
    let executor_keywords = [
        "implement", "fix", "debug", "build", "deploy", "compile",
        "install", "configure", "migrate", "test", "error", "bug",
        "实现", "修复", "调试", "部署", "编译", "安装", "配置",
    ];

    // Research keywords
    let research_keywords = [
        "research", "paper", "thesis", "manuscript", "literature",
        "experiment", "survey", "analysis", "review", "citation",
        "研究", "论文", "综述", "实验", "分析", "文献",
    ];

    let orchestrator_score: usize = orchestrator_keywords
        .iter()
        .filter(|kw| lower.contains(*kw))
        .count();

    let executor_score: usize = executor_keywords
        .iter()
        .filter(|kw| lower.contains(*kw))
        .count();

    let research_score: usize = research_keywords
        .iter()
        .filter(|kw| lower.contains(*kw))
        .count();

    if research_score > orchestrator_score && research_score > executor_score {
        "research".to_string()
    } else if orchestrator_score > executor_score {
        "orchestrator".to_string()
    } else if executor_score > 0 {
        "executor".to_string()
    } else {
        "general".to_string()
    }
}

// ── Utilities ──────────────────────────────────────────────────

fn parse_timestamp(s: &str) -> Option<i64> {
    // Try ISO 8601 format: "2026-03-18T01:23:30.158Z"
    if let Ok(dt) = chrono::DateTime::parse_from_rfc3339(s) {
        return Some(dt.timestamp_millis());
    }

    // Try without timezone: "2026-03-18T01:23:30"
    if let Ok(dt) = chrono::NaiveDateTime::parse_from_str(s, "%Y-%m-%dT%H:%M:%S") {
        return Some(dt.and_utc().timestamp_millis());
    }

    // Try with fractional seconds
    if let Ok(dt) = chrono::NaiveDateTime::parse_from_str(s, "%Y-%m-%dT%H:%M:%S%.f") {
        return Some(dt.and_utc().timestamp_millis());
    }

    None
}

fn truncate_text(text: &str, max_chars: usize) -> String {
    let cleaned = text.trim().replace('\n', " ").replace('\r', "");
    if cleaned.chars().count() <= max_chars {
        cleaned
    } else {
        let truncated: String = cleaned.chars().take(max_chars).collect();
        format!("{}…", truncated.trim_end())
    }
}

fn shell_quote(value: &str) -> String {
    format!("'{}'", value.replace('\'', "'\"'\"'"))
}

// ── Tests ──────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_decode_claude_project_dir() {
        assert_eq!(
            decode_claude_project_dir("-Users-donkfeng-Desktop-viwerleaf"),
            "/Users/donkfeng/Desktop/viwerleaf"
        );
    }

    #[test]
    fn test_truncate_text() {
        assert_eq!(truncate_text("hello world", 20), "hello world");
        assert_eq!(truncate_text("hello world", 5), "hello…");
    }

    #[test]
    fn test_infer_role_from_text() {
        assert_eq!(infer_role_from_text("please implement the login page"), "executor");
        assert_eq!(infer_role_from_text("plan the architecture for the new system"), "orchestrator");
        assert_eq!(infer_role_from_text("help me research papers on reinforcement learning"), "research");
        assert_eq!(infer_role_from_text("hello how are you"), "general");
    }

    #[test]
    fn test_parse_timestamp() {
        assert!(parse_timestamp("2026-03-18T01:23:30.158Z").is_some());
        assert!(parse_timestamp("2026-03-06T01:35:55.27096Z").is_some());
        assert!(parse_timestamp("not-a-timestamp").is_none());
    }

    #[test]
    fn test_shell_quote() {
        assert_eq!(shell_quote("/Users/test"), "'/Users/test'");
        assert_eq!(shell_quote("it's a test"), "'it'\"'\"'s a test'");
    }

    #[test]
    fn test_get_resume_command() {
        let cmd = get_resume_command("claude", "abc123", Some("/Users/test"));
        assert!(cmd.contains("claude --resume abc123"));
        assert!(cmd.contains("cd"));

        let cmd_no_dir = get_resume_command("codex", "xyz789", None);
        assert_eq!(cmd_no_dir, "codex --resume xyz789");
    }
}
