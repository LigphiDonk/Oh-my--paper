import { useCallback, useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";

import type { AgentMessage, AgentProfile, SkillManifest, UsageRecord } from "../types";

/* ─── stream block parser ─────────────────────────────── */
interface ToolCallBlock { toolId: string; output?: string }
interface StreamBlock { text: string; toolCalls: ToolCallBlock[] }

function parseStreamBlocks(raw: string): StreamBlock {
  const re = /\[Tool: ([^\]]+)\]\n(?:\[Result: ([\s\S]*?)\]\n)?/g;
  const toolCalls: ToolCallBlock[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(raw)) !== null) toolCalls.push({ toolId: m[1], output: m[2]?.trim() });
  const text = raw
    .replace(/\[Tool: [^\]]+\]\n(?:\[Result: [\s\S]*?\]\n)?/g, "")
    .replace(/\[Error: [\s\S]*?\]\n?/g, "")
    .trim();
  return { text, toolCalls };
}

/* ─── Tool call card ──────────────────────────────────── */
function ToolCallCard({ call }: { call: ToolCallBlock }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="tool-call-card">
      <button type="button" className="tool-call-header" onClick={() => setOpen(v => !v)}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="12" height="12"><circle cx="12" cy="12" r="3"/><path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83"/></svg>
        <span className="tool-call-name">{call.toolId}</span>
        {call.output && <span className="tool-call-toggle">{open ? "▾" : "▸"}</span>}
      </button>
      {open && call.output && <pre className="tool-call-output">{call.output}</pre>}
    </div>
  );
}

/* ─── Message bubble ──────────────────────────────────── */
function MessageBubble({ msg }: { msg: AgentMessage }) {
  const isUser = msg.role === "user";
  if (msg.role === "tool") {
    return (
      <div className="chat-tool-result">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="12" height="12"><circle cx="12" cy="12" r="3"/><path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83"/></svg>
        <span className="chat-tool-name">{msg.toolId ?? "tool"}</span>
        {msg.content && <pre className="tool-call-output" style={{ marginTop: 4 }}>{msg.content.slice(0, 400)}{msg.content.length > 400 ? "…" : ""}</pre>}
      </div>
    );
  }
  return (
    <div className={`chat-message ${isUser ? "chat-message-user" : "chat-message-assistant"}`}>
      <div className="chat-message-meta">
        {isUser ? "你" : "助手"}
        {!isUser && msg.profileId && <span className="chat-message-profile"> · {msg.profileId}</span>}
      </div>
      <div className="chat-bubble">
        {isUser
          ? <div className="chat-user-text">{msg.content}</div>
          : <div className="chat-markdown"><ReactMarkdown>{msg.content}</ReactMarkdown></div>}
      </div>
    </div>
  );
}

/* ─── Streaming bubble ────────────────────────────────── */
function StreamingBubble({ text, label }: { text: string; label: string }) {
  const { text: clean, toolCalls } = parseStreamBlocks(text);
  return (
    <div className="chat-message chat-message-assistant">
      <div className="chat-message-meta">
        助手 · {label}
        <span className="chat-streaming-dot" />
      </div>
      <div className="chat-bubble">
        {toolCalls.map((c, i) => <ToolCallCard key={i} call={c} />)}
        {clean && <div className="chat-markdown"><ReactMarkdown>{clean}</ReactMarkdown></div>}
        {!clean && toolCalls.length === 0 && <span className="chat-thinking">思考中…</span>}
      </div>
    </div>
  );
}

/* ─── Patch banner ────────────────────────────────────── */
function PatchBanner({ summary, onApply, onDismiss }: { summary: string; onApply: () => void; onDismiss: () => void }) {
  return (
    <div className="chat-patch-banner">
      <div className="chat-patch-label"><span>📝</span><span>{summary}</span></div>
      <div className="chat-patch-actions">
        <button className="btn-primary" type="button" onClick={onApply} style={{ fontSize: 12 }}>应用</button>
        <button className="btn-secondary" type="button" onClick={onDismiss} style={{ fontSize: 12 }}>忽略</button>
      </div>
    </div>
  );
}

/* ─── Skill pill ──────────────────────────────────────── */
function SkillPill({ skill, active, onToggle }: { skill: SkillManifest; active: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      className={`skill-pill ${active ? "skill-pill--active" : ""}`}
      onClick={onToggle}
      title={skill.stages.join(" · ")}
    >
      {active && <span className="skill-pill-dot" />}
      {skill.name}
    </button>
  );
}

