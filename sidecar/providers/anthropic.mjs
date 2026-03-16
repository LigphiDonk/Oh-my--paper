import Anthropic from "@anthropic-ai/sdk";

function stringifyContent(value) {
  if (typeof value === "string") {
    return value;
  }
  if (value == null) {
    return "";
  }
  return JSON.stringify(value);
}

function parseToolArguments(rawArgs) {
  if (rawArgs && typeof rawArgs === "object") {
    return rawArgs;
  }
  if (typeof rawArgs !== "string" || !rawArgs.trim()) {
    return {};
  }

  try {
    return JSON.parse(rawArgs);
  } catch {
    return {};
  }
}

function toAnthropicMessages(messages) {
  const output = [];

  for (const message of messages) {
    if (!message || message.role === "system") {
      continue;
    }

    if (message.role === "user") {
      output.push({
        role: "user",
        content: stringifyContent(message.content),
      });
      continue;
    }

    if (message.role === "assistant") {
      const content = [];
      const text = stringifyContent(message.content).trim();
      if (text) {
        content.push({ type: "text", text });
      }

      for (const toolCall of Array.isArray(message.tool_calls) ? message.tool_calls : []) {
        const name = toolCall?.function?.name;
        if (!name) {
          continue;
        }
        content.push({
          type: "tool_use",
          id: toolCall.id,
          name,
          input: parseToolArguments(toolCall?.function?.arguments),
        });
      }

      if (content.length === 0) {
        continue;
      }

      output.push({
        role: "assistant",
        content: content.length === 1 && content[0].type === "text" ? content[0].text : content,
      });
      continue;
    }

    if (message.role === "tool") {
      const block = {
        type: "tool_result",
        tool_use_id: message.tool_call_id,
        content: stringifyContent(message.content),
      };
      const last = output[output.length - 1];
      if (last?.role === "user" && Array.isArray(last.content) && last.content.every((item) => item.type === "tool_result")) {
        last.content.push(block);
      } else {
        output.push({
          role: "user",
          content: [block],
        });
      }
    }
  }

  return output;
}

function resolveMaxTokens(model) {
  const m = String(model || "").toLowerCase();
  if (/claude-4|claude-opus-4|claude-sonnet-4/.test(m)) return 16384;
  if (/claude-3[.-]5|claude-3\.5/.test(m)) return 8192;
  return 4096;
}

function isThinkingCapable(model) {
  const m = String(model || "").toLowerCase();
  return /claude-4|claude-opus-4|claude-sonnet-4|claude-3[.-]5-sonnet|claude-3[.-]7/.test(m);
}

export function createAnthropicProvider(config) {
  const client = new Anthropic({
    apiKey: config.apiKey,
    baseURL: config.baseUrl || undefined,
    // Prevent ANTHROPIC_AUTH_TOKEN env var from injecting Authorization: Bearer,
    // which some reverse-proxy endpoints reject.
    authToken: null,
    fetch: (url, opts = {}) => {
      const headers = new Headers(opts.headers);
      // Some reverse-proxy endpoints block SDK-specific headers.
      headers.delete("authorization");
      headers.delete("user-agent");
      return fetch(url, { ...opts, headers });
    },
  });

  let totalInputTokens = 0;
  let totalOutputTokens = 0;

  return {
    async *chat({ messages, tools }) {
      const systemMessages = messages.filter((message) => message.role === "system");
      const system = systemMessages.map((message) => message.content).join("\n\n");

      const anthropicTools = tools.map((tool) => ({
        name: tool.id,
        description: tool.description,
        input_schema: tool.parameters,
      }));

      // Only enable thinking if explicitly opted in via config
      const thinkingEnabled = config.enableThinking && isThinkingCapable(config.model);
      const streamParams = {
        model: config.model,
        max_tokens: resolveMaxTokens(config.model),
        system,
        messages: toAnthropicMessages(messages),
        tools: anthropicTools.length > 0 ? anthropicTools : undefined,
      };
      if (thinkingEnabled) {
        streamParams.thinking = { type: "enabled", budget_tokens: 4096 };
      }

      const stream = client.messages.stream(streamParams);

      let currentToolBlock = null;
      let inThinking = false;

      for await (const event of stream) {
        if (event.type === "message_start" && event.message?.usage) {
          totalInputTokens += event.message.usage.input_tokens || 0;
        } else if (event.type === "content_block_start" && event.content_block?.type === "thinking") {
          inThinking = true;
          yield { type: "thinking_start" };
        } else if (event.type === "content_block_start" && event.content_block?.type === "tool_use") {
          currentToolBlock = {
            id: event.content_block.id,
            name: event.content_block.name,
            inputJson: "",
          };
        } else if (event.type === "content_block_delta") {
          if (event.delta?.type === "thinking_delta") {
            yield { type: "thinking", text: event.delta.thinking };
          } else if (event.delta?.type === "text_delta") {
            yield { type: "text", text: event.delta.text };
          } else if (event.delta?.type === "input_json_delta" && currentToolBlock) {
            currentToolBlock.inputJson += event.delta.partial_json;
          }
        } else if (event.type === "content_block_stop" && inThinking) {
          inThinking = false;
          yield { type: "thinking_end" };
        } else if (event.type === "content_block_stop" && currentToolBlock) {
          let parsedArgs = {};
          try {
            parsedArgs = JSON.parse(currentToolBlock.inputJson || "{}");
          } catch {
            parsedArgs = {};
          }
          yield {
            type: "tool_call",
            id: currentToolBlock.id,
            name: currentToolBlock.name,
            args: parsedArgs,
          };
          currentToolBlock = null;
        } else if (event.type === "message_delta" && event.usage) {
          totalOutputTokens += event.usage.output_tokens || 0;
        }
      }
    },

    getUsage() {
      return {
        inputTokens: totalInputTokens,
        outputTokens: totalOutputTokens,
        model: config.model,
      };
    },
  };
}
