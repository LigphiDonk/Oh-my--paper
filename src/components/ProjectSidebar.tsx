import type { ReactNode } from "react";

import { ProjectTree } from "./ProjectTree";
import type { CollabFileSyncState, ProjectNode, WorkspacePaneMode } from "../types";

interface ProjectSidebarProps {
  projectName: string;
  mode: WorkspacePaneMode;
  nodes: ProjectNode[];
  activeFile: string;
  dirtyPaths: Set<string>;
  collabSyncStates: Record<string, CollabFileSyncState>;
  outlineContent: ReactNode;
  onModeChange: (mode: WorkspacePaneMode) => void;
  onOpenNode: (node: ProjectNode) => void;
  onCreateFile: (parentDir: string, fileName: string) => void | Promise<void>;
  onCreateFolder: (parentDir: string, folderName: string) => void | Promise<void>;
  onDeleteFile: (path: string) => void | Promise<void>;
  onRenameFile: (oldPath: string, newPath: string) => void | Promise<void>;
  onRequestCreateFile: () => void;
  onRequestCreateFolder: () => void;
}

export function ProjectSidebar({
  projectName,
  mode,
  nodes,
  activeFile,
  dirtyPaths,
  collabSyncStates,
  outlineContent,
  onModeChange,
  onOpenNode,
  onCreateFile,
  onCreateFolder,
  onDeleteFile,
  onRenameFile,
  onRequestCreateFile,
  onRequestCreateFolder,
}: ProjectSidebarProps) {
  return (
    <aside className="primary-sidebar project-sidebar">
      <div className="project-sidebar-header">
        <div className="project-sidebar-meta">
          <div className="sidebar-header">Project</div>
          <div className="project-sidebar-title">{projectName}</div>
        </div>
        <div className="project-sidebar-actions">
          <button className="icon-btn" title="新建文件" type="button" onClick={onRequestCreateFile}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 5v14"></path>
              <path d="M5 12h14"></path>
            </svg>
          </button>
          <button className="icon-btn" title="新建文件夹" type="button" onClick={onRequestCreateFolder}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 7h5l2 2h11v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z"></path>
              <path d="M12 12v6"></path>
              <path d="M9 15h6"></path>
            </svg>
          </button>
        </div>
      </div>

      <div className="project-sidebar-segmented">
        <button
          type="button"
          className={`sidebar-segment ${mode === "files" ? "is-active" : ""}`}
          onClick={() => onModeChange("files")}
        >
          Files
        </button>
        <button
          type="button"
          className={`sidebar-segment ${mode === "outline" ? "is-active" : ""}`}
          onClick={() => onModeChange("outline")}
        >
          Outline
        </button>
      </div>

      <div className="project-sidebar-body">
        {mode === "files" ? (
          <ProjectTree
            nodes={nodes}
            activeFile={activeFile}
            dirtyPaths={dirtyPaths}
            collabSyncStates={collabSyncStates}
            onOpenNode={onOpenNode}
            onCreateFile={onCreateFile}
            onCreateFolder={onCreateFolder}
            onDeleteFile={onDeleteFile}
            onRenameFile={onRenameFile}
          />
        ) : (
          outlineContent
        )}
      </div>
    </aside>
  );
}
