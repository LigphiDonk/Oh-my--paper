import * as Y from "yjs";

const FRAME_SYNC_REQUEST = 0;
const FRAME_SYNC_RESPONSE = 1;
const FRAME_DOCUMENT_UPDATE = 2;
interface ConnectionMeta {
  userId: string;
  role: "owner" | "editor" | "commenter" | "viewer";
  clientId: number;
  name: string;
  color: string;
  openFile?: string;
}

function cloneDoc(doc: Y.Doc) {
  const next = new Y.Doc();
  Y.applyUpdate(next, Y.encodeStateAsUpdate(doc));
  return next;
}

function contentValue(doc: Y.Doc) {
  return doc.getText("content").toString();
}

function encodeFrame(type: number, payload?: Uint8Array) {
  const data = payload ?? new Uint8Array(0);
  const frame = new Uint8Array(data.length + 1);
  frame[0] = type;
  frame.set(data, 1);
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

function toBinaryBody(data: Uint8Array) {
  return Uint8Array.from(data).buffer;
}

export class DocumentRoom implements DurableObject {
  private readonly ctx: DurableObjectState;
  private readonly yDoc = new Y.Doc();
  private readonly ready: Promise<void>;
  private updateCountSinceFlush = 0;
  private flushPromise: Promise<void> | null = null;

  constructor(ctx: DurableObjectState) {
    this.ctx = ctx;
    this.ready = this.ctx.blockConcurrencyWhile(async () => {
      const persisted = await this.ctx.storage.get<ArrayBuffer | Uint8Array>("doc-state");
      if (persisted) {
        Y.applyUpdate(this.yDoc, new Uint8Array(persisted));
      }
    });
  }

  async fetch(request: Request): Promise<Response> {
    await this.ready;
    const url = new URL(request.url);

    if (request.headers.get("upgrade") === "websocket") {
      return this.handleWebSocket(request);
    }

    if (url.pathname.endsWith("/snapshot") && request.method === "GET") {
      const snapshot = Y.encodeStateAsUpdate(this.yDoc);
      return new Response(toBinaryBody(snapshot), {
        headers: {
          "content-type": "application/octet-stream",
          "cache-control": "no-store",
        },
      });
    }

    if (url.pathname.endsWith("/snapshot") && request.method === "POST") {
      const payload = new Uint8Array(await request.arrayBuffer());
      const role = (request.headers.get("x-viewerleaf-role") as ConnectionMeta["role"] | null) ?? "editor";
      if (role === "viewer") {
        return new Response(JSON.stringify({ error: "read_only" }), {
          status: 403,
          headers: {
            "content-type": "application/json",
          },
        });
      }
      if (role === "commenter" && !this.canApplyCommentOnlyUpdate(payload)) {
        return new Response(JSON.stringify({ error: "comment_only" }), {
          status: 403,
          headers: {
            "content-type": "application/json",
          },
        });
      }
      if (payload.byteLength > 0) {
        Y.applyUpdate(this.yDoc, payload, this);
        await this.flushState();
      }
      return new Response(JSON.stringify({ ok: true }), {
        headers: {
          "content-type": "application/json",
        },
      });
    }

    if (url.pathname.endsWith("/flush") && request.method === "POST") {
      await this.flushState();
      return new Response(JSON.stringify({ ok: true }), {
        headers: {
          "content-type": "application/json",
        },
      });
    }

    return new Response("Not found", { status: 404 });
  }

  async alarm() {
    await this.ready;
    await this.flushState();
  }

  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer | ArrayBufferView) {
    await this.ready;

    if (typeof message === "string") {
      this.handleTextMessage(ws, message);
      return;
    }

    const meta = (ws.deserializeAttachment() as ConnectionMeta | null) ?? null;
    if (!meta?.userId) {
      ws.send(JSON.stringify({ type: "error", message: "join_required" }));
      ws.close(4401, "join required");
      return;
    }

    const { type, payload } = decodeFrame(message);
    switch (type) {
      case FRAME_SYNC_REQUEST: {
        const diff = Y.encodeStateAsUpdate(this.yDoc, payload);
        ws.send(encodeFrame(FRAME_SYNC_RESPONSE, diff));
        break;
      }
      case FRAME_DOCUMENT_UPDATE: {
        if (meta.role === "viewer") {
          ws.send(JSON.stringify({ type: "error", message: "read_only" }));
          return;
        }
        if (meta.role === "commenter" && !this.canApplyCommentOnlyUpdate(payload)) {
          ws.send(JSON.stringify({ type: "error", message: "comment_only" }));
          return;
        }

        Y.applyUpdate(this.yDoc, payload, ws);
        this.broadcast(encodeFrame(FRAME_DOCUMENT_UPDATE, payload), ws);
        await this.scheduleFlush();
        break;
      }
      default:
        ws.send(JSON.stringify({ type: "error", message: "unknown_frame" }));
    }
  }

  async webSocketClose(_ws: WebSocket) {
    await this.ready;
    if (this.ctx.getWebSockets().length === 0) {
      await this.flushState();
    }
  }

  private async handleWebSocket(request: Request) {
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);

    const userId = request.headers.get("x-viewerleaf-user-id") ?? "";
    const role = (request.headers.get("x-viewerleaf-role") as ConnectionMeta["role"] | null) ?? "editor";
    server.serializeAttachment({
      userId,
      role,
      clientId: 0,
      name: "",
      color: "#7a8cff",
    } satisfies ConnectionMeta);
    this.ctx.acceptWebSocket(server);

    return new Response(null, {
      status: 101,
      webSocket: client,
    });
  }

  private handleTextMessage(ws: WebSocket, message: string) {
    try {
      const payload = JSON.parse(message) as {
        type?: string;
        userId?: string;
        clientId?: number;
        name?: string;
        color?: string;
        openFile?: string;
      };
      if (payload.type !== "join") {
        return;
      }

      const current = (ws.deserializeAttachment() as ConnectionMeta | null) ?? {
        userId: payload.userId ?? "",
        role: "editor",
        clientId: 0,
        name: "",
        color: "#7a8cff",
      };
      const nextMeta: ConnectionMeta = {
        ...current,
        userId: current.userId || payload.userId || "",
        clientId: payload.clientId ?? current.clientId,
        name: payload.name?.trim() || current.name || "Anonymous",
        color: payload.color?.trim() || current.color || "#7a8cff",
        openFile: payload.openFile?.trim() || current.openFile,
      };
      ws.serializeAttachment(nextMeta);
      ws.send(JSON.stringify({ type: "joined", userId: nextMeta.userId }));
    } catch (error) {
      console.warn("invalid join payload", error);
      ws.send(JSON.stringify({ type: "error", message: "invalid_join_payload" }));
    }
  }

  private broadcast(message: string | ArrayBuffer | ArrayBufferView, except?: WebSocket) {
    for (const socket of this.ctx.getWebSockets()) {
      if (except && socket === except) {
        continue;
      }
      socket.send(message);
    }
  }

  private async scheduleFlush() {
    this.updateCountSinceFlush += 1;
    if (this.updateCountSinceFlush >= 50) {
      await this.flushState();
      return;
    }

    await this.ctx.storage.setAlarm(Date.now() + 30_000);
  }

  private async flushState() {
    if (this.flushPromise) {
      return this.flushPromise;
    }

    this.flushPromise = (async () => {
      const update = Y.encodeStateAsUpdate(this.yDoc);
      await this.ctx.storage.put("doc-state", toBinaryBody(update));
      this.updateCountSinceFlush = 0;
    })().finally(() => {
      this.flushPromise = null;
    });

    return this.flushPromise;
  }

  private canApplyCommentOnlyUpdate(payload: Uint8Array) {
    const before = contentValue(this.yDoc);
    const nextDoc = cloneDoc(this.yDoc);
    Y.applyUpdate(nextDoc, payload);
    return contentValue(nextDoc) === before;
  }
}
