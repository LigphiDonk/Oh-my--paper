import type { Awareness } from "y-protocols/awareness";
import * as Y from "yjs";

const FRAME_SYNC_REQUEST = 0;
const FRAME_SYNC_RESPONSE = 1;
const FRAME_DOCUMENT_UPDATE = 2;
const FRAME_AWARENESS_UPDATE = 3;
const AWARENESS_SYNC_ENABLED = false;

type ProviderEventMap = {
  sync: () => void;
  "connection-error": (error: Error) => void;
  status: (connected: boolean) => void;
  reconnecting: (attempt: number, delay: number) => void;
};

function sanitizeWsUrl(rawUrl: string) {
  try {
    const url = new URL(rawUrl);
    if (url.searchParams.has("token")) {
      url.searchParams.set("token", "***");
    }
    return url.toString();
  } catch {
    return rawUrl;
  }
}

function encodeFrame(type: number, payload?: Uint8Array) {
  const bytes = payload ?? new Uint8Array(0);
  const frame = new Uint8Array(bytes.length + 1);
  frame[0] = type;
  frame.set(bytes, 1);
  return frame;
}

function decodeFrame(message: ArrayBuffer | ArrayBufferView) {
  const bytes = message instanceof ArrayBuffer
    ? new Uint8Array(message)
    : new Uint8Array(message.buffer, message.byteOffset, message.byteLength);
  return {
    type: bytes[0] ?? -1,
    payload: bytes.slice(1),
  };
}

export class ViewerLeafProvider {
  private readonly wsUrl: string;
  private readonly yDoc: Y.Doc;
  readonly awareness: Awareness;
  private readonly authToken: string;
  private readonly user: { userId: string; name: string; color: string };
  private readonly docPath: string;
  private ws: WebSocket | null = null;
  private listeners = new Map<keyof ProviderEventMap, Set<(...args: unknown[]) => void>>();
  private heartbeatTimer: number | null = null;
  private syncedState = false;
  private reconnectTimer: number | null = null;
  private reconnectAttempt = 0;
  private shouldReconnect = true;
  private static readonly MAX_DELAY = 30_000;
  private static readonly BASE_DELAY = 1_000;
  private readonly debugLog?: (message: string, details?: unknown) => void;

  private readonly handleDocumentUpdate = (update: Uint8Array, origin: unknown) => {
    if (origin === this || !this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return;
    }
    this.ws.send(encodeFrame(FRAME_DOCUMENT_UPDATE, update));
  };

  private readonly handleAwarenessUpdate = (
    { added, updated, removed }: { added: number[]; updated: number[]; removed: number[] },
    origin: unknown,
  ) => {
    if (!AWARENESS_SYNC_ENABLED) {
      return;
    }
    if (origin === this || !this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return;
    }
    if (added.length + updated.length + removed.length === 0) {
      return;
    }
  };

  constructor(
    wsUrl: string,
    yDoc: Y.Doc,
    awareness: Awareness,
    authToken: string,
    user: { userId: string; name: string; color: string },
    docPath: string,
    debugLog?: (message: string, details?: unknown) => void,
  ) {
    this.wsUrl = wsUrl;
    this.yDoc = yDoc;
    this.awareness = awareness;
    this.authToken = authToken;
    this.user = user;
    this.docPath = docPath;
    this.debugLog = debugLog;
    this.yDoc.on("update", this.handleDocumentUpdate);
    if (AWARENESS_SYNC_ENABLED) {
      this.awareness.on("update", this.handleAwarenessUpdate);
    }
  }

  get synced() {
    return this.syncedState;
  }

