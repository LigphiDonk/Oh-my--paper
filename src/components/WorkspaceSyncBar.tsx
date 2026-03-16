import clsx from "clsx";

import type { CloudProjectRole, CollabStatus } from "../types";

interface WorkspaceSyncBarProps {
  projectId: string | null;
  role: CloudProjectRole | null;
  collabStatus: CollabStatus;
  pendingPushCount: number;
  pendingPullCount: number;
  conflictCount: number;
  onPush: () => void;
  onPull: () => void;
  onOpenShareModal: () => void;
  onCreateProject: () => void;
  onLinkProject: () => void;
}

function roleLabel(role: CloudProjectRole | null) {
  if (role === "owner") return "所有者";
  if (role === "editor") return "可编辑";
  if (role === "commenter") return "可批注";
  if (role === "viewer") return "只读";
  return "未连接";
}

export function WorkspaceSyncBar({
  projectId,
  role,
  collabStatus,
  pendingPushCount,
  pendingPullCount,
  conflictCount,
  onPush,
  onPull,
  onOpenShareModal,
  onCreateProject,
  onLinkProject,
}: WorkspaceSyncBarProps) {
  const hasCloudProject = Boolean(projectId);

  return (
    <div className="workspace-sync-bar">
      <div className="workspace-sync-main">
        <div className="workspace-sync-copy">
          <div className="workspace-sync-eyebrow">Source Control</div>
          <div className="workspace-sync-title">
            {hasCloudProject ? "云同步工作区" : "连接云协作"}
          </div>
          <div className="workspace-sync-subtitle">
            {hasCloudProject
              ? `当前权限：${roleLabel(role)} · ${projectId?.slice(0, 8)}…`
              : "把当前工作区关联到云端后，就可以手动推送和拉取。"}
          </div>
        </div>

        {hasCloudProject ? (
          <>
            <div className="workspace-sync-metrics">
              <span className="workspace-sync-pill is-push">待推送 {pendingPushCount}</span>
              <span className="workspace-sync-pill is-pull">待拉取 {pendingPullCount}</span>
              <span className={clsx("workspace-sync-pill", conflictCount > 0 && "is-conflict")}>
                冲突 {conflictCount}
              </span>
            </div>
            <div className="workspace-sync-actions">
              <button
                className="btn-primary"
                type="button"
                onClick={onPush}
                disabled={
                  collabStatus.syncInProgress ||
                  (!pendingPushCount && !conflictCount) ||
                  !collabStatus.canComment
                }
              >
                {collabStatus.syncInProgress ? "处理中..." : "推送"}
              </button>
              <button
                className="btn-secondary"
                type="button"
                onClick={onPull}
                disabled={collabStatus.syncInProgress || pendingPullCount === 0}
              >
                拉取
              </button>
              <button
                className="btn-secondary"
                type="button"
                onClick={onOpenShareModal}
                disabled={!collabStatus.canShare}
              >
                分享
              </button>
            </div>
          </>
        ) : (
          <div className="workspace-sync-actions">
            <button className="btn-primary" type="button" onClick={onCreateProject}>
              创建云项目
            </button>
            <button className="btn-secondary" type="button" onClick={onLinkProject}>
              关联已有项目
            </button>
          </div>
        )}
      </div>

      {collabStatus.connectionError && (
        <div className="workspace-sync-error">{collabStatus.connectionError}</div>
      )}
    </div>
  );
}
