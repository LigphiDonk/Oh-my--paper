//! OpenClaw Gateway WebSocket bridge.
//!
//! Connects to the OpenClaw Gateway via WebSocket and translates its
//! streaming events into viwerleaf's `StreamChunk` enum, allowing the
//! existing `ChatPanel.tsx` frontend to work without modification.
//!
//! The OpenClaw Gateway wire protocol uses JSON messages over WS:
//! - Client → Gateway: `{ "type": "agent.send", "payload": { ... } }`
//! - Gateway → Client: `{ "type": "agent.stream", "payload": { ... } }`
//!
//! We map the Gateway events to the existing `StreamChunk` variants:
//! - `text_delta` → StreamChunk::TextDelta
//! - `thinking` → StreamChunk::ThinkingDelta
//! - `tool_use` → StreamChunk::ToolCallStart
//! - `tool_result` → StreamChunk::ToolCallResult
//! - `done` → StreamChunk::Done

use std::io::{Read, Write};
use std::net::TcpStream;
use std::time::Duration;

use anyhow::{Context, Result};
use tauri::{AppHandle, Emitter};

use crate::models::{StreamChunk, UsageInfo};

/// A minimal WebSocket frame reader/writer using raw TCP.
/// We avoid adding a full WebSocket crate dependency by implementing
/// the minimal subset needed for the OpenClaw Gateway local connection.

const DEFAULT_WS_URL: &str = "ws://127.0.0.1:18789";

