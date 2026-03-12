import { useCallback, useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";

import type {
  AgentMessage,
  AgentSessionSummary,
  SkillManifest,
  StreamToolCall,
  UsageRecord,
} from "../types";

/* ─── stream block parser ─────────────────────────────── */
interface ToolCallBlock {
  id: string;
  toolId: string;
  args?: Record<string, unknown>;
  output?: string;
  status: "running" | "completed" | "error";
}
interface StreamBlock { text: string; toolCalls: ToolCallBlock[] }

function parseStreamBlocks(raw: string): StreamBlock {
  const re = /\[Tool: ([^\]]+)\]\n(?:\[Result: ([\s\S]*?)\]\n)?/g;
  const toolCalls: ToolCallBlock[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(raw)) !== null) {
    const output = m[2]?.trim();
    toolCalls.push({
      id: `${m.index}-${m[1]}`,
      toolId: m[1],
      output,
      status: output ? "completed" : "running",
    });
  }
  const text = raw
    .replace(/\[Tool: [^\]]+\]\n(?:\[Result: [\s\S]*?\]\n)?/g, "")
    .replace(/\[Error: [\s\S]*?\]\n?/g, "")
    .trim();
  return { text, toolCalls };
}

function toToolCallBlock(call: StreamToolCall): ToolCallBlock {
  return {
    id: call.id,
    toolId: call.toolId,
    args: call.args,
    output: call.output,
    status: call.status,
  };
}

function summarizeToolCall(call: ToolCallBlock) {
  const firstStringArg = (() => {
    if (!call.args) {
      return "";
    }
    const candidates = [
      call.args.filePath,
      call.args.path,
      call.args.query,
      call.args.pattern,
      call.args.oldString,
    ].filter((value) => typeof value === "string" && value.trim().length > 0) as string[];
    return candidates[0] ?? "";
  })();

  const target = firstStringArg.length > 36 ? `${firstStringArg.slice(0, 36)}…` : firstStringArg;
  const prefix = call.status === "running" ? "正在" : call.status === "error" ? "失败" : "已完成";

  switch (call.toolId) {
    case "tool_search":
      return `${prefix}分析可用工具`;
    case "list":
    case "list_files":
      return `${prefix}查看项目结构${target ? ` · ${target}` : ""}`;
    case "read":
    case "read_section":
      return `${prefix}读取文件${target ? ` · ${target}` : ""}`;
    case "list_sections":
      return `${prefix}提取章节结构`;
    case "grep":
    case "search_project":
      return `${prefix}搜索内容${target ? ` · ${target}` : ""}`;
    case "glob":
      return `${prefix}查找匹配文件${target ? ` · ${target}` : ""}`;
    case "read_bib_entries":
      return `${prefix}读取参考文献`;
    case "edit":
    case "write":
    case "apply_patch":
    case "apply_text_patch":
    case "insert_at_line":
      return `${prefix}修改文件${target ? ` · ${target}` : ""}`;
    default:
      return `${prefix}调用 ${call.toolId}${target ? ` · ${target}` : ""}`;
  }
}

function ToolStatusRow({ call }: { call: ToolCallBlock }) {
  const summary = summarizeToolCall(call);
  const preview = call.output?.trim()
    ? call.output.trim().split("\n").find((line) => line.trim().length > 0) ?? ""
    : "";
  const shortPreview = preview.length > 88 ? `${preview.slice(0, 88)}…` : preview;

  return (
    <div className={`ag-tool-status-row ag-tool-status-row--${call.status}`}>
      <span className="ag-tool-status-icon">
        {call.status === "running" ? (
          <span className="ag-tool-spinner" />
        ) : call.status === "error" ? (
          "!"
        ) : (
          "·"
        )}
      </span>
      <span className="ag-tool-status-text">{summary}</span>
      {call.status !== "running" && shortPreview && (
        <span className="ag-tool-status-preview">{shortPreview}</span>
      )}
    </div>
  );
}

