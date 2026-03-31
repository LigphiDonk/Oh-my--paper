import { useCallback, useEffect, useMemo, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import clsx from "clsx";
import type {
  AppLocale,
  SessionMeta,
  SessionMessage,
  SessionRoleTag,
} from "../types";

interface SessionBrowserProps {
  locale: AppLocale;
  onResumeInTerminal: (command: string) => void;
  onOpenTerminalDrawer?: () => void;
}

const ROLE_CONFIG: Record<SessionRoleTag, { icon: string; label: string; labelEn: string; color: string }> = {
  orchestrator: { icon: "🧠", label: "统筹", labelEn: "Plan", color: "#818cf8" },
  executor: { icon: "⚡", label: "执行", labelEn: "Exec", color: "#34d399" },
  research: { icon: "📚", label: "研究", labelEn: "Research", color: "#a78bfa" },
  general: { icon: "📝", label: "通用", labelEn: "General", color: "#94a3b8" },
};

const PROVIDER_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  claude: { label: "CLAUDE", color: "#f97316", bg: "rgba(249, 115, 22, 0.10)" },
  codex: { label: "CODEX", color: "#06b6d4", bg: "rgba(6, 182, 212, 0.10)" },
};

function formatRelativeTime(ms: number | null): string {
  if (!ms) return "";
  const seconds = Math.floor((Date.now() - ms) / 1000);
  if (seconds < 60) return "刚刚";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}分钟前`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}小时前`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}天前`;
  const months = Math.floor(days / 30);
  return `${months}月前`;
}

function extractProjectName(dir: string | null): string {
  if (!dir) return "";
  const parts = dir.replace(/\\/g, "/").replace(/\/$/, "").split("/");
  return parts[parts.length - 1] || "";
}

/** Reliable clipboard copy that works in Tauri webview */
async function copyToClipboard(text: string): Promise<boolean> {
  // Try modern API first
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // fallback below
    }
  }
  // Fallback: hidden textarea
  try {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.style.position = "fixed";
    textarea.style.left = "-9999px";
    textarea.style.top = "-9999px";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(textarea);
    return ok;
  } catch {
    return false;
  }
}

export function SessionBrowser({ locale, onResumeInTerminal, onOpenTerminalDrawer }: SessionBrowserProps) {
  const isZh = locale === "zh-CN";
  const [sessions, setSessions] = useState<SessionMeta[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeRoleFilters, setActiveRoleFilters] = useState<Set<SessionRoleTag>>(new Set());
  const [activeProviderFilter, setActiveProviderFilter] = useState<string>("all");
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [detailMessages, setDetailMessages] = useState<SessionMessage[]>([]);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [toastText, setToastText] = useState<string | null>(null);

  const loadSessions = useCallback(async () => {
    setIsLoading(true);
    try {
      const result = await invoke<SessionMeta[]>("scan_sessions");
      setSessions(result);
    } catch (err) {
      console.error("failed to scan sessions", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadSessions();
  }, [loadSessions]);

  // Toast auto-dismiss
  useEffect(() => {
    if (toastText) {
      const timer = setTimeout(() => setToastText(null), 2200);
      return () => clearTimeout(timer);
    }
  }, [toastText]);

  const filteredSessions = useMemo(() => {
    let result = sessions;

    // Provider filter
    if (activeProviderFilter !== "all") {
      result = result.filter((s) => s.provider === activeProviderFilter);
    }

    // Role filter
    if (activeRoleFilters.size > 0) {
      result = result.filter((s) => activeRoleFilters.has(s.roleTag));
    }

    // Search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (s) =>
          s.title.toLowerCase().includes(q) ||
          s.summary.toLowerCase().includes(q) ||
          (s.projectDir?.toLowerCase().includes(q) ?? false),
      );
    }

    return result;
  }, [sessions, activeProviderFilter, activeRoleFilters, searchQuery]);

  const selectedSession = useMemo(
    () => sessions.find((s) => s.sessionId === selectedSessionId) ?? null,
    [sessions, selectedSessionId],
  );

  const handleSelectSession = useCallback(
    async (session: SessionMeta) => {
      if (selectedSessionId === session.sessionId) {
        setSelectedSessionId(null);
        setDetailMessages([]);
        return;
      }

      setSelectedSessionId(session.sessionId);
      setIsLoadingDetail(true);
      try {
        const messages = await invoke<SessionMessage[]>("load_session_detail", {
          provider: session.provider,
          sessionId: session.sessionId,
        });
        setDetailMessages(messages);
      } catch (err) {
        console.error("failed to load session detail", err);
        setDetailMessages([]);
      } finally {
        setIsLoadingDetail(false);
      }
    },
    [selectedSessionId],
  );

  const handleCopyResumeCommand = useCallback(
    async (session: SessionMeta) => {
      try {
        const command = await invoke<string>("get_session_resume_command", {
          provider: session.provider,
          sessionId: session.sessionId,
          projectDir: session.projectDir,
        });
        const ok = await copyToClipboard(command);
        if (ok) {
          setToastText(isZh ? "✓ 已复制恢复命令" : "✓ Resume command copied");
        } else {
          setToastText(isZh ? "✗ 复制失败" : "✗ Copy failed");
        }
      } catch (err) {
        console.error("failed to copy resume command", err);
        setToastText(isZh ? "✗ 获取命令失败" : "✗ Failed to get command");
      }
    },
    [isZh],
  );

  const handleResumeInTerminal = useCallback(
    async (session: SessionMeta) => {
      try {
        const command = await invoke<string>("get_session_resume_command", {
          provider: session.provider,
          sessionId: session.sessionId,
          projectDir: session.projectDir,
        });
        onResumeInTerminal(command);
        // Switch to the AI drawer tab (sidebar terminal)
        onOpenTerminalDrawer?.();
        setToastText(isZh ? "✓ 已发送到终端" : "✓ Sent to terminal");
      } catch (err) {
        console.error("failed to resume in terminal", err);
        setToastText(isZh ? "✗ 恢复失败" : "✗ Resume failed");
      }
    },
    [onResumeInTerminal, onOpenTerminalDrawer, isZh],
  );

  const toggleRoleFilter = useCallback((role: SessionRoleTag) => {
    setActiveRoleFilters((prev) => {
      const next = new Set(prev);
      if (next.has(role)) {
        next.delete(role);
      } else {
        next.add(role);
      }
      return next;
    });
  }, []);

  // Count sessions by role for badges
  const roleCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const s of sessions) {
      counts[s.roleTag] = (counts[s.roleTag] || 0) + 1;
    }
    return counts;
  }, [sessions]);

  return (
    <div className="session-browser">
      {/* Header */}
      <div className="sidebar-header session-browser__header">
        <span className="session-browser__header-title">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="15" height="15">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
          {isZh ? "会话浏览器" : "Sessions"}
        </span>
        <button
          className="session-browser__refresh-btn"
          type="button"
          onClick={loadSessions}
          disabled={isLoading}
          title={isZh ? "刷新" : "Refresh"}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="13" height="13" className={isLoading ? "session-browser__spin" : ""}>
            <path d="M21.5 2v6h-6" /><path d="M2.5 22v-6h6" />
            <path d="M2.5 11.5A10 10 0 0 1 18.36 4.64L21.5 8" />
            <path d="M21.5 12.5A10 10 0 0 1 5.64 19.36L2.5 16" />
          </svg>
        </button>
      </div>

      <div className="sidebar-content session-browser__body">
        {/* Search */}
        <div className="session-browser__search-wrap">
          <svg className="session-browser__search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="14" height="14">
            <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
          </svg>
          <input
            className="session-browser__search"
            type="text"
            placeholder={isZh ? "搜索会话..." : "Search sessions..."}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        {/* Provider filter tabs */}
        <div className="session-browser__provider-tabs">
          {["all", "claude", "codex"].map((provider) => (
            <button
              key={provider}
              type="button"
              className={clsx(
                "session-browser__provider-tab",
                activeProviderFilter === provider && "is-active",
              )}
              onClick={() => setActiveProviderFilter(provider)}
            >
              {provider === "all"
                ? isZh ? "全部" : "All"
                : PROVIDER_CONFIG[provider]?.label ?? provider}
            </button>
          ))}
        </div>

        {/* Role filters */}
        <div className="session-browser__filter-row">
          {(Object.keys(ROLE_CONFIG) as SessionRoleTag[]).map((role) => {
            const config = ROLE_CONFIG[role];
            const isActive = activeRoleFilters.has(role);
            return (
              <button
                key={role}
                type="button"
                className={clsx("session-browser__filter-pill", isActive && "is-active")}
                style={isActive ? { borderColor: config.color, color: config.color, background: `${config.color}12` } : undefined}
                onClick={() => toggleRoleFilter(role)}
              >
                <span className="session-browser__filter-pill-icon">{config.icon}</span>
                <span>{isZh ? config.label : config.labelEn}</span>
                {(roleCounts[role] ?? 0) > 0 && (
                  <span className="session-browser__filter-count">{roleCounts[role]}</span>
                )}
              </button>
            );
          })}
        </div>

        {/* Session count */}
        <div className="session-browser__count">
          {isLoading ? (
            <span className="session-browser__count-loading">
              <span className="session-browser__dot-pulse" />
              {isZh ? "扫描中..." : "Scanning..."}
            </span>
          ) : (
            <span>{filteredSessions.length} / {sessions.length} {isZh ? "条会话" : "sessions"}</span>
          )}
        </div>

        {/* Session list */}
        <div className="session-browser__list">
          {filteredSessions.map((session) => {
            const roleConfig = ROLE_CONFIG[session.roleTag] ?? ROLE_CONFIG.general;
            const providerConfig = PROVIDER_CONFIG[session.provider];
            const projectName = extractProjectName(session.projectDir);
            const isSelected = selectedSessionId === session.sessionId;

            return (
              <div key={`${session.provider}:${session.sessionId}`} className="session-browser__card-group">
                <button
                  type="button"
                  className={clsx("session-browser__item", isSelected && "is-selected")}
                  onClick={() => void handleSelectSession(session)}
                >
                  <div className="session-browser__item-top">
                    <span className="session-browser__role-icon" title={roleConfig.label}>
                      {roleConfig.icon}
                    </span>
                    {providerConfig && (
                      <span
                        className="session-browser__provider-badge"
                        style={{ color: providerConfig.color, background: providerConfig.bg }}
                      >
                        {providerConfig.label}
                      </span>
                    )}
                    <span className="session-browser__item-title">{session.title}</span>
                  </div>
                  <div className="session-browser__item-meta">
                    {projectName && (
                      <span className="session-browser__project-name" title={session.projectDir ?? ""}>
                        {projectName}
                      </span>
                    )}
                    <span className="session-browser__time">
                      {formatRelativeTime(session.lastActiveAt)}
                    </span>
                    {session.messageCount > 0 && (
                      <span className="session-browser__msg-count">
                        {session.messageCount} msgs
                      </span>
                    )}
                  </div>
                  {session.summary && (
                    <div className="session-browser__item-summary">{session.summary}</div>
                  )}
                </button>

                {/* Inline detail panel */}
                {isSelected && selectedSession && (
                  <div className="session-browser__detail">
                    {/* Meta */}
                    <div className="session-browser__detail-meta">
                      <div className="session-browser__detail-meta-row">
                        <span className="session-browser__detail-id">
                          {selectedSession.provider.toUpperCase()} · {selectedSession.sessionId.slice(0, 12)}…
                        </span>
                      </div>
                      {selectedSession.projectDir && (
                        <div className="session-browser__detail-meta-row">
                          <span className="session-browser__detail-path" title={selectedSession.projectDir}>
                            📂 {selectedSession.projectDir}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Action buttons */}
                    <div className="session-browser__detail-actions">
                      <button
                        className="session-browser__action-btn session-browser__action-btn--copy"
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          void handleCopyResumeCommand(selectedSession);
                        }}
                      >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="12" height="12">
                          <rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                        </svg>
                        {isZh ? "复制命令" : "Copy"}
                      </button>
                      <button
                        className="session-browser__action-btn session-browser__action-btn--resume"
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          void handleResumeInTerminal(selectedSession);
                        }}
                      >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="12" height="12">
                          <polyline points="4 17 10 11 4 5" /><line x1="12" y1="19" x2="20" y2="19" />
                        </svg>
                        {isZh ? "终端恢复" : "Resume"}
                      </button>
                    </div>

                    {/* Messages timeline */}
                    <div className="session-browser__messages">
                      {isLoadingDetail ? (
                        <div className="session-browser__loading">
                          <span className="session-browser__dot-pulse" />
                          {isZh ? "加载中..." : "Loading..."}
                        </div>
                      ) : detailMessages.length === 0 ? (
                        <div className="session-browser__loading">
                          {isZh ? "无消息记录" : "No messages"}
                        </div>
                      ) : (
                        detailMessages.slice(0, 50).map((msg, i) => (
                          <div
                            key={i}
                            className={clsx(
                              "session-browser__message",
                              `session-browser__message--${msg.role}`,
                            )}
                          >
                            <div className="session-browser__message-role">
                              {msg.role === "user"
                                ? "👤"
                                : msg.role === "assistant"
                                  ? "🤖"
                                  : msg.role === "tool"
                                    ? "🔧"
                                    : "📋"}
                              <span>{msg.role}</span>
                            </div>
                            <div className="session-browser__message-content">
                              {msg.content.length > 500
                                ? `${msg.content.slice(0, 500)}…`
                                : msg.content}
                            </div>
                          </div>
                        ))
                      )}
                      {detailMessages.length > 50 && (
                        <div className="session-browser__loading">
                          {isZh
                            ? `还有 ${detailMessages.length - 50} 条消息未显示`
                            : `${detailMessages.length - 50} more messages`}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {!isLoading && filteredSessions.length === 0 && (
            <div className="session-browser__empty">
              <div className="session-browser__empty-icon">
                {sessions.length === 0 ? "💬" : "🔍"}
              </div>
              <div className="session-browser__empty-text">
                {sessions.length === 0
                  ? isZh
                    ? "未发现本地 AI 会话记录\n请确认 Claude Code 或 Codex 已使用过"
                    : "No local AI sessions found"
                  : isZh
                    ? "没有匹配的会话"
                    : "No matching sessions"}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Toast */}
      {toastText && (
        <div className="session-browser__toast">{toastText}</div>
      )}
    </div>
  );
}
