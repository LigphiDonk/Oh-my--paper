import clsx from "clsx";

import type { CloudProjectRole, CollabFileSyncState, CollabStatus } from "../types";

type SyncChangeEntry = {
  path: string;
  state: CollabFileSyncState;
};

interface SyncSidebarProps {
  projectId: string | null;
  role: CloudProjectRole | null;
  collabStatus: CollabStatus;
  busyAction: "save-config" | "create-project" | "link-project" | "unlink-project" | "sync-project" | "pull-project" | null;
  changes: SyncChangeEntry[];
  onPush: () => void;
  onPull: () => void;
  onOpenShareModal: () => void;
  onCreateProject: () => void;
  onLinkProject: () => void;
  onOpenCollabSettings: () => void;
}

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
  return "冲突";
}

export function SyncSidebar({
  projectId,
  role,
  collabStatus,
  busyAction,
  changes,
  onPush,
  onPull,
  onOpenShareModal,
  onCreateProject,
  onLinkProject,
  onOpenCollabSettings,
}: SyncSidebarProps) {
  const pendingPush = changes.filter((entry) => entry.state === "pending-push");
  const pendingPull = changes.filter((entry) => entry.state === "pending-pull");
  const conflicts = changes.filter((entry) => entry.state === "conflict");
  const hasCloudProject = Boolean(projectId);

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

            <div className="sync-section">
              <div className="sync-section-header">
                <span>变更</span>
                <span className="text-subtle text-xs">{changes.length} 个文件</span>
              </div>

              {changes.length === 0 ? (
                <div className="sync-section-empty">当前没有待同步文件。</div>
              ) : (
                <div className="sync-change-list">
                  {changes.map((entry) => (
                    <div key={`${entry.state}:${entry.path}`} className="sync-change-item">
                      <span className={`tree-collab-dot is-${entry.state}`} aria-hidden="true"></span>
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
                    </div>
                  ))}
                </div>
              )}
            </div>

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
