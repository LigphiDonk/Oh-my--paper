import {
  startTransition,
  useDeferredValue,
  useEffect,
  useEffectEvent,
  useMemo,
  useState,
} from "react";

import { BottomDock } from "./components/BottomDock";
import { EditorPane } from "./components/EditorPane";
import { PdfPane } from "./components/PdfPane";
import { ProjectTree } from "./components/ProjectTree";
import { desktop } from "./lib/desktop";
import type {
  AgentMessage,
  AgentProfileId,
  DrawerTab,
  FigureBriefDraft,
  GeneratedAsset,
  ProjectFile,
  WorkspaceSnapshot,
} from "./types";

function App() {
  const [snapshot, setSnapshot] = useState<WorkspaceSnapshot | null>(null);
  const [bootstrapError, setBootstrapError] = useState("");
  const [openTabs, setOpenTabs] = useState<string[]>([]);
  const [activeFilePath, setActiveFilePath] = useState("");
  const [highlightedPage, setHighlightedPage] = useState(1);
  const [drawerTab, setDrawerTab] = useState<DrawerTab>("ai");
  const [cursorLine, setCursorLine] = useState(1);
  const [selectedText, setSelectedText] = useState("");
  const [messages, setMessages] = useState<AgentMessage[]>([]);
  const [activeProfileId, setActiveProfileId] = useState<AgentProfileId>("outline");
  const [pendingPatch, setPendingPatch] = useState<{ filePath: string; content: string; summary: string } | null>(null);
  const [selectedBrief, setSelectedBrief] = useState<FigureBriefDraft | null>(null);
  const [selectedAsset, setSelectedAsset] = useState<GeneratedAsset | null>(null);

  const activeFile = useMemo<ProjectFile | null>(() => {
    if (!snapshot) {
      return null;
    }
    return snapshot.files.find((file) => file.path === activeFilePath) ?? snapshot.files[0] ?? null;
  }, [activeFilePath, snapshot]);

  const activeProfile = useMemo(
    () => snapshot?.profiles.find((profile) => profile.id === activeProfileId) ?? null,
    [activeProfileId, snapshot?.profiles],
  );

  const deferredActiveFile = useDeferredValue(activeFile);

  useEffect(() => {
    void (async () => {
      try {
        const nextSnapshot = await desktop.openProject();
        const nextMessages = await desktop.getAgentMessages();
        setSnapshot(nextSnapshot);
        setOpenTabs([nextSnapshot.activeFile, nextSnapshot.projectConfig.mainTex]);
        setActiveFilePath(nextSnapshot.activeFile);
        setMessages(nextMessages);

        if (nextSnapshot.projectConfig.autoCompile && nextSnapshot.compileResult.status === "idle") {
          const compileResult = await desktop.compileProject(nextSnapshot.activeFile);
          setSnapshot((current) =>
            current
              ? {
                  ...current,
                  compileResult,
                }
              : current,
          );
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        setBootstrapError(message);
      }
    })();
  }, []);

  const runForwardSync = useEffectEvent(async (filePath: string, line: number) => {
    if (!snapshot?.projectConfig.forwardSync || snapshot.compileResult.status !== "success") {
      return;
    }
    try {
      const location = await desktop.forwardSearch(filePath, line);
      setHighlightedPage(location.page);
    } catch (error) {
      console.warn("forward sync failed", error);
    }
  });

  useEffect(() => {
    if (!deferredActiveFile) {
      return;
    }
    const timer = window.setTimeout(() => {
      void runForwardSync(deferredActiveFile.path, cursorLine);
    }, 420);
    return () => window.clearTimeout(timer);
  }, [cursorLine, deferredActiveFile, snapshot?.compileResult.status]);

  async function saveAndCompile(filePath: string, content: string) {
    await desktop.saveFile(filePath, content);
    if (!snapshot?.projectConfig.autoCompile) {
      return;
    }
    setSnapshot((current) =>
      current
        ? {
            ...current,
            compileResult: {
              ...current.compileResult,
              status: "running",
              logOutput: "Compile queued…",
              diagnostics: current.compileResult.diagnostics,
              logPath: current.compileResult.logPath,
              timestamp: new Date().toISOString(),
            },
          }
        : current,
    );

    const compileResult = await desktop.compileProject(filePath);
    setSnapshot((current) =>
      current
        ? {
            ...current,
            compileResult,
          }
        : current,
    );
  }

  function replaceFileContent(filePath: string, content: string) {
    setSnapshot((current) => {
      if (!current) {
        return current;
      }
      return {
        ...current,
        files: current.files.map((file) => (file.path === filePath ? { ...file, content } : file)),
      };
    });
  }

  function handleFileChange(content: string) {
    if (!activeFile) {
      return;
    }
    replaceFileContent(activeFile.path, content);
    void saveAndCompile(activeFile.path, content);
  }

  function handleOpenFile(path: string) {
    startTransition(() => {
      setActiveFilePath(path);
      setOpenTabs((current) => (current.includes(path) ? current : [...current, path]));
    });
  }

  async function handleRunAgent() {
    if (!activeFile) {
      return;
    }
    const result = await desktop.runAgent(activeProfileId, activeFile.path, selectedText);
    const nextMessages = await desktop.getAgentMessages();
    setMessages(nextMessages);
    setPendingPatch(result.suggestedPatch ?? null);
  }

  async function handleApplyPatch() {
    if (!pendingPatch) {
      return;
    }
    await desktop.applyAgentPatch(pendingPatch.filePath, pendingPatch.content);
    replaceFileContent(pendingPatch.filePath, pendingPatch.content);
    setPendingPatch(null);
  }

  async function handleCreateBrief() {
    if (!activeFile) {
      return;
    }
    const brief = await desktop.createFigureBrief(activeFile.path, selectedText);
    setSnapshot((current) =>
      current
        ? {
            ...current,
            figureBriefs: [brief, ...current.figureBriefs.filter((item) => item.id !== brief.id)],
          }
        : current,
    );
    setSelectedBrief(brief);
    setDrawerTab("figures");
  }

  async function handleRunFigureSkill() {
    if (!selectedBrief) {
      return;
    }
    const updated = await desktop.runFigureSkill(selectedBrief.id);
    setSelectedBrief(updated);
    setSnapshot((current) =>
      current
        ? {
            ...current,
            figureBriefs: current.figureBriefs.map((item) => (item.id === updated.id ? updated : item)),
          }
        : current,
    );
  }

  async function handleGenerateFigure() {
    if (!selectedBrief) {
      return;
    }
    const asset = await desktop.runBananaGeneration(selectedBrief.id);
    await desktop.registerGeneratedAsset(asset);
    setSelectedAsset(asset);
    setSnapshot((current) =>
      current
        ? {
            ...current,
            assets: [asset, ...current.assets.filter((item) => item.id !== asset.id)],
          }
        : current,
    );
  }

  async function handleInsertFigure() {
    if (!activeFile || !selectedAsset) {
      return;
    }
    const result = await desktop.insertFigureSnippet(
      activeFile.path,
      selectedAsset.id,
      "Workflow overview of ViewerLeaf.",
      cursorLine + 1,
    );
    replaceFileContent(result.filePath, result.content);
  }

  async function handlePageJump(page: number) {
    if (snapshot?.compileResult.status !== "success") {
      return;
    }
    setHighlightedPage(page);
    try {
      const location = await desktop.reverseSearch(page);
      handleOpenFile(location.filePath);
      setCursorLine(location.line);
    } catch (error) {
      console.warn("reverse sync failed", error);
    }
  }

  if (bootstrapError) {
    return <div className="app-shell loading-shell">ViewerLeaf failed to start: {bootstrapError}</div>;
  }

  if (!snapshot || !deferredActiveFile) {
    return <div className="app-shell loading-shell">Booting ViewerLeaf…</div>;
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="topbar-main">
          <div className="brand-block">
            <p className="eyebrow">ViewerLeaf</p>
            <h1>Local-first paper workbench</h1>
            <span>{snapshot.projectConfig.rootPath}</span>
          </div>
          <div className="topbar-actions">
            <div className="metric-card">
              <span className="metric-label">Compile</span>
              <strong>{snapshot.compileResult.status}</strong>
            </div>
            <div className="metric-card">
              <span className="metric-label">Engine</span>
              <strong>{snapshot.projectConfig.engine}</strong>
            </div>
            <div className="metric-card">
              <span className="metric-label">Diagnostics</span>
              <strong>{snapshot.compileResult.diagnostics.length}</strong>
            </div>
            <button className="primary-button topbar-run" onClick={handleRunAgent} type="button">
              Run {activeProfile?.label ?? "profile"}
            </button>
          </div>
        </div>
        <div className="toolbar-block">
          <div className="profile-strip" role="tablist" aria-label="Agent profiles">
            {snapshot.profiles.map((profile) => (
              <button
                key={profile.id}
                className={`profile-switcher ${activeProfileId === profile.id ? "is-active" : ""}`}
                onClick={() => setActiveProfileId(profile.id)}
                type="button"
              >
                <span>{profile.label}</span>
                <small>{profile.stage}</small>
              </button>
            ))}
          </div>
          <div className="status-card">
            <strong>{activeFilePath}</strong>
            <span>
              {snapshot.projectConfig.mainTex} · {snapshot.projectConfig.bibTool} · page {highlightedPage}
            </span>
          </div>
        </div>
      </header>

      <main className="workspace-grid">
        <ProjectTree nodes={snapshot.tree} activeFile={activeFilePath} onOpenFile={handleOpenFile} />

        <EditorPane
          file={deferredActiveFile}
          openTabs={openTabs}
          onChange={handleFileChange}
          onCursorChange={(line, selection) => {
            setCursorLine(line);
            setSelectedText(selection);
          }}
          onSelectTab={handleOpenFile}
        />

        <PdfPane compileResult={snapshot.compileResult} highlightedPage={highlightedPage} onPageJump={handlePageJump} />
      </main>

      <BottomDock
        tab={drawerTab}
        onTabChange={setDrawerTab}
        messages={messages}
        profiles={snapshot.profiles}
        activeProfileId={activeProfileId}
        onSelectProfile={(profileId) => setActiveProfileId(profileId as AgentProfileId)}
        onRunAgent={handleRunAgent}
        pendingPatchSummary={pendingPatch?.summary}
        onApplyPatch={handleApplyPatch}
        compileLog={snapshot.compileResult.logOutput}
        diagnosticsCount={snapshot.compileResult.diagnostics.length}
        briefs={snapshot.figureBriefs}
        assets={snapshot.assets}
        selectedBriefId={selectedBrief?.id}
        selectedAssetId={selectedAsset?.id}
        onCreateBrief={handleCreateBrief}
        onRunFigureSkill={handleRunFigureSkill}
        onGenerateFigure={handleGenerateFigure}
        onInsertFigure={handleInsertFigure}
        onSelectBrief={(briefId) => {
          const brief = snapshot.figureBriefs.find((item) => item.id === briefId) ?? null;
          setSelectedBrief(brief);
        }}
        onSelectAsset={(assetId) => {
          const asset = snapshot.assets.find((item) => item.id === assetId) ?? null;
          setSelectedAsset(asset);
        }}
        skills={snapshot.skills}
        providers={snapshot.providers}
      />
    </div>
  );
}

export default App;
