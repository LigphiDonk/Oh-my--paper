import clsx from "clsx";
import { useState } from "react";

import type { CloudProjectRole, CollabFileSyncState, CollabStatus } from "../types";

type SyncChangeEntry = {
  path: string;
  state: CollabFileSyncState;
};

interface SyncSidebarProps {
  projectId: string | null;
  workspaceLabel: string;
  linkedAt: string;
  notice: { tone: "success" | "error"; text: string } | null;
  lastSyncAt: string;
  role: CloudProjectRole | null;
  collabStatus: CollabStatus;
  busyAction: "save-config" | "create-project" | "link-project" | "unlink-project" | "sync-project" | "pull-project" | null;
  changes: SyncChangeEntry[];
  ignoredPaths: Set<string>;
  onIgnorePath: (path: string) => void;
  onUnignorePath: (path: string) => void;
  onPush: () => void;
  onPull: () => void;
  onOpenShareModal: () => void;
  onCreateProject: () => void;
  onLinkProject: () => void;
  onOpenCollabSettings: () => void;
}

type SyncGraphEntry = {
  id: string;
  title: string;
  subtitle: string;
  badge?: string;
  tone: "neutral" | "push" | "pull" | "conflict" | "success" | "error";
};

function roleLabel(role: CloudProjectRole | null) {
  if (role === "owner") return "所有者";
  if (role === "editor") return "可编辑";
  if (role === "commenter") return "可批注";
  if (role === "viewer") return "只读";
  return "未连接";
}

function stateLabel(state: CollabFileSyncState) {
  if (state === "synced") return "已同步";
  if (state === "pending-push") return "待推送";
  if (state === "pending-pull") return "待拉取";
  if (state === "ignored") return "已忽略";
  return "冲突";
}

