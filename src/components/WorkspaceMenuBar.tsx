import clsx from "clsx";
import { useEffect, useRef, useState } from "react";

import type { WorkspaceEntry } from "../types";

interface WorkspaceMenuBarProps {
  showInAppFileMenu?: boolean;
  hasProject: boolean;
  hasDirtyChanges: boolean;
  activeWorkspaceRoot: string;
  workspaceTabs: WorkspaceEntry[];
  recentWorkspaces: WorkspaceEntry[];
  isAutoSaveEnabled: boolean;
  isCompileOnSaveEnabled: boolean;
  isBusy?: boolean;
  onOpenProject: () => void;
  onCreateProject: () => void;
  onSaveCurrent: () => void;
  onSaveAll: () => void;
  onToggleAutoSave: (enabled: boolean) => void;
  onToggleCompileOnSave: (enabled: boolean) => void;
  onSelectWorkspace: (rootPath: string) => void;
  onCloseWorkspaceTab: (rootPath: string) => void;
}

export function WorkspaceMenuBar({
  showInAppFileMenu = true,
  hasProject,
  hasDirtyChanges,
  activeWorkspaceRoot,
  workspaceTabs,
  recentWorkspaces,
  isAutoSaveEnabled,
  isCompileOnSaveEnabled,
  isBusy,
  onOpenProject,
  onCreateProject,
  onSaveCurrent,
  onSaveAll,
  onToggleAutoSave,
  onToggleCompileOnSave,
  onSelectWorkspace,
  onCloseWorkspaceTab,
}: WorkspaceMenuBarProps) {
  const [isFileMenuOpen, setIsFileMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isFileMenuOpen) {
      return;
    }

    function handlePointerDown(event: MouseEvent) {
      if (!menuRef.current?.contains(event.target as Node)) {
        setIsFileMenuOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsFileMenuOpen(false);
      }
    }

    window.addEventListener("mousedown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("mousedown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isFileMenuOpen]);

  const recentItems = recentWorkspaces.slice(0, 7);
  const canCloseTabs = workspaceTabs.length > 1;
  const showWorkspaceTabs = workspaceTabs.length > 1;

  function handleMenuAction(action: () => void) {
    setIsFileMenuOpen(false);
    action();
  }

  return (
    <div className="topbar-menubar">
      {showInAppFileMenu && (
        <div className="menu-shell" ref={menuRef}>
          <button
            type="button"
            className={clsx("menu-trigger", isFileMenuOpen && "is-open")}
            onClick={() => setIsFileMenuOpen((current) => !current)}
            aria-expanded={isFileMenuOpen}
            aria-haspopup="menu"
          >
            File
          </button>

          {isFileMenuOpen && (
            <div className="menu-panel" role="menu">
              <div className="menu-section">
                <div className="menu-section-label">项目</div>
                <button
                  type="button"
                  className="menu-item"
                  onClick={() => handleMenuAction(onOpenProject)}
                  disabled={isBusy}
                >
                  <span>打开项目...</span>
                </button>
                <button
                  type="button"
                  className="menu-item"
                  onClick={() => handleMenuAction(onCreateProject)}
                  disabled={isBusy}
                >
                  <span>新建项目...</span>
                </button>
              </div>

              <div className="menu-section">
                <div className="menu-section-label">保存</div>
                <button
                  type="button"
                  className="menu-item"
                  onClick={() => handleMenuAction(onSaveCurrent)}
                  disabled={!hasProject || isBusy}
                >
                  <span>保存当前文件</span>
                  <span className="menu-item-meta">Cmd+S</span>
                </button>
                <button
                  type="button"
                  className="menu-item"
                  onClick={() => handleMenuAction(onSaveAll)}
                  disabled={!hasProject || isBusy}
                >
                  <span>保存全部文件</span>
                </button>
                <label className="menu-item menu-item--toggle">
                  <span>自动保存</span>
                  <input
                    type="checkbox"
                    checked={isAutoSaveEnabled}
                    onChange={(event) => onToggleAutoSave(event.target.checked)}
                  />
                </label>
                <label className="menu-item menu-item--toggle">
                  <span>保存后自动编译</span>
                  <input
                    type="checkbox"
                    checked={isCompileOnSaveEnabled}
                    onChange={(event) => onToggleCompileOnSave(event.target.checked)}
                    disabled={!hasProject}
                  />
                </label>
              </div>

              {recentItems.length > 0 && (
                <div className="menu-section">
                  <div className="menu-section-label">最近项目</div>
                  {recentItems.map((workspace) => {
                    const isActive = workspace.rootPath === activeWorkspaceRoot;
                    return (
                      <button
                        key={workspace.rootPath}
                        type="button"
                        className={clsx("menu-item", "menu-item--stack", isActive && "is-active")}
                        onClick={() => handleMenuAction(() => onSelectWorkspace(workspace.rootPath))}
                        disabled={isBusy}
                        title={workspace.rootPath}
                      >
                        <span className="menu-item-main">
                          {workspace.label}
                          {isActive && <span className="menu-item-check">当前</span>}
                        </span>
                        <span className="menu-item-sub">{workspace.rootPath}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {showWorkspaceTabs && (
        <div className="workspace-tab-strip" aria-label="Open workspaces">
          {workspaceTabs.map((workspace) => {
            const isActive = workspace.rootPath === activeWorkspaceRoot;
            return (
              <div
                key={workspace.rootPath}
                className={clsx("workspace-top-tab", isActive && "is-active")}
                title={workspace.rootPath}
              >
                <button
                  type="button"
                  className="workspace-top-tab-button"
                  onClick={() => onSelectWorkspace(workspace.rootPath)}
                >
                  <span className="workspace-top-tab-label">{workspace.label}</span>
                  {isActive && hasDirtyChanges && <span className="workspace-top-tab-dot" aria-hidden="true" />}
                </button>
                {canCloseTabs && (
                  <button
                    type="button"
                    className="workspace-top-tab-close"
                    onClick={() => onCloseWorkspaceTab(workspace.rootPath)}
                    aria-label={`关闭 ${workspace.label}`}
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <line x1="18" y1="6" x2="6" y2="18" />
                      <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