/// Send a user message to the OpenClaw Gateway and stream the response
/// back as `agent:stream` events.
///
/// This function blocks until the agent completes its response.
pub fn send_and_stream(
    app_handle: &AppHandle,
    ws_url: &str,
    user_message: &str,
    system_prompt: &str,
    project_root: &str,
    session_id: &str,
) -> Result<(String, Option<UsageInfo>, Option<String>)> {
    let ws_url = if ws_url.is_empty() {
        DEFAULT_WS_URL
    } else {
        ws_url
    };

    // Parse ws:// URL to get host:port
    let addr = ws_url
        .trim_start_matches("ws://")
        .trim_start_matches("wss://");

    // Connect via TCP with timeout
    let stream = TcpStream::connect_timeout(
        &addr
            .parse()
            .unwrap_or_else(|_| "127.0.0.1:18789".parse().unwrap()),
        Duration::from_secs(10),
    )
    .with_context(|| format!("Failed to connect to OpenClaw Gateway at {ws_url}"))?;

    stream.set_read_timeout(Some(Duration::from_secs(300)))?;
    stream.set_write_timeout(Some(Duration::from_secs(30)))?;

    // Perform WebSocket handshake
    let handshake = format!(
        "GET / HTTP/1.1\r\n\
         Host: {addr}\r\n\
         Upgrade: websocket\r\n\
         Connection: Upgrade\r\n\
         Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==\r\n\
         Sec-WebSocket-Version: 13\r\n\
         \r\n"
    );

    let mut stream = stream;
    stream.write_all(handshake.as_bytes())?;

    // Read handshake response (we just need to confirm 101 Switching Protocols)
    let mut response_buf = [0u8; 1024];
    let n = stream.read(&mut response_buf)?;
    let response = String::from_utf8_lossy(&response_buf[..n]);
    if !response.contains("101") {
        return Err(anyhow::anyhow!(
            "WebSocket handshake failed: {}",
            response.lines().next().unwrap_or("unknown")
        ));
    }

    // Send the agent.send message
    let send_payload = serde_json::json!({
        "type": "agent.send",
        "payload": {
            "message": user_message,
            "systemPrompt": system_prompt,
            "sessionId": session_id,
            "cwd": project_root
        }
    });
    ws_send_text(&mut stream, &send_payload.to_string())?;

    // Read streaming responses
    let mut full_response = String::new();
    let mut done_usage: Option<UsageInfo> = None;
    let mut remote_session_id: Option<String> = None;

    loop {
        match ws_read_text(&mut stream) {
            Ok(text) => {
                if text.is_empty() {
                    continue;
                }

                let event: serde_json::Value = match serde_json::from_str(&text) {
                    Ok(v) => v,
                    Err(_) => continue,
                };

                let event_type = event
                    .get("type")
                    .and_then(|v| v.as_str())
                    .unwrap_or("");
                let payload = event.get("payload").cloned().unwrap_or(serde_json::Value::Null);

                match event_type {
                    // Text output from the agent
                    "text" | "text_delta" | "agent.text" => {
                        let content = payload
                            .get("content")
                            .or_else(|| payload.get("text"))
                            .and_then(|v| v.as_str())
                            .unwrap_or("");
                        if !content.is_empty() {
                            full_response.push_str(content);
                            let chunk = StreamChunk::TextDelta {
                                content: content.to_string(),
                            };
                            let _ = app_handle.emit("agent:stream", &chunk);
                        }
                    }

                    // Thinking / reasoning
                    "thinking" | "thinking_delta" | "agent.thinking" => {
                        let content = payload
                            .get("content")
                            .or_else(|| payload.get("text"))
                            .and_then(|v| v.as_str())
                            .unwrap_or("");
                        if !content.is_empty() {
                            let chunk = StreamChunk::ThinkingDelta {
                                content: content.to_string(),
                            };
                            let _ = app_handle.emit("agent:stream", &chunk);
                        }
                    }

                    // Tool use started
                    "tool_use" | "tool_call" | "agent.tool_use" => {
                        let tool_name = payload
                            .get("name")
                            .or_else(|| payload.get("tool"))
                            .and_then(|v| v.as_str())
                            .unwrap_or("unknown");
                        let tool_id = payload
                            .get("id")
                            .or_else(|| payload.get("toolUseId"))
                            .and_then(|v| v.as_str())
                            .unwrap_or("");
                        let args = payload
                            .get("input")
                            .or_else(|| payload.get("args"))
                            .cloned()
                            .unwrap_or(serde_json::Value::Null);

                        let chunk = StreamChunk::ToolCallStart {
                            tool_id: tool_name.to_string(),
                            tool_use_id: tool_id.to_string(),
                            args,
                        };
                        let _ = app_handle.emit("agent:stream", &chunk);
                    }

                    // Tool result
                    "tool_result" | "agent.tool_result" => {
                        let tool_name = payload
                            .get("name")
                            .or_else(|| payload.get("tool"))
                            .and_then(|v| v.as_str())
                            .unwrap_or("unknown");
                        let tool_id = payload
                            .get("id")
                            .or_else(|| payload.get("toolUseId"))
                            .and_then(|v| v.as_str())
                            .unwrap_or("");
                        let output = payload
                            .get("output")
                            .or_else(|| payload.get("result"))
                            .and_then(|v| v.as_str())
                            .unwrap_or("");
                        let status = payload
                            .get("status")
                            .and_then(|v| v.as_str())
                            .map(|s| s.to_string());

                        full_response.push('\n');
                        full_response.push_str(output);
                        full_response.push('\n');

                        let chunk = StreamChunk::ToolCallResult {
                            tool_id: tool_name.to_string(),
                            tool_use_id: tool_id.to_string(),
                            output: output.to_string(),
                            status,
                        };
                        let _ = app_handle.emit("agent:stream", &chunk);
                    }

                    // Agent finished
                    "done" | "agent.done" | "end" => {
                        let input_tokens = payload
                            .get("usage")
                            .and_then(|u| u.get("inputTokens"))
                            .and_then(|v| v.as_i64())
                            .unwrap_or(0);
                        let output_tokens = payload
                            .get("usage")
                            .and_then(|u| u.get("outputTokens"))
                            .and_then(|v| v.as_i64())
                            .unwrap_or(0);
                        let model = payload
                            .get("model")
                            .and_then(|v| v.as_str())
                            .unwrap_or("openclaw")
                            .to_string();

                        done_usage = Some(UsageInfo {
                            input_tokens,
                            output_tokens,
                            model,
                        });

                        remote_session_id = payload
                            .get("sessionId")
                            .and_then(|v| v.as_str())
                            .map(|s| s.to_string());

                        break;
                    }

                    // Error
                    "error" | "agent.error" => {
                        let message = payload
                            .get("message")
                            .or_else(|| payload.get("error"))
                            .and_then(|v| v.as_str())
                            .unwrap_or("Unknown error from OpenClaw Gateway");
                        let chunk = StreamChunk::Error {
                            message: message.to_string(),
                        };
                        let _ = app_handle.emit("agent:stream", &chunk);
                    }

                    // Status updates from Gateway
                    "status" | "agent.status" => {
                        let status = payload
                            .get("status")
                            .and_then(|v| v.as_str())
                            .unwrap_or("processing");
                        let message = payload
                            .get("message")
                            .and_then(|v| v.as_str())
                            .unwrap_or("");
                        let chunk = StreamChunk::StatusUpdate {
                            status: status.to_string(),
                            message: message.to_string(),
                        };
                        let _ = app_handle.emit("agent:stream", &chunk);
                    }

                    _ => {
                        // Unknown event type — log and skip
                        eprintln!("[OpenClaw Bridge] Unknown event type: {event_type}");
                    }
                }
            }
            Err(e) => {
                // Connection closed or read error
                if done_usage.is_none() {
                    let chunk = StreamChunk::Error {
                        message: format!("OpenClaw Gateway connection error: {e}"),
                    };
                    let _ = app_handle.emit("agent:stream", &chunk);
                }
                break;
            }
        }
    }

    Ok((full_response, done_usage, remote_session_id))
}

