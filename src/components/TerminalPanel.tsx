import { useEffect, useRef, useState } from "react";
import { Terminal } from "xterm";
import { FitAddon } from "xterm-addon-fit";

import { desktop } from "../lib/desktop";
import type { TerminalEvent, TerminalSessionInfo } from "../types";

interface TerminalPanelProps {
  workspaceRoot: string;
  isVisible: boolean;
  height: number;
  onHide: () => void;
}

function safelyDisposeListener(listener?: (() => void | Promise<void>) | null) {
  if (!listener) {
    return;
  }

  try {
    const result = listener();
    if (result && typeof (result as Promise<unknown>).then === "function") {
      void (result as Promise<unknown>).catch((error) => {
        console.warn("failed to dispose terminal listener", error);
      });
    }
  } catch (error) {
    console.warn("failed to dispose terminal listener", error);
  }
}

function stripTerminalEscapeSequences(value: string) {
  return value
    .replace(/\u001b\][^\u0007]*(?:\u0007|\u001b\\)/g, "")
    .replace(/\u001b\[[0-9;?]*[ -/]*[@-~]/g, "")
    .replace(/\u001b./g, "");
}

function hasReadableTerminalOutput(value: string) {
  return stripTerminalEscapeSequences(value).replace(/[\r\n]/g, "").trim().length > 1;
}

