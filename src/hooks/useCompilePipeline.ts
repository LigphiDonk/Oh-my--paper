import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { CompileAdapter, FileAdapter } from "../lib/adapters";
import type { DrawerTab, LatexEngine, SyncHighlight, WorkspaceSnapshot } from "../types";

function normalizeProjectPath(path: string) {
  return path.replaceAll("\\", "/");
}

function toProjectRelativePath(rootPath: string, filePath?: string) {
  if (!rootPath || !filePath) {
    return "";
  }

  const normalizedRoot = normalizeProjectPath(rootPath).replace(/\/$/, "");
  const normalizedFile = normalizeProjectPath(filePath);
  const prefix = `${normalizedRoot}/`;

  return normalizedFile.startsWith(prefix) ? normalizedFile.slice(prefix.length) : "";
}

const COMPILE_DEBUG_LOG_LIMIT = 300;

function formatDebugTimestamp(date: Date) {
  const pad = (value: number, length = 2) => String(value).padStart(length, "0");
  return `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}.${pad(date.getMilliseconds(), 3)}`;
}

function serializeDebugDetails(details: unknown) {
  if (details == null) {
    return "";
  }
  if (typeof details === "string") {
    return details;
  }
  try {
    return JSON.stringify(details);
  } catch {
    return String(details);
  }
}

interface UseCompilePipelineParams {
  snapshot: WorkspaceSnapshot | null;
  activeFilePath: string;
  cursorLine: number;
  cursorColumn: number;
  dirtyPaths: string[];
  drawerTab: DrawerTab;
  compileAdapter: CompileAdapter;
  fileAdapter: FileAdapter;
  saveOpenFiles: (paths: string[]) => Promise<string[]>;
  openTextFile: (path: string, line?: number) => void;
  docManager?: { flushAll(): Promise<void> } | null;
}

export interface CompilePipelineState {
  compilePdfData: Uint8Array | null;
  compilePdfLoadedKey: string;
  isLoadingCompilePdf: boolean;
  compilePreviewLoadError: string;
  compileDebugLogLines: string[];
  compileEnvironment: Awaited<ReturnType<CompileAdapter["getCompileEnvironment"]>> | null;
  isCheckingCompileEnvironment: boolean;
  highlightedPage: number;
  syncHighlights: SyncHighlight[];
  compilePreviewPath: string;
  logCompileDebug: (level: "info" | "warn" | "error", message: string, details?: unknown) => void;
  refreshCompileEnvironment: () => Promise<Awaited<ReturnType<CompileAdapter["getCompileEnvironment"]>> | null>;
  performForwardSync: (filePath: string, line: number, column: number) => Promise<void>;
  runCompile: (filePath: string) => Promise<Awaited<ReturnType<CompileAdapter["compileProject"]>>>;
  handleManualCompile: () => Promise<void>;
  handleInteractiveCompile: () => Promise<void>;
  handlePageJump: (page: number) => Promise<void>;
  handleDoubleClickPage: (page: number, h: number, v: number) => Promise<void>;
  resetForSnapshot: () => void;
}

