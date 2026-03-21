/**
 * OpenAI Codex CLI Runner
 *
 * Uses @openai/codex-sdk to interact with the locally installed Codex CLI.
 * The SDK handles tool execution internally (sandbox mode, file changes,
 * shell commands). We stream events as NDJSON StreamChunks.
 *
 * Reference: dr-claw server/openai-codex.js
 */

import { Codex } from "@openai/codex-sdk";
import { emit } from "../utils/ndjson.mjs";
import { requireCliExecutable } from "../utils/resolve-cli.mjs";

/**
 * Map permission mode string to Codex SDK sandbox/approval options.
 */
function mapPermissionMode(permissionMode) {
  switch (permissionMode) {
    case "acceptEdits":
      return {
        sandboxMode: "workspace-write",
        approvalPolicy: "never",
      };
    case "bypassPermissions":
      return {
        sandboxMode: "danger-full-access",
        approvalPolicy: "never",
      };
    case "default":
    default:
      return {
        sandboxMode: "workspace-write",
        approvalPolicy: "untrusted",
      };
  }
}

/**
 * Transform a Codex SDK event into a viwerleaf StreamChunk.
 * Returns null to skip the event.
 */
function transformCodexEvent(event) {
  switch (event.type) {
    case "item.started":
    case "item.completed": {
      const item = event.item;
      if (!item) return null;

      switch (item.type) {
        case "agent_message": {
          const text = item.text || "";
          if (!text.trim()) return null;
          return { type: "text_delta", content: text };
        }

        case "reasoning":
          // Codex reasoning items are brief status notes — skip them
          return null;

        case "command_execution": {
          // Extract command string (may be JSON-wrapped)
          let command = item.command || "";
          try {
            const parsed = JSON.parse(command);
            if (parsed.cmd) command = parsed.cmd;
          } catch {
            // Not JSON, use as-is
          }

          if (event.type === "item.started") {
            return {
              type: "tool_call_start",
              toolId: "bash",
              args: { command },
            };
          }

          // item.completed
          const output = item.aggregated_output || "";
          const status =
            item.exit_code === 0 || item.exit_code == null
              ? "completed"
              : "error";
          return {
            type: "tool_call_result",
            toolId: "bash",
            output: output.length > 4000 ? output.slice(0, 4000) + "\n[truncated]" : output,
            status,
          };
        }

        case "file_change": {
          if (event.type === "item.started") {
            const changes = item.changes || [];
            const summary = changes
              .map((c) => `${c.type || "modify"}: ${c.file || "unknown"}`)
              .join(", ");
            return {
              type: "tool_call_start",
              toolId: "file_change",
              args: { changes: summary },
            };
          }
          return {
            type: "tool_call_result",
            toolId: "file_change",
            output: "file changes applied",
            status: "completed",
          };
        }

        case "web_search": {
          return {
            type: "tool_call_start",
            toolId: "web_search",
            args: { query: item.query || "" },
          };
        }

        case "error":
          return {
            type: "error",
            message: item.message || "codex error",
          };

        default:
          return null;
      }
    }

    case "item.updated":
      // Skip streaming noise
      return null;

    case "turn.started":
      return null;

    case "turn.completed":
      // Return usage info for token tracking
      return {
        type: "_usage",
        usage: event.usage,
      };

    case "turn.failed":
      return {
        type: "error",
        message: event.error?.message || "codex turn failed",
      };

    case "error":
      return {
        type: "error",
        message: event.message || "codex error",
      };

    default:
      return null;
  }
}

/**
 * Run an agent session using Codex SDK.
 * @param {object} request - The agent request payload from Rust
 */
export async function runCodex(request) {
  const workingDirectory =
    request.context?.projectRoot || process.cwd();
  const permissionMode = request.provider?.permissionMode || "default";
  const { sandboxMode, approvalPolicy } = mapPermissionMode(permissionMode);
  const model = request.provider?.model || undefined;

  const userMessage =
    typeof request.userMessage === "string" && request.userMessage.trim()
      ? request.userMessage.trim()
      : "Continue.";

  // Build the prompt — prepend skill prompts if present
  let prompt = userMessage;
  if (request.systemPrompt && request.systemPrompt.trim()) {
    prompt = `${request.systemPrompt.trim()}\n\n---\n\n${userMessage}`;
  }

  let totalInputTokens = 0;
  let totalOutputTokens = 0;

  const abortController = new AbortController();

  try {
    const codexPathOverride = await requireCliExecutable("codex");
    const codex = new Codex({ codexPathOverride });

    // Thread options
    const threadOptions = {
      workingDirectory,
      skipGitRepoCheck: true,
      sandboxMode,
      approvalPolicy,
      model,
    };

    // Start or resume thread
    let thread;
    if (request.sessionId) {
      try {
        thread = codex.resumeThread(request.sessionId, threadOptions);
      } catch {
        // Session not found, start fresh
        thread = codex.startThread(threadOptions);
      }
    } else {
      thread = codex.startThread(threadOptions);
    }

    // Execute with streaming
    const streamedTurn = await thread.runStreamed(prompt, {
      signal: abortController.signal,
    });

    for await (const event of streamedTurn.events) {
      const transformed = transformCodexEvent(event);
      if (!transformed) continue;

      // Internal usage event — extract token counts
      if (transformed.type === "_usage") {
        if (transformed.usage) {
          totalInputTokens += transformed.usage.input_tokens || 0;
          totalOutputTokens += transformed.usage.output_tokens || 0;
        }
        continue;
      }

      emit(transformed);
    }
  } catch (error) {
    const wasAborted =
      error?.name === "AbortError" ||
      String(error?.message || "")
        .toLowerCase()
        .includes("aborted");

    if (!wasAborted) {
      emit({
        type: "error",
        message: error?.message || String(error),
      });
    }
  }

  emit({
    type: "done",
    usage: {
      inputTokens: totalInputTokens,
      outputTokens: totalOutputTokens,
      model: model || "codex",
    },
  });
}