  sendDocumentUpdate(update: Uint8Array) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return false;
    }
    this.ws.send(encodeFrame(FRAME_DOCUMENT_UPDATE, update));
    return true;
  }

  connect() {
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      this.debugLog?.("[collab.ws] connect skipped because socket is already active", {
        path: this.docPath,
        readyState: this.ws.readyState,
      });
      return;
    }

    this.shouldReconnect = true;
    this.syncedState = false;
    this.debugLog?.("[collab.ws] opening websocket", {
      path: this.docPath,
      url: sanitizeWsUrl(this.wsUrl),
    });
    const ws = new WebSocket(this.wsUrl);
    ws.binaryType = "arraybuffer";
    ws.addEventListener("open", this.handleOpen);
    ws.addEventListener("message", this.handleMessage);
    ws.addEventListener("close", this.handleClose);
    ws.addEventListener("error", this.handleError);
    this.ws = ws;
  }

  disconnect() {
    this.shouldReconnect = false;
    this.clearReconnectTimer();
    this.stopHeartbeat();
    this.debugLog?.("[collab.ws] disconnect requested", {
      path: this.docPath,
      hadSocket: Boolean(this.ws),
    });
    if (!this.ws) {
      return;
    }

    this.ws.removeEventListener("open", this.handleOpen);
    this.ws.removeEventListener("message", this.handleMessage);
    this.ws.removeEventListener("close", this.handleClose);
    this.ws.removeEventListener("error", this.handleError);
    this.ws.close();
    this.ws = null;
    this.syncedState = false;
    this.emit("status", false);
  }

  destroy() {
    this.disconnect();
    if (AWARENESS_SYNC_ENABLED) {
      this.awareness.off("update", this.handleAwarenessUpdate);
    }
    this.yDoc.off("update", this.handleDocumentUpdate);
    this.awareness.setLocalState(null);
    this.reconnectAttempt = 0;
  }

  on<EventName extends keyof ProviderEventMap>(event: EventName, cb: ProviderEventMap[EventName]) {
    const set = this.listeners.get(event) ?? new Set();
    set.add(cb as (...args: unknown[]) => void);
    this.listeners.set(event, set);
  }

  off<EventName extends keyof ProviderEventMap>(event: EventName, cb: ProviderEventMap[EventName]) {
    this.listeners.get(event)?.delete(cb as (...args: unknown[]) => void);
  }

  private readonly handleOpen = () => {
    if (!this.ws) {
      return;
    }

    this.reconnectAttempt = 0;
    this.debugLog?.("[collab.ws] websocket open", {
      path: this.docPath,
      url: sanitizeWsUrl(this.wsUrl),
    });
    this.emit("status", true);
    this.ws.send(
      JSON.stringify({
        type: "join",
        userId: this.user.userId,
        clientId: this.yDoc.clientID,
        name: this.user.name,
        color: this.user.color,
        openFile: this.docPath,
        token: this.authToken,
      }),
    );
    if (AWARENESS_SYNC_ENABLED) {
      this.awareness.setLocalStateField("user", {
        userId: this.user.userId,
        name: this.user.name,
        color: this.user.color,
        colorLight: `${this.user.color}33`,
        openFile: this.docPath,
      });
    }
    this.ws.send(encodeFrame(FRAME_SYNC_REQUEST, Y.encodeStateVector(this.yDoc)));
    if (AWARENESS_SYNC_ENABLED) {
      this.sendAwarenessPing();
      this.startHeartbeat();
    }
  };

  private readonly handleMessage = (event: MessageEvent<string | ArrayBuffer>) => {
    if (typeof event.data === "string") {
      try {
        const payload = JSON.parse(event.data) as { type?: string; message?: string };
        if (payload.type === "error") {
          this.debugLog?.("[collab.ws] server error frame", {
            path: this.docPath,
            message: payload.message || "Connection failed",
          });
          this.emit("connection-error", new Error(payload.message || "Connection failed"));
        }
      } catch (error) {
        this.debugLog?.("[collab.ws] failed to parse text frame", {
          path: this.docPath,
          message: error instanceof Error ? error.message : String(error),
        });
        this.emit("connection-error", error instanceof Error ? error : new Error(String(error)));
      }
      return;
    }

    const { type, payload } = decodeFrame(event.data);
    switch (type) {
      case FRAME_SYNC_RESPONSE:
      case FRAME_DOCUMENT_UPDATE:
        Y.applyUpdate(this.yDoc, payload, this);
        if (!this.syncedState) {
          this.syncedState = true;
          this.debugLog?.("[collab.ws] document synced", {
            path: this.docPath,
            frameType: type === FRAME_SYNC_RESPONSE ? "sync-response" : "document-update",
            bytes: payload.byteLength,
          });
          this.emit("sync");
        }
        break;
      case FRAME_AWARENESS_UPDATE:
        if (AWARENESS_SYNC_ENABLED) {
          // Awareness frames are intentionally ignored unless presence sync is enabled.
        }
        break;
      default:
        this.debugLog?.("[collab.ws] unknown frame received", {
          path: this.docPath,
          frameType: type,
          bytes: payload.byteLength,
        });
        this.emit("connection-error", new Error("Unknown collaboration frame"));
    }
  };

  private readonly handleClose = (event: CloseEvent) => {
    this.stopHeartbeat();
    this.ws = null;
    this.syncedState = false;
    this.debugLog?.("[collab.ws] websocket closed", {
      path: this.docPath,
      code: event.code,
      reason: event.reason || "",
      wasClean: event.wasClean,
    });
    this.emit("status", false);
    this.scheduleReconnect();
  };

  private readonly handleError = () => {
    this.debugLog?.("[collab.ws] websocket error", {
      path: this.docPath,
      url: sanitizeWsUrl(this.wsUrl),
    });
    this.emit("connection-error", new Error("WebSocket connection error"));
  };

  private startHeartbeat() {
    this.stopHeartbeat();
    this.heartbeatTimer = window.setInterval(() => {
      this.sendAwarenessPing();
    }, 15_000);
  }

  private stopHeartbeat() {
    if (this.heartbeatTimer !== null) {
      window.clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  private sendAwarenessPing() {
    if (!AWARENESS_SYNC_ENABLED || !this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return;
    }
  }

  private scheduleReconnect() {
    if (!this.shouldReconnect) return;
    const delay = Math.min(
      ViewerLeafProvider.BASE_DELAY * 2 ** this.reconnectAttempt,
      ViewerLeafProvider.MAX_DELAY,
    );
    this.reconnectAttempt++;
    this.debugLog?.("[collab.ws] scheduling reconnect", {
      path: this.docPath,
      attempt: this.reconnectAttempt,
      delayMs: delay,
    });
    this.emit("reconnecting", this.reconnectAttempt, delay);
    this.reconnectTimer = window.setTimeout(() => this.connect(), delay);
  }

  private clearReconnectTimer() {
    if (this.reconnectTimer !== null) {
      window.clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  private emit<EventName extends keyof ProviderEventMap>(
    event: EventName,
    ...args: Parameters<ProviderEventMap[EventName]>
  ) {
    for (const listener of this.listeners.get(event) ?? []) {
      listener(...args);
    }
  }
}