/* ─── Tool call card ──────────────────────────────────── */
function ToolCallCard({ call }: { call: ToolCallBlock }) {
  const [open, setOpen] = useState(false);
  const isRunning = call.status === "running";
  const isError = call.status === "error";

  // Extract a short arg summary for inline display
  const argSummary = (() => {
    if (!call.args) return "";
    const vals = Object.values(call.args).filter(v => typeof v === "string" || typeof v === "number");
    if (!vals.length) return "";
    const first = String(vals[0]);
    return first.length > 60 ? first.slice(0, 60) + "…" : first;
  })();

  return (
    <div className={`ag-tool-card${isError ? " ag-tool-card--error" : ""}`}>
      <button type="button" className="ag-tool-header" onClick={() => setOpen(v => !v)}>
        <span className="ag-tool-icon">
          {isRunning ? (
            <span className="ag-tool-spinner" />
          ) : isError ? (
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" width="12" height="12">
              <circle cx="8" cy="8" r="7"/><path d="M8 5v4M8 11v.5"/>
            </svg>
          ) : (
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" width="12" height="12">
              <polyline points="2,8 6,12 14,4"/>
            </svg>
          )}
        </span>
        <span className="ag-tool-name">{call.toolId}</span>
        {argSummary && <span className="ag-tool-arg">{argSummary}</span>}
        {(call.output || call.args) && (
          <span className="ag-tool-chevron">{open ? "▾" : "▸"}</span>
        )}
      </button>
      {open && (
        <div className="ag-tool-body">
          {call.args && Object.keys(call.args).length > 0 && (
            <pre className="ag-tool-args">{JSON.stringify(call.args, null, 2)}</pre>
          )}
          {call.output && (
            <pre className="ag-tool-output">{call.output}</pre>
          )}
        </div>
      )}
    </div>
  );
}

/* ─── User message ────────────────────────────────────── */
function UserMessage({ msg }: { msg: AgentMessage }) {
  return (
    <div className="ag-user-row">
      <div className="ag-user-bubble">{msg.content}</div>
    </div>
  );
}

/* ─── Assistant message ───────────────────────────────── */
function AssistantMessage({ msg, streaming }: {
  msg?: AgentMessage;
  streaming?: {
    thinkingText?: string;
    text: string;
    toolCalls?: ToolCallBlock[];
    streamError?: string;
  };
}) {
  const raw = msg?.content ?? streaming?.text ?? "";
  const parsed = parseStreamBlocks(raw);
  const clean = parsed.text;
  const toolCalls = streaming?.toolCalls ?? parsed.toolCalls;
  const streamError = streaming?.streamError;
  const thinkingText = streaming?.thinkingText?.trim() ?? "";

  return (
    <div className="ag-assistant-row">
      {thinkingText && (
        <div className="ag-assistant-thinking-copy">{thinkingText}</div>
      )}
      {toolCalls.map((c, i) => (
        streaming ? <ToolStatusRow key={i} call={c} /> : <ToolCallCard key={i} call={c} />
      ))}
      {streamError && <div className="ag-assistant-error">Error: {streamError}</div>}
      {clean && (
        <div className="ag-assistant-text">
          <ReactMarkdown>{clean}</ReactMarkdown>
        </div>
      )}
      {!clean && !thinkingText && toolCalls.length === 0 && (
        <div className="ag-assistant-text ag-thinking">
          <span className="ag-thinking-dot" />
          <span className="ag-thinking-dot" />
          <span className="ag-thinking-dot" />
        </div>
      )}
      {streaming && (
        <span className="ag-cursor-blink" />
      )}
    </div>
  );
}