/* ─── Token status bar ────────────────────────────────── */
function TokenBar({
  records,
  activeProfileLabel,
}: {
  records: UsageRecord[];
  activeProfileLabel: string;
}) {
  const lastRecord = records[records.length - 1];
  const totalIn = records.reduce((s, r) => s + r.inputTokens, 0);
  const totalOut = records.reduce((s, r) => s + r.outputTokens, 0);
  const total = totalIn + totalOut;

  // Estimate context % — we use last record's input vs a rough 200k limit
  const ctxLimit = 200_000;
  const ctxPct = lastRecord ? Math.min(100, Math.round((lastRecord.inputTokens / ctxLimit) * 100)) : 0;

  return (
    <div className="chat-token-bar">
      {/* Context ring */}
      <div className="ctx-ring-wrap" title={`上下文占用约 ${ctxPct}%`}>
        <svg viewBox="0 0 20 20" width="18" height="18">
          <circle cx="10" cy="10" r="7" fill="none" stroke="var(--border-light)" strokeWidth="2.5" />
          <circle
            cx="10" cy="10" r="7"
            fill="none"
            stroke="var(--accent-primary)"
            strokeWidth="2.5"
            strokeDasharray={`${(ctxPct / 100) * 44} 44`}
            strokeLinecap="round"
            transform="rotate(-90 10 10)"
            style={{ transition: "stroke-dasharray 0.4s ease" }}
          />
        </svg>
        <span className="ctx-ring-pct">{ctxPct}%</span>
      </div>

      <div className="token-bar-divider" />

      {/* Token counts */}
      <div className="token-stat" title="本次会话总 Token">
        <span className="token-stat-label">Total</span>
        <span className="token-stat-val">{total > 0 ? `${(total / 1000).toFixed(1)}k` : "—"}</span>
      </div>
      <div className="token-stat" title="输入 Token">
        <span className="token-stat-label">In</span>
        <span className="token-stat-val">{totalIn > 0 ? `${(totalIn / 1000).toFixed(1)}k` : "—"}</span>
      </div>
      <div className="token-stat" title="输出 Token">
        <span className="token-stat-label">Out</span>
        <span className="token-stat-val">{totalOut > 0 ? `${(totalOut / 1000).toFixed(1)}k` : "—"}</span>
      </div>

      {lastRecord && (
        <>
          <div className="token-bar-divider" />
          <div className="token-model-badge">{lastRecord.model}</div>
        </>
      )}

      <div style={{ flex: 1 }} />

      <div className="token-profile-badge">{activeProfileLabel}</div>
    </div>
  );
}

/* ─── Main ChatPanel ──────────────────────────────────── */
export interface ChatPanelProps {
  messages: AgentMessage[];
  profiles: AgentProfile[];
  activeProfileId: string;
  onSelectProfile: (id: string) => void;
  onRunAgent: () => void;
  onSendMessage: (text: string) => void;
  pendingPatchSummary?: string;
  onApplyPatch: () => void;
  onDismissPatch: () => void;
  streamText?: string;
  isStreaming?: boolean;
  skills: SkillManifest[];
  onToggleSkill: (skill: SkillManifest) => Promise<void>;
  usageRecords: UsageRecord[];
}

export function ChatPanel({
  messages, profiles, activeProfileId, onSelectProfile,
  onRunAgent, onSendMessage,
  pendingPatchSummary, onApplyPatch, onDismissPatch,
  streamText, isStreaming,
  skills, onToggleSkill,
  usageRecords,
}: ChatPanelProps) {
  const [inputText, setInputText] = useState("");
  const endRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamText]);

  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = `${Math.min(ta.scrollHeight, 160)}px`;
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

  const activeProfile = profiles.find(p => p.id === activeProfileId);

  return (
    <div className="chat-panel">
      {/* Profile bar */}
      <div className="chat-profile-bar">
        <select className="chat-profile-select" value={activeProfileId} onChange={e => onSelectProfile(e.target.value)}>
          {profiles.map(p => (
            <option key={p.id} value={p.id}>{p.label} · {p.model}</option>
          ))}
        </select>
        <button className="btn-secondary" type="button" onClick={onRunAgent} disabled={isStreaming}
          title="对编辑器当前选中内容执行" style={{ fontSize: 12, whiteSpace: "nowrap" }}>
          分析选中
        </button>
      </div>

      {/* Messages */}
      <div className="chat-messages">
        {messages.length === 0 && !streamText && !isStreaming && (
          <div className="chat-empty-state">
            <div className="chat-empty-icon">✦</div>
            <div className="chat-empty-title">AI 助手已就绪</div>
            <div className="chat-empty-desc">发送消息，或选中编辑器内容后点击「分析选中」</div>
          </div>
        )}
        {messages.map(msg => <MessageBubble key={msg.id} msg={msg} />)}
        {isStreaming && streamText !== undefined && (
          <StreamingBubble text={streamText} label={activeProfile?.label ?? activeProfileId} />
        )}
        <div ref={endRef} />
      </div>

      {/* Patch banner */}
      {pendingPatchSummary && (
        <PatchBanner summary={pendingPatchSummary} onApply={onApplyPatch} onDismiss={onDismissPatch} />
      )}

      {/* Input */}
      <div className="chat-input-area">
        <textarea
          ref={textareaRef}
          className="chat-input"
          value={inputText}
          onChange={e => setInputText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={isStreaming ? "AI 正在回复…" : "发消息，Shift+Enter 换行"}
          disabled={isStreaming}
          rows={1}
        />
        <button className="chat-send-btn" type="button" onClick={handleSend}
          disabled={isStreaming || !inputText.trim()} aria-label="发送">
          {isStreaming
            ? <span className="chat-send-spinner" />
            : <svg viewBox="0 0 24 24" fill="currentColor" width="17" height="17"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>}
        </button>
      </div>

      {/* Skill pills */}
      {skills.length > 0 && (
        <div className="chat-skill-strip">
          <span className="skill-strip-label">Skills</span>
          <div className="skill-pill-row">
            {skills.map(skill => (
              <SkillPill
                key={skill.id}
                skill={skill}
                active={skill.isEnabled ?? skill.enabled ?? false}
                onToggle={() => void onToggleSkill(skill)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Token status bar */}
      <TokenBar records={usageRecords} activeProfileLabel={activeProfile?.label ?? activeProfileId} />
    </div>
  );
}
