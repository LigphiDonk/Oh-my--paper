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

export function TerminalPanel({ workspaceRoot, isVisible, height, onHide }: TerminalPanelProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const terminalRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const sessionIdRef = useRef("");
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
    if (!sessionId) {
      return;
    }

    sessionIdRef.current = "";
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
      terminal.focus();
    } catch (error) {
      setIsStarting(false);
      const message = error instanceof Error ? error.message : String(error);
      setStatusText(message);
      resetTerminal(`[终端启动失败] ${message}`);
    }
  };

  const handleTerminalEvent = (event: TerminalEvent) => {
    if (event.sessionId !== sessionIdRef.current) {
      return;
    }

    const terminal = terminalRef.current;
    if (!terminal) {
      return;
    }

    if (event.type === "output") {
      setIsStarting(false);
      terminal.write(event.data);
      return;
    }

    if (event.type === "exit") {
      setIsStarting(false);
      sessionIdRef.current = "";
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
      fontFamily:
        '"SF Mono", "Monaco", "Cascadia Code", "Menlo", "Consolas", monospace',
      fontSize: 12.5,
      lineHeight: 1.35,
      scrollback: 4000,
      theme: {
        background: "#fbfbfc",
        foreground: "#1f2328",
        cursor: "#10a37f",
        cursorAccent: "#ffffff",
        selectionBackground: "rgba(16, 163, 127, 0.18)",
        black: "#24292f",
        red: "#cf222e",
        green: "#116329",
        yellow: "#9a6700",
        blue: "#0969da",
        magenta: "#8250df",
        cyan: "#1b7c83",
        white: "#f6f8fa",
        brightBlack: "#656d76",
        brightRed: "#ff7b72",
        brightGreen: "#3fb950",
        brightYellow: "#d29922",
        brightBlue: "#58a6ff",
        brightMagenta: "#bc8cff",
        brightCyan: "#39c5cf",
        brightWhite: "#ffffff",
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
            {showOverlay ? (
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