// ─── Minimal WebSocket frame helpers ────────────────────────────────────

/// Send a text frame over a WebSocket connection.
fn ws_send_text(stream: &mut TcpStream, text: &str) -> Result<()> {
    let payload = text.as_bytes();
    let len = payload.len();

    // Frame: FIN=1, opcode=1 (text)
    let mut frame = Vec::new();
    frame.push(0x81); // FIN + Text

    // Mask bit must be set for client-to-server frames
    if len < 126 {
        frame.push((len as u8) | 0x80); // Masked
    } else if len < 65536 {
        frame.push(126 | 0x80);
        frame.push((len >> 8) as u8);
        frame.push((len & 0xFF) as u8);
    } else {
        frame.push(127 | 0x80);
        for i in (0..8).rev() {
            frame.push(((len >> (8 * i)) & 0xFF) as u8);
        }
    }

    // Masking key (simple fixed key — local connection, security not critical)
    let mask_key = [0x12, 0x34, 0x56, 0x78];
    frame.extend_from_slice(&mask_key);

    // Masked payload
    for (i, byte) in payload.iter().enumerate() {
        frame.push(byte ^ mask_key[i % 4]);
    }

    stream.write_all(&frame)?;
    stream.flush()?;
    Ok(())
}

/// Read a text frame from a WebSocket connection.
fn ws_read_text(stream: &mut TcpStream) -> Result<String> {
    let mut header = [0u8; 2];
    stream.read_exact(&mut header)?;

    let _fin = (header[0] & 0x80) != 0;
    let opcode = header[0] & 0x0F;
    let masked = (header[1] & 0x80) != 0;
    let mut payload_len = (header[1] & 0x7F) as u64;

    // Close frame
    if opcode == 8 {
        return Err(anyhow::anyhow!("WebSocket connection closed by server"));
    }

    // Ping frame — send pong
    if opcode == 9 {
        let pong = [0x8A, 0x00]; // FIN + Pong, length 0
        stream.write_all(&pong)?;
        return Ok(String::new());
    }

    if payload_len == 126 {
        let mut ext = [0u8; 2];
        stream.read_exact(&mut ext)?;
        payload_len = u16::from_be_bytes(ext) as u64;
    } else if payload_len == 127 {
        let mut ext = [0u8; 8];
        stream.read_exact(&mut ext)?;
        payload_len = u64::from_be_bytes(ext);
    }

    let mask_key = if masked {
        let mut key = [0u8; 4];
        stream.read_exact(&mut key)?;
        Some(key)
    } else {
        None
    };

    let mut payload = vec![0u8; payload_len as usize];
    stream.read_exact(&mut payload)?;

    if let Some(key) = mask_key {
        for (i, byte) in payload.iter_mut().enumerate() {
            *byte ^= key[i % 4];
        }
    }

    Ok(String::from_utf8_lossy(&payload).to_string())
}