export function useCompilePipeline({
  snapshot,
  activeFilePath,
  cursorLine,
  cursorColumn,
  dirtyPaths,
  drawerTab,
  compileAdapter,
  fileAdapter,
  saveOpenFiles,
  openTextFile,
  docManager = null,
}: UseCompilePipelineParams): CompilePipelineState {
  const [compilePdfData, setCompilePdfData] = useState<Uint8Array | null>(null);
  const [compilePdfLoadedKey, setCompilePdfLoadedKey] = useState("");
  const [isLoadingCompilePdf, setIsLoadingCompilePdf] = useState(false);
  const [compilePreviewLoadError, setCompilePreviewLoadError] = useState("");
  const [compileDebugLogLines, setCompileDebugLogLines] = useState<string[]>([]);
  const [compileEnvironment, setCompileEnvironment] = useState<Awaited<
    ReturnType<CompileAdapter["getCompileEnvironment"]>
  > | null>(null);
  const [isCheckingCompileEnvironment, setIsCheckingCompileEnvironment] = useState(false);
  const [highlightedPage, setHighlightedPage] = useState(1);
  const [syncHighlights, setSyncHighlights] = useState<SyncHighlight[]>([]);
  const snapshotRef = useRef<WorkspaceSnapshot | null>(null);
  const activeFilePathRef = useRef(activeFilePath);
  const dirtyPathsRef = useRef(dirtyPaths);
  const openTextFileRef = useRef(openTextFile);
  const saveOpenFilesRef = useRef(saveOpenFiles);
  const docManagerRef = useRef(docManager);

  const compilePreviewPath = useMemo(
    () => toProjectRelativePath(snapshot?.projectConfig.rootPath ?? "", snapshot?.compileResult.pdfPath),
    [snapshot?.compileResult.pdfPath, snapshot?.projectConfig.rootPath],
  );

  useEffect(() => {
    snapshotRef.current = snapshot;
  }, [snapshot]);

  useEffect(() => {
    activeFilePathRef.current = activeFilePath;
  }, [activeFilePath]);

  useEffect(() => {
    dirtyPathsRef.current = dirtyPaths;
  }, [dirtyPaths]);

  useEffect(() => {
    openTextFileRef.current = openTextFile;
  }, [openTextFile]);

  useEffect(() => {
    saveOpenFilesRef.current = saveOpenFiles;
  }, [saveOpenFiles]);

  useEffect(() => {
    docManagerRef.current = docManager;
  }, [docManager]);

  const logCompileDebug = useCallback((level: "info" | "warn" | "error", message: string, details?: unknown) => {
    const timestamp = formatDebugTimestamp(new Date());
    const detailText = serializeDebugDetails(details);
    const line =
      detailText.length > 0
        ? `[${timestamp}] [${level.toUpperCase()}] ${message} ${detailText}`
        : `[${timestamp}] [${level.toUpperCase()}] ${message}`;

    setCompileDebugLogLines((current) => {
      const next = [...current, line];
      return next.length > COMPILE_DEBUG_LOG_LIMIT ? next.slice(next.length - COMPILE_DEBUG_LOG_LIMIT) : next;
    });

    if (level === "error") {
      console.error(message, details);
    } else if (level === "warn") {
      console.warn(message, details);
    } else {
      console.info(message, details);
    }
  }, []);

  const resetForSnapshot = useCallback(() => {
    setHighlightedPage(1);
    setSyncHighlights([]);
    setCompilePdfData(null);
    setCompilePdfLoadedKey("");
    setCompilePreviewLoadError("");
    setIsLoadingCompilePdf(false);
    setCompileDebugLogLines([]);
    setCompileEnvironment(null);
    setIsCheckingCompileEnvironment(false);
  }, []);

  const refreshCompileEnvironment = useCallback(async () => {
    if (!snapshotRef.current?.projectConfig.rootPath) {
      setCompileEnvironment(null);
      return null;
    }

    setIsCheckingCompileEnvironment(true);
    try {
      const nextEnvironment = await compileAdapter.getCompileEnvironment();
      setCompileEnvironment(nextEnvironment);
      return nextEnvironment;
    } finally {
      setIsCheckingCompileEnvironment(false);
    }
  }, [compileAdapter]);

  const performForwardSync = useCallback(async (filePath: string, line: number, column: number) => {
    if (snapshotRef.current?.compileResult.status !== "success") {
      return;
    }
    try {
      const location = await compileAdapter.forwardSearch(filePath, line, column);
      setHighlightedPage(location.page);
      setSyncHighlights(location.highlights ?? []);
    } catch (error) {
      console.warn("forward sync failed", error);
    }
  }, [compileAdapter]);

  const runCompile = useCallback(async (filePath: string) => {
    const currentSnapshot = snapshotRef.current;
    const compileWorkspaceRoot = currentSnapshot?.projectConfig.rootPath ?? "";
    const previousCompilePath = toProjectRelativePath(
      compileWorkspaceRoot,
      currentSnapshot?.compileResult.pdfPath,
    );

    setCompileDebugLogLines((current) => {
      const marker = `[${formatDebugTimestamp(new Date())}] [INFO] ===== compile requested =====`;
      const next = [...current, marker];
      return next.length > COMPILE_DEBUG_LOG_LIMIT ? next.slice(next.length - COMPILE_DEBUG_LOG_LIMIT) : next;
    });

    if (docManagerRef.current) {
      await docManagerRef.current.flushAll();
    }

    setSyncHighlights([]);
    setCompilePreviewLoadError("");
    setIsLoadingCompilePdf(true);
    logCompileDebug("info", "[compile] start", {
      filePath,
      previousStatus: currentSnapshot?.compileResult.status,
      previousPdfPath: currentSnapshot?.compileResult.pdfPath,
    });

    const compileResult = await compileAdapter.compileProject(filePath);
    const nextCompilePath = toProjectRelativePath(compileWorkspaceRoot, compileResult.pdfPath);
    const currentWorkspaceRoot = snapshotRef.current?.projectConfig.rootPath ?? "";

    logCompileDebug("info", "[compile] result", {
      status: compileResult.status,
      pdfPath: compileResult.pdfPath,
      diagnostics: compileResult.diagnostics.length,
      timestamp: compileResult.timestamp,
    });

    if (currentWorkspaceRoot !== compileWorkspaceRoot) {
      logCompileDebug("info", "[compile] stale result ignored after workspace switch", {
        compileWorkspaceRoot,
        currentWorkspaceRoot,
      });
      return compileResult;
    }

    if (previousCompilePath && previousCompilePath !== nextCompilePath) {
      // The app-level snapshot refresh will clear the old asset cache entry.
    }

    return compileResult;
  }, [compileAdapter, logCompileDebug]);

  const handleManualCompile = useCallback(async () => {
    const currentSnapshot = snapshotRef.current;
    if (!currentSnapshot) {
      return;
    }

    await saveOpenFilesRef.current(dirtyPathsRef.current);
    const compileResult = await runCompile(activeFilePathRef.current || currentSnapshot.projectConfig.mainTex);
    if (snapshotRef.current) {
      snapshotRef.current = {
        ...snapshotRef.current,
        compileResult,
      };
    }
  }, [runCompile]);

  const handleInteractiveCompile = useCallback(async () => {
    const currentSnapshot = snapshotRef.current;
    if (!currentSnapshot) {
      return;
    }

    try {
      const environment = await refreshCompileEnvironment();
      const selectedEngine = currentSnapshot.projectConfig.engine as LatexEngine;
      const selectedEngineAvailable = environment?.availableEngines.includes(selectedEngine) ?? false;

      if (!environment?.ready || !selectedEngineAvailable) {
        return;
      }
    } catch (error) {
      logCompileDebug("warn", "[compile] failed to detect compile environment", {
        reason: error instanceof Error ? error.message : String(error),
      });
      return;
    }

    await handleManualCompile();
  }, [handleManualCompile, logCompileDebug, refreshCompileEnvironment]);

  const handlePageJump = useCallback(async (page: number) => {
    setHighlightedPage(page);
    setSyncHighlights([]);
    if (snapshotRef.current?.compileResult.status !== "success") {
      return;
    }
    try {
      const location = await compileAdapter.reverseSearch(page);
      openTextFileRef.current(location.filePath, location.line);
    } catch (error) {
      console.warn("reverse sync failed", error);
    }
  }, [compileAdapter]);

  const handleDoubleClickPage = useCallback(async (page: number, h: number, v: number) => {
    if (snapshotRef.current?.compileResult.status !== "success") {
      return;
    }

    setHighlightedPage(page);
    setSyncHighlights([]);

    try {
      const location = await compileAdapter.reverseSearch(page, h, v);
      openTextFileRef.current(location.filePath, location.line);
    } catch (error) {
      console.warn("reverse sync failed", error);
    }
  }, [compileAdapter]);

  useEffect(() => {
    if (!snapshot?.projectConfig.rootPath) {
      setCompileEnvironment(null);
      setIsCheckingCompileEnvironment(false);
      return;
    }

    if (drawerTab === "latex") {
      void refreshCompileEnvironment();
    }
  }, [drawerTab, refreshCompileEnvironment, snapshot?.projectConfig.rootPath]);

  useEffect(() => {
    if (!snapshot?.projectConfig.forwardSync || !activeFilePath) {
      return;
    }
    const timer = window.setTimeout(() => {
      void performForwardSync(activeFilePath, cursorLine, cursorColumn);
    }, 420);
    return () => window.clearTimeout(timer);
  }, [activeFilePath, cursorColumn, cursorLine, performForwardSync, snapshot?.compileResult.status, snapshot?.projectConfig.forwardSync]);

  useEffect(() => {
    const currentCompilePdfKey = snapshot?.compileResult.pdfPath
      ? `${snapshot.compileResult.pdfPath}:${snapshot.compileResult.timestamp}`
      : "";

    if (!snapshot?.compileResult.pdfPath || snapshot.compileResult.status === "running") {
      if (snapshot?.compileResult.status === "running") {
        setIsLoadingCompilePdf(false);
      }
      return;
    }

    if (compilePdfData !== null && compilePdfLoadedKey === currentCompilePdfKey) {
      setIsLoadingCompilePdf(false);
      return;
    }

    let cancelled = false;

    void (async () => {
      const shouldRetry = snapshot.compileResult.status === "success";
      const attempts = shouldRetry ? 8 : 1;
      const fallbackAssetPath =
        compilePreviewPath || snapshot.compileResult.pdfPath || "";
      setIsLoadingCompilePdf(true);
      setCompilePreviewLoadError("");

      logCompileDebug("info", "[pdf-preview] begin loading compile pdf", {
        key: currentCompilePdfKey,
        absolutePath: snapshot.compileResult.pdfPath,
        relativePath: compilePreviewPath,
        fallbackAssetPath,
        attempts,
      });

      for (let attempt = 0; attempt < attempts; attempt += 1) {
        const data = await fileAdapter.readPdfBinary(snapshot.compileResult.pdfPath!);
        if (cancelled) {
          return;
        }
        if (data && data.length > 0) {
          logCompileDebug("info", "[pdf-preview] loaded compile pdf via read_pdf_binary", {
            key: currentCompilePdfKey,
            bytes: data.length,
            attempt: attempt + 1,
          });
          setCompilePdfData(new Uint8Array(data));
          setCompilePdfLoadedKey(currentCompilePdfKey);
          setCompilePreviewLoadError("");
          setIsLoadingCompilePdf(false);
          return;
        }

        if (fallbackAssetPath) {
          const asset = await fileAdapter.readAsset(fallbackAssetPath).catch((error) => {
            logCompileDebug("warn", "[pdf-preview] readAsset fallback failed", {
              key: currentCompilePdfKey,
              fallbackAssetPath,
              attempt: attempt + 1,
              reason: error instanceof Error ? error.message : String(error),
            });
            return null;
          });
          const assetData = asset?.data instanceof Uint8Array ? asset.data : undefined;
          if (assetData && assetData.length > 0) {
            logCompileDebug("info", "[pdf-preview] loaded compile pdf via read_asset fallback", {
              key: currentCompilePdfKey,
              bytes: assetData.length,
              attempt: attempt + 1,
              fallbackAssetPath,
            });
            setCompilePdfData(new Uint8Array(assetData));
            setCompilePdfLoadedKey(currentCompilePdfKey);
            setCompilePreviewLoadError("");
            setIsLoadingCompilePdf(false);
            return;
          }
        }

        logCompileDebug("info", "[pdf-preview] compile pdf not ready yet", {
          key: currentCompilePdfKey,
          attempt: attempt + 1,
          fallbackAssetPath,
        });

        if (attempt < attempts - 1) {
          await new Promise((resolve) => {
            window.setTimeout(resolve, 180 * (attempt + 1));
          });
        }
      }

      if (cancelled) {
        return;
      }

      setIsLoadingCompilePdf(false);
      if (snapshot.compileResult.status === "success") {
        logCompileDebug("error", "[pdf-preview] failed to load compile pdf after retries", {
          key: currentCompilePdfKey,
          absolutePath: snapshot.compileResult.pdfPath,
          relativePath: compilePreviewPath,
          fallbackAssetPath,
        });
        setCompilePreviewLoadError(
          "编译已经完成，但预览区暂时没有读到新的 PDF 文件。通常是编译输出刚被替换，或当前 PDF 仍被占用。",
        );
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    compilePdfData,
    compilePdfLoadedKey,
    compilePreviewPath,
    fileAdapter,
    logCompileDebug,
    snapshot?.compileResult.pdfPath,
    snapshot?.compileResult.status,
    snapshot?.compileResult.timestamp,
  ]);

  return {
    compilePdfData,
    compilePdfLoadedKey,
    isLoadingCompilePdf,
    compilePreviewLoadError,
    compileDebugLogLines,
    compileEnvironment,
    isCheckingCompileEnvironment,
    highlightedPage,
    syncHighlights,
    compilePreviewPath,
    logCompileDebug,
    refreshCompileEnvironment,
    performForwardSync,
    runCompile,
    handleManualCompile,
    handleInteractiveCompile,
    handlePageJump,
    handleDoubleClickPage,
    resetForSnapshot,
  };
}