export function TerminalPanel({ workspaceRoot, isVisible, height, onHide }: TerminalPanelProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const terminalRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const sessionIdRef = useRef("");
  const pendingEventsRef = useRef<Map<string, TerminalEvent[]>>(new Map());
  const startupPromptKickTimerRef = useRef<number | null>(null);
  const startupPromptKickCountRef = useRef(0);
  const hasSeenReadableOutputRef = useRef(false);
  const workspaceRootRef = useRef(workspaceRoot);
  const [sessionInfo, setSessionInfo] = useState<TerminalSessionInfo | null>(null);
  const [statusText, setStatusText] = useState("");
  const [isListenerReady, setIsListenerReady] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const isDesktop = desktop.isTauriRuntime();

  const fitTerminal = () => {
    const fitAddon = fitAddonRef.current;
    if (!fitAddon) {
      return;
    }

    try {
      fitAddon.fit();
    } catch (error) {
      console.warn("failed to fit terminal", error);
    }
  };

  const clearStartupPromptKick = () => {
    if (startupPromptKickTimerRef.current !== null) {
      window.clearTimeout(startupPromptKickTimerRef.current);
      startupPromptKickTimerRef.current = null;
    }
    startupPromptKickCountRef.current = 0;
  };

  const scheduleStartupPromptKick = (sessionId: string) => {
    if (startupPromptKickTimerRef.current !== null) {
      window.clearTimeout(startupPromptKickTimerRef.current);
      startupPromptKickTimerRef.current = null;
    }
    startupPromptKickTimerRef.current = window.setTimeout(() => {
      startupPromptKickTimerRef.current = null;
      if (sessionIdRef.current !== sessionId || hasSeenReadableOutputRef.current) {
        return;
      }
      startupPromptKickCountRef.current += 1;
      void desktop.terminalWrite(sessionId, "\r");
      if (startupPromptKickCountRef.current < 3) {
        scheduleStartupPromptKick(sessionId);
      }
    }, 500);
  };

  const resetTerminal = (message = "") => {
    const terminal = terminalRef.current;
    if (!terminal) {
      return;
    }

    terminal.reset();
    if (message) {
      terminal.writeln(message);
    }
  };

  const closeSession = async () => {
    const sessionId = sessionIdRef.current;
    setIsStarting(false);
    hasSeenReadableOutputRef.current = false;
    clearStartupPromptKick();
    if (!sessionId) {
      return;
    }

    sessionIdRef.current = "";
    pendingEventsRef.current.delete(sessionId);
    setSessionInfo(null);

    try {
      await desktop.closeTerminal(sessionId);
    } catch (error) {
      console.warn("failed to close terminal", error);
    }
  };

  const startSession = async () => {
    if (
      !isDesktop ||
      !isListenerReady ||
      !workspaceRoot.trim() ||
      sessionIdRef.current ||
      !terminalRef.current
    ) {
      return;
    }

    fitTerminal();
    setIsStarting(true);
    setStatusText("正在启动终端…");
    hasSeenReadableOutputRef.current = false;
    clearStartupPromptKick();

    try {
      const terminal = terminalRef.current;
      const info = await desktop.startTerminal(
        workspaceRoot,
        Math.max(terminal.cols, 24),
        Math.max(terminal.rows, 8),
      );
      sessionIdRef.current = info.sessionId;
      setSessionInfo(info);
      setStatusText(`${info.shell} · ${info.cwd}`);
      setIsStarting(false);
      const pendingEvents = pendingEventsRef.current.get(info.sessionId) ?? [];
      pendingEventsRef.current.delete(info.sessionId);
      for (const event of pendingEvents) {
        handleTerminalEvent(event);
      }
      scheduleStartupPromptKick(info.sessionId);
      terminal.focus();
    } catch (error) {
      setIsStarting(false);
      const message = error instanceof Error ? error.message : String(error);
      setStatusText(message);
      resetTerminal(`[终端启动失败] ${message}`);
    }
  };

  const handleTerminalEvent = (event: TerminalEvent) => {
    if (!sessionIdRef.current) {
      const buffered = pendingEventsRef.current.get(event.sessionId) ?? [];
      pendingEventsRef.current.set(event.sessionId, [...buffered, event].slice(-24));
      return;
    }

    if (event.sessionId !== sessionIdRef.current) {
      return;
    }

    const terminal = terminalRef.current;
    if (!terminal) {
      return;
    }

    if (event.type === "output") {
      setIsStarting(false);
      if (hasReadableTerminalOutput(event.data)) {
        hasSeenReadableOutputRef.current = true;
        clearStartupPromptKick();
      }
      terminal.write(event.data);
      return;
    }

    if (event.type === "exit") {
      setIsStarting(false);
      sessionIdRef.current = "";
      pendingEventsRef.current.delete(event.sessionId);
      clearStartupPromptKick();
      setSessionInfo(null);
      const suffix = event.signal
        ? `signal ${event.signal}`
        : typeof event.exitCode === "number"
          ? `code ${event.exitCode}`
          : "shell closed";
      setStatusText(`终端已退出 · ${suffix}`);
      terminal.writeln(`\r\n[终端已退出 · ${suffix}]`);
      return;
    }

    setIsStarting(false);
    clearStartupPromptKick();
    setStatusText(event.message);
    terminal.writeln(`\r\n[终端错误] ${event.message}`);
  };

  useEffect(() => {
    const host = hostRef.current;
    if (!host) {
      return;
    }

    const terminal = new Terminal({
      allowProposedApi: false,
      convertEol: false,
      cursorBlink: true,
      cursorStyle: "bar",
      cursorWidth: 2,
      fontFamily:
        '"SF Mono", "Monaco", "Cascadia Code", "Menlo", "Consolas", monospace',
      fontSize: 12.5,
      lineHeight: 1.35,
      scrollback: 4000,
      theme: {
        background: "#0f172a",
        foreground: "#e5e7eb",
        cursor: "#34d399",
        cursorAccent: "#0f172a",
        selectionBackground: "rgba(52, 211, 153, 0.22)",
        black: "#0f172a",
        red: "#f87171",
        green: "#4ade80",
        yellow: "#fbbf24",
        blue: "#60a5fa",
        magenta: "#c084fc",
        cyan: "#22d3ee",
        white: "#cbd5e1",
        brightBlack: "#64748b",
        brightRed: "#fca5a5",
        brightGreen: "#86efac",
        brightYellow: "#fcd34d",
        brightBlue: "#93c5fd",
        brightMagenta: "#d8b4fe",
        brightCyan: "#67e8f9",
        brightWhite: "#f8fafc",
      },
    });
    const fitAddon = new FitAddon();
    terminal.loadAddon(fitAddon);
    terminal.open(host);
    terminalRef.current = terminal;
    fitAddonRef.current = fitAddon;

    const inputDisposable = terminal.onData((data) => {
      if (!sessionIdRef.current) {
        return;
      }
      void desktop.terminalWrite(sessionIdRef.current, data);
    });

    const resizeDisposable = terminal.onResize(({ cols, rows }) => {
      if (!sessionIdRef.current) {
        return;
      }
      void desktop.resizeTerminal(sessionIdRef.current, cols, rows);
    });

    const observer = new ResizeObserver(() => {
      fitTerminal();
    });
    observer.observe(host);

    queueMicrotask(() => {
      fitTerminal();
    });

    return () => {
      observer.disconnect();
      inputDisposable.dispose();
      resizeDisposable.dispose();
      clearStartupPromptKick();
      void closeSession();
      terminal.dispose();
      terminalRef.current = null;
      fitAddonRef.current = null;
    };
  }, []);

  useEffect(() => {
    let unlisten: (() => void | Promise<void>) | null = null;
    let cancelled = false;

    void desktop.onTerminalEvent(handleTerminalEvent).then((listener) => {
      if (cancelled) {
        safelyDisposeListener(listener);
        return;
      }
      unlisten = listener;
      setIsListenerReady(true);
    });

    return () => {
      cancelled = true;
      setIsListenerReady(false);
      safelyDisposeListener(unlisten);
    };
  }, []);

  useEffect(() => {
    if (!isVisible) {
      return;
    }

    const timer = window.setTimeout(() => {
      fitTerminal();
      terminalRef.current?.focus();
      if (!sessionIdRef.current) {
        void startSession();
      }
    }, 40);

    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- startSession reads latest state from refs/current render
  }, [height, isVisible, isListenerReady]);

  useEffect(() => {
    if (workspaceRootRef.current === workspaceRoot) {
      return;
    }

    workspaceRootRef.current = workspaceRoot;

    void (async () => {
      await closeSession();
      setSessionInfo(null);
      setIsStarting(false);
      setStatusText("");
      resetTerminal();
      if (isVisible) {
        await startSession();
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- startSession reads latest state from refs/current render
  }, [workspaceRoot, isVisible]);

  const handleRestart = async () => {
    await closeSession();
    setIsStarting(false);
    setStatusText("");
    resetTerminal();
    if (isVisible) {
      await startSession();
    }
  };

  const handleClear = () => {
    terminalRef.current?.clear();
  };

  const showOverlay = isDesktop && isVisible && (!isListenerReady || isStarting);
  const shouldShowStartupOverlay = showOverlay && !sessionInfo;
  const overlayText = !isListenerReady
    ? "正在连接终端事件…"
    : statusText || sessionInfo?.cwd || workspaceRoot || "正在启动终端…";

  return (
    <div className="terminal-panel">
      <div className="terminal-panel-header">
        <div className="terminal-panel-tab">终端</div>
        <div className="terminal-panel-meta">
          {isDesktop
            ? statusText || sessionInfo?.cwd || workspaceRoot || "等待启动"
            : "内置终端仅支持桌面版"}
        </div>
        <div className="terminal-panel-actions">
          <button className="terminal-panel-btn" type="button" onClick={handleClear} disabled={!isDesktop}>
            清屏
          </button>
          <button className="terminal-panel-btn" type="button" onClick={() => void handleRestart()} disabled={!isDesktop}>
            重开
          </button>
          <button className="terminal-panel-btn" type="button" onClick={onHide}>
            隐藏
          </button>
        </div>
      </div>

      <div className="terminal-panel-body">
        {isDesktop ? (
          <>
            <div ref={hostRef} className="terminal-canvas" />
            {shouldShowStartupOverlay ? (
              <div className="terminal-panel-overlay" aria-hidden="true">
                <div className="terminal-panel-overlay-label">{overlayText}</div>
              </div>
            ) : null}
          </>
        ) : (
          <div className="terminal-panel-empty">内置终端仅支持桌面版应用。</div>
        )}
      </div>
    </div>
  );
}