function formatTimestamp(value: string) {
  if (!value) {
    return "";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function summarizeEntries(entries: SyncChangeEntry[]) {
  if (entries.length === 0) {
    return "当前没有文件。";
  }
  const preview = entries.slice(0, 2).map((entry) => entry.path);
  if (entries.length <= 2) {
    return preview.join(" · ");
  }
  return `${preview.join(" · ")} +${entries.length - 2}`;
}

export function SyncSidebar({
  projectId,
  workspaceLabel,
  linkedAt,
  notice,
  lastSyncAt,
  role,
  collabStatus,
  busyAction,
  changes,
  onIgnorePath,
  onUnignorePath,
  onPush,
  onPull,
  onOpenShareModal,
  onCreateProject,
  onLinkProject,
  onOpenCollabSettings,
}: SyncSidebarProps) {
  const [ignoredExpanded, setIgnoredExpanded] = useState(false);
  const pendingPush = changes.filter((entry) => entry.state === "pending-push");
  const pendingPull = changes.filter((entry) => entry.state === "pending-pull");
  const conflicts = changes.filter((entry) => entry.state === "conflict");
  const ignored = changes.filter((entry) => entry.state === "ignored");
  const activeChanges = changes.filter((entry) => entry.state !== "ignored");
  const hasCloudProject = Boolean(projectId);
  const graphEntries: SyncGraphEntry[] = hasCloudProject
    ? [
      {
        id: "head",
        title: workspaceLabel || "当前工作区",
        subtitle: `当前权限：${roleLabel(role)} · ${projectId?.slice(0, 8)}…`,
        badge: "HEAD",
        tone: "neutral",
      },
      ...(notice
        ? [{
          id: "notice",
          title: notice.tone === "error" ? "最近一次操作失败" : "最近一次操作",
          subtitle: notice.text,
          badge: notice.tone === "error" ? "ERR" : "OK",
          tone: notice.tone === "error" ? "error" : "success",
        } satisfies SyncGraphEntry]
        : []),
      ...(pendingPush.length > 0
        ? [{
          id: "push",
          title: `待推送 ${pendingPush.length} 个文件`,
          subtitle: summarizeEntries(pendingPush),
          badge: "PUSH",
          tone: "push",
        } satisfies SyncGraphEntry]
        : []),
      ...(pendingPull.length > 0
        ? [{
          id: "pull",
          title: `待拉取 ${pendingPull.length} 个文件`,
          subtitle: summarizeEntries(pendingPull),
          badge: "PULL",
          tone: "pull",
        } satisfies SyncGraphEntry]
        : []),
      ...(conflicts.length > 0
        ? [{
          id: "conflict",
          title: `冲突 ${conflicts.length} 个文件`,
          subtitle: summarizeEntries(conflicts),
          badge: "CONFLICT",
          tone: "conflict",
        } satisfies SyncGraphEntry]
        : pendingPush.length === 0 && pendingPull.length === 0
          ? [{
            id: "synced",
            title: "当前工作区与云端一致",
            subtitle: lastSyncAt ? `最近同步：${formatTimestamp(lastSyncAt)}` : "还没有新的待同步文件。",
            badge: "SYNC",
            tone: "success",
          } satisfies SyncGraphEntry]
          : []),
      ...(lastSyncAt
        ? [{
          id: "last-sync",
          title: "最近一次手动同步",
          subtitle: formatTimestamp(lastSyncAt),
          badge: "SYNC",
          tone: "success",
        } satisfies SyncGraphEntry]
        : []),
      ...(linkedAt
        ? [{
          id: "linked",
          title: "已关联云项目",
          subtitle: formatTimestamp(linkedAt),
          badge: "LINK",
          tone: "neutral",
        } satisfies SyncGraphEntry]
        : []),
    ]
    : [];

  return (
    <aside className="primary-sidebar sync-sidebar">
      <div className="sync-sidebar-header">
        <div>
          <div className="sidebar-header">源码管理</div>
          <div className="sync-sidebar-title">手动云同步</div>
        </div>
        <button className="link-btn" type="button" onClick={onOpenCollabSettings}>
          设置
        </button>
      </div>

      <div className="sync-sidebar-body">
        {!hasCloudProject ? (
          <div className="sync-empty-card">
            <div className="sync-empty-title">当前工作区还没连接云协作</div>
            <div className="sync-empty-text">
              先创建云项目或关联已有项目，之后这里会像源码管理面板一样显示待推送、待拉取和冲突文件。
            </div>
            <div className="sync-empty-actions">
              <button className="btn-primary" type="button" onClick={onCreateProject}>
                创建云项目
              </button>
              <button className="btn-secondary" type="button" onClick={onLinkProject}>
                关联已有项目
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="sync-summary-card">
              <div className="sync-summary-top">
                <span className="sync-role-pill">{roleLabel(role)}</span>
                <span className="text-subtle text-xs">{projectId?.slice(0, 8)}…</span>
              </div>
              <div className="sync-summary-grid">
                <div className="sync-metric is-push">
                  <strong>{pendingPush.length}</strong>
                  <span>待推送</span>
                </div>
                <div className="sync-metric is-pull">
                  <strong>{pendingPull.length}</strong>
                  <span>待拉取</span>
                </div>
                <div className="sync-metric is-conflict">
                  <strong>{conflicts.length}</strong>
                  <span>冲突</span>
                </div>
                <div className="sync-metric is-ignored">
                  <strong>{ignored.length}</strong>
                  <span>已忽略</span>
                </div>
              </div>
              <div className="sync-primary-actions">
                <button
                  className="btn-primary"
                  type="button"
                  onClick={onPush}
                  disabled={
                    busyAction === "sync-project" ||
                    busyAction === "pull-project" ||
                    (pendingPush.length === 0 && conflicts.length === 0) ||
                    !collabStatus.canComment
                  }
                >
                  {busyAction === "sync-project" ? "推送中..." : "推送"}
                </button>
                <button
                  className="btn-secondary"
                  type="button"
                  onClick={onPull}
                  disabled={busyAction === "sync-project" || busyAction === "pull-project" || pendingPull.length === 0}
                >
                  {busyAction === "pull-project" ? "拉取中..." : "拉取"}
                </button>
              </div>
              <button
                className="sync-share-button"
                type="button"
                onClick={onOpenShareModal}
                disabled={!collabStatus.canShare}
              >
                创建分享链接
              </button>
            </div>

            <div className="sync-section sync-graph-section">
              <div className="sync-section-header">
                <span>同步图</span>
                <span className="text-subtle text-xs">{graphEntries.length} 个节点</span>
              </div>
              <div className="sync-graph-list">
                {graphEntries.map((entry, index) => (
                  <div key={entry.id} className="sync-graph-item">
                    <div className="sync-graph-rail" aria-hidden="true">
                      <span className={clsx("sync-graph-node", `is-${entry.tone}`)} />
                      {index < graphEntries.length - 1 && <span className="sync-graph-line" />}
                    </div>
                    <div className="sync-graph-card">
                      <div className="sync-graph-top">
                        <div className="sync-graph-title">{entry.title}</div>
                        {entry.badge && (
                          <span className={clsx("sync-graph-badge", `is-${entry.tone}`)}>{entry.badge}</span>
                        )}
                      </div>
                      <div className="sync-graph-subtitle">{entry.subtitle}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="sync-section">
              <div className="sync-section-header">
                <span>变更</span>
                <span className="text-subtle text-xs">{activeChanges.length} 个文件</span>
              </div>

              {activeChanges.length === 0 ? (
                <div className="sync-section-empty">当前没有待同步文件。</div>
              ) : (
                <div className="sync-change-list">
                  {activeChanges.map((entry, index) => (
                    <div key={`${entry.state}:${entry.path}`} className="sync-change-item">
                      <div className="sync-change-rail" aria-hidden="true">
                        <span className={`sync-change-node is-${entry.state}`}></span>
                        {index < activeChanges.length - 1 && <span className="sync-change-line" />}
                      </div>
                      <span className="sync-change-path">{entry.path}</span>
                      <span
                        className={clsx(
                          "sync-change-state",
                          entry.state === "pending-push" && "is-push",
                          entry.state === "pending-pull" && "is-pull",
                          entry.state === "conflict" && "is-conflict",
                        )}
                      >
                        {stateLabel(entry.state)}
                      </span>
                      {entry.state === "pending-push" && (
                        <button
                          className="sync-ignore-btn"
                          type="button"
                          title="忽略此文件（不推送）"
                          onClick={() => onIgnorePath(entry.path)}
                        >
                          <svg viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="1.8">
                            <line x1="3" y1="3" x2="13" y2="13"/>
                            <line x1="13" y1="3" x2="3" y2="13"/>
                          </svg>
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {ignored.length > 0 && (
              <div className="sync-section">
                <button
                  className="sync-section-header sync-section-header--toggle"
                  type="button"
                  onClick={() => setIgnoredExpanded((v) => !v)}
                >
                  <span>已忽略</span>
                  <span className="text-subtle text-xs">
                    {ignored.length} 个文件
                    <span className="sync-ignored-chevron">{ignoredExpanded ? " ▲" : " ▼"}</span>
                  </span>
                </button>
                {ignoredExpanded && (
                  <div className="sync-change-list">
                    {ignored.map((entry) => (
                      <div key={`ignored:${entry.path}`} className="sync-change-item is-ignored">
                        <div className="sync-change-rail" aria-hidden="true">
                          <span className="sync-change-node is-ignored"></span>
                        </div>
                        <span className="sync-change-path">{entry.path}</span>
                        <button
                          className="sync-unignore-btn"
                          type="button"
                          title="取消忽略"
                          onClick={() => onUnignorePath(entry.path)}
                        >
                          恢复
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {conflicts.length > 0 && (
              <div className="sync-warning-card">
                红色冲突文件不会被自动推送或拉取，避免把正文直接覆盖掉。
              </div>
            )}
          </>
        )}
      </div>
    </aside>
  );
}