/* ─── Patch card ──────────────────────────────────────── */
function PatchCard({ summary, onApply, onDismiss }: {
  summary: string; onApply: () => void; onDismiss: () => void;
}) {
  return (
    <div className="ag-patch-card">
      <div className="ag-patch-card-header">
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" width="13" height="13">
          <path d="M2 2h8l4 4v8H2z"/><path d="M10 2v4h4"/>
        </svg>
        <span className="ag-patch-filename">Patch</span>
        <div style={{ flex: 1 }} />
        <button className="ag-patch-open-btn" type="button" onClick={onDismiss}>Dismiss</button>
        <button className="ag-patch-apply-btn" type="button" onClick={onApply}>Apply</button>
      </div>
      <div className="ag-patch-summary">{summary}</div>
    </div>
  );
}

/* ─── Bottom toolbar ──────────────────────────────────── */
function BottomBar({
  onRunAgent,
  skills,
  onToggleSkill,
  usageRecords,
}: {
  onRunAgent: () => void;
  skills: SkillManifest[];
  onToggleSkill: (skill: SkillManifest) => Promise<void>;
  usageRecords: UsageRecord[];
}) {
  const [showSkills, setShowSkills] = useState(false);
  const lastRecord = usageRecords[usageRecords.length - 1];
  const ctxPct = lastRecord
    ? Math.min(100, Math.round((lastRecord.inputTokens / 200_000) * 100))
    : 0;

  return (
    <div className="ag-bottom-bar">
      {/* Skill flyout */}
      {showSkills && skills.length > 0 && (
        <div className="ag-skill-flyout">
          {skills.map(skill => {
            const active = skill.isEnabled ?? skill.enabled ?? false;
            return (
              <button
                key={skill.id}
                type="button"
                className={`ag-skill-item ${active ? "ag-skill-item--on" : ""}`}
                onClick={() => void onToggleSkill(skill)}
              >
                <span className={`ag-skill-dot ${active ? "ag-skill-dot--on" : ""}`} />
                {skill.name}
              </button>
            );
          })}
        </div>
      )}

      <div className="ag-toolbar">
        {/* Left side: + and skill toggle */}
        <div className="ag-toolbar-left">
          <button type="button" className="ag-toolbar-btn" title="执行 AI" aria-label="执行 AI" onClick={onRunAgent}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
              <path d="M12 5v14M5 12h14"/>
            </svg>
          </button>
          {skills.length > 0 && (
            <button
              type="button"
              className={`ag-toolbar-btn ag-planning-btn ${showSkills ? "ag-planning-btn--active" : ""}`}
              onClick={() => setShowSkills(v => !v)}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14">
                <path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/>
              </svg>
              Skills
            </button>
          )}
        </div>

        {/* Right side: ctx ring */}
        <div className="ag-toolbar-right">
          {ctxPct > 0 && (
            <div className="ag-ctx-ring" title={`上下文 ${ctxPct}%`}>
              <svg viewBox="0 0 20 20" width="16" height="16">
                <circle cx="10" cy="10" r="7" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="2.5"/>
                <circle
                  cx="10" cy="10" r="7"
                  fill="none"
                  stroke="rgba(255,255,255,0.6)"
                  strokeWidth="2.5"
                  strokeDasharray={`${(ctxPct / 100) * 44} 44`}
                  strokeLinecap="round"
                  transform="rotate(-90 10 10)"
                  style={{ transition: "stroke-dasharray 0.4s ease" }}
                />
              </svg>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── Main ChatPanel ──────────────────────────────────── */
export interface ChatPanelProps {
  messages: AgentMessage[];
  sessions: AgentSessionSummary[];
  activeSessionId: string;
  onSelectSession: (sessionId: string) => void;
  onNewSession: () => void;
  onRunAgent: () => void;
  onSendMessage: (text: string) => void;
  pendingPatchSummary?: string;
  onApplyPatch: () => void;
  onDismissPatch: () => void;
  streamThinkingText?: string;
  streamText?: string;
  streamToolCalls?: StreamToolCall[];
  streamError?: string;
  isStreaming?: boolean;
  skills: SkillManifest[];
  onToggleSkill: (skill: SkillManifest) => Promise<void>;
  usageRecords: UsageRecord[];
}

export function ChatPanel({
  messages, sessions, activeSessionId, onSelectSession, onNewSession,
  onRunAgent, onSendMessage,
  pendingPatchSummary, onApplyPatch, onDismissPatch,
  streamThinkingText,
  streamText, streamToolCalls, streamError, isStreaming,
  skills, onToggleSkill,
  usageRecords,
}: ChatPanelProps) {
  const [inputText, setInputText] = useState("");
  const endRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const normalizedStreamToolCalls = (streamToolCalls ?? []).map(toToolCallBlock);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: isStreaming ? "auto" : "smooth" });
  }, [isStreaming, messages, streamError, streamText, streamThinkingText, normalizedStreamToolCalls.length]);

  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = `${Math.min(ta.scrollHeight, 180)}px`;
  }, [inputText]);

  const handleSend = useCallback(() => {
    const text = inputText.trim();
    if (!text || isStreaming) return;
    setInputText("");
    onSendMessage(text);
  }, [inputText, isStreaming, onSendMessage]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
  }, [handleSend]);

  return (
    <div className="ag-panel">
      <div className="ag-session-header">
        <button
          type="button"
          className="ag-new-session-btn"
          onClick={onNewSession}
          disabled={isStreaming}
        >
          + 新对话
        </button>
        <select
          className="ag-session-select"
          value={activeSessionId}
          onChange={(event) => onSelectSession(event.target.value)}
          disabled={isStreaming || sessions.length === 0}
        >
          <option value="">{sessions.length === 0 ? "暂无历史会话" : "选择历史会话"}</option>
          {sessions.map((session) => (
            <option key={session.id} value={session.id}>
              {(session.title || session.lastMessagePreview || session.id).trim()}
            </option>
          ))}
        </select>
      </div>

      {/* Messages scroll area */}
      <div className="ag-messages">
        {messages.length === 0 && !isStreaming && (
          <div className="ag-empty">
            <div className="ag-empty-glyph">✦</div>
            <div className="ag-empty-title">AI 助手已就绪</div>
            <div className="ag-empty-sub">发送消息，或选中编辑器内容后点击 + 分析</div>
          </div>
        )}

        {messages.map(msg => {
          if (msg.role === "user") return <UserMessage key={msg.id} msg={msg} />;
          if (msg.role === "tool") return null; // folded into assistant card
          return <AssistantMessage key={msg.id} msg={msg} />;
        })}

        {isStreaming && streamText !== undefined && (
          <AssistantMessage
            streaming={{
              thinkingText: streamThinkingText,
              text: streamText,
              toolCalls: normalizedStreamToolCalls,
              streamError,
            }}
          />
        )}

        {pendingPatchSummary && (
          <PatchCard
            summary={pendingPatchSummary}
            onApply={onApplyPatch}
            onDismiss={onDismissPatch}
          />
        )}

        <div ref={endRef} />
      </div>

      {/* Input box */}
      <div className="ag-input-wrap">
        <textarea
          ref={textareaRef}
          className="ag-input"
          value={inputText}
          onChange={e => setInputText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={isStreaming ? "AI 正在回复…" : "Ask anything, @ to mention, / for workflow…"}
          disabled={isStreaming}
          rows={1}
        />
        <button
          className="ag-send-btn"
          type="button"
          onClick={handleSend}
          disabled={isStreaming || !inputText.trim()}
          aria-label="发送"
        >
          {isStreaming
            ? <span className="ag-send-spinner" />
            : (
              <svg viewBox="0 0 24 24" fill="currentColor" width="15" height="15">
                <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
              </svg>
            )}
        </button>
      </div>

      {/* Bottom toolbar */}
      <BottomBar
        onRunAgent={onRunAgent}
        skills={skills}
        onToggleSkill={onToggleSkill}
        usageRecords={usageRecords}
      />
    </div>
  );
}
