import { beforeEach, describe, expect, it, vi } from "vitest";
import * as Y from "yjs";

const shared = vi.hoisted(() => {
  const providerInstances: Array<{
    sendDocumentUpdate: ReturnType<typeof vi.fn>;
  }> = [];

  class MockProvider {
    readonly sendDocumentUpdate = vi.fn(() => true);
    private readonly listeners = new Map<string, Set<() => void>>();

    constructor() {
      providerInstances.push(this);
    }

    on(event: string, callback: () => void) {
      const set = this.listeners.get(event) ?? new Set();
      set.add(callback);
      this.listeners.set(event, set);
    }

    off(event: string, callback: () => void) {
      this.listeners.get(event)?.delete(callback);
    }

    connect() {
      this.listeners.get("sync")?.forEach((listener) => listener());
    }

    destroy() {}
  }

  return {
    ensureCloudDocument: vi.fn(async () => undefined),
    fetchDocumentSnapshot: vi.fn(async () => new Uint8Array([0, 0])),
    listCloudDocuments: vi.fn(async () => [] as Array<{
      id: string;
      projectId: string;
      path: string;
      kind: "text" | "tex" | "bib";
      latestVersion: number;
      updatedAt: string;
    }>),
    providerInstances,
    MockProvider,
  };
});

vi.mock("./cloud-api", () => ({
  ensureCloudDocument: shared.ensureCloudDocument,
  fetchDocumentSnapshot: shared.fetchDocumentSnapshot,
  listCloudDocuments: shared.listCloudDocuments,
  uploadDocumentSnapshot: vi.fn(async () => 1),
}));

vi.mock("./auth", () => ({
  buildCollabWebSocketUrl: () => "ws://localhost:8787/api/projects/project-1/ws?path=main.tex",
}));

vi.mock("./yjs-provider", () => ({
  ViewerLeafProvider: shared.MockProvider,
}));

import { CollabDocManager, seedCollabSyncBaseline } from "./doc-manager";

describe("CollabDocManager", () => {
  beforeEach(() => {
    shared.ensureCloudDocument.mockClear();
    shared.fetchDocumentSnapshot.mockClear();
    shared.listCloudDocuments.mockClear();
    shared.providerInstances.splice(0, shared.providerInstances.length);
  });

  it("keeps local file content when the remote snapshot is still empty", async () => {
    const fileAdapter = {
      readFile: vi.fn(async () => ({
        path: "main.tex",
        language: "latex",
        content: "\\section{Intro}\nHello",
      })),
      saveFile: vi.fn(async () => undefined),
      readAsset: vi.fn(),
      readPdfBinary: vi.fn(async () => null),
      createFile: vi.fn(async () => undefined),
      createFolder: vi.fn(async () => undefined),
      deleteFile: vi.fn(async () => undefined),
      renameFile: vi.fn(async () => undefined),
    };

    const manager = new CollabDocManager({
      enabled: true,
      projectId: "project-1",
      authToken: "token",
      user: {
        userId: "user-1",
        name: "donk",
        color: "#4f8cff",
      },
      fileAdapter,
    });

    const handle = await manager.openDoc("main.tex");
    expect(handle?.yText.toString()).toBe("\\section{Intro}\nHello");

    expect(shared.providerInstances).toHaveLength(1);
    expect(shared.providerInstances[0].sendDocumentUpdate).toHaveBeenCalledTimes(1);

    const seededCalls = shared.providerInstances[0].sendDocumentUpdate.mock.calls as unknown as Array<[Uint8Array]>;
    const seededUpdate = seededCalls[0]?.[0];
    expect(seededUpdate).toBeInstanceOf(Uint8Array);
    if (!seededUpdate) {
      throw new Error("expected seeded update to be sent");
    }

    const seededDoc = new Y.Doc();
    Y.applyUpdate(seededDoc, seededUpdate);
    expect(seededDoc.getText("content").toString()).toBe("\\section{Intro}\nHello");
  });

  it("caches remote document summaries between local sync state refreshes", async () => {
    shared.listCloudDocuments.mockResolvedValue([
      {
        id: "doc-1",
        projectId: "project-1",
        path: "main.tex",
        kind: "text",
        latestVersion: 3,
        updatedAt: "2026-03-16T00:00:00.000Z",
      },
    ]);

    const fileAdapter = {
      readFile: vi.fn(async () => {
        throw new Error("missing");
      }),
      saveFile: vi.fn(async () => undefined),
      readAsset: vi.fn(),
      readPdfBinary: vi.fn(async () => null),
      createFile: vi.fn(async () => undefined),
      createFolder: vi.fn(async () => undefined),
      deleteFile: vi.fn(async () => undefined),
      renameFile: vi.fn(async () => undefined),
    };

    const manager = new CollabDocManager({
      enabled: true,
      projectId: "project-1",
      authToken: "token",
      user: {
        userId: "user-1",
        name: "donk",
        color: "#4f8cff",
      },
      fileAdapter,
      realtimeSyncEnabled: false,
    });

    const snapshot = {
      tree: [
        {
          id: "file-main",
          name: "main.tex",
          path: "main.tex",
          kind: "file",
          isText: true,
          fileType: "latex",
        },
      ],
    } as const;

    const first = await manager.getWorkspaceSyncSummary(snapshot as never);
    const second = await manager.getWorkspaceSyncSummary(snapshot as never);

    expect(first.byPath["main.tex"]).toBe("pending-pull");
    expect(second.byPath["main.tex"]).toBe("pending-pull");
    expect(shared.listCloudDocuments).toHaveBeenCalledTimes(1);
  });

  it("treats a brand-new cloud file as pending push until a baseline exists", async () => {
    shared.listCloudDocuments.mockResolvedValue([
      {
        id: "doc-1",
        projectId: "project-1",
        path: "main.tex",
        kind: "text",
        latestVersion: 0,
        updatedAt: "2026-03-16T00:00:00.000Z",
      },
    ]);

    const fileAdapter = {
      readFile: vi.fn(async () => {
        throw new Error("missing");
      }),
      saveFile: vi.fn(async () => undefined),
      readAsset: vi.fn(),
      readPdfBinary: vi.fn(async () => null),
      createFile: vi.fn(async () => undefined),
      createFolder: vi.fn(async () => undefined),
      deleteFile: vi.fn(async () => undefined),
      renameFile: vi.fn(async () => undefined),
    };

    const manager = new CollabDocManager({
      enabled: true,
      projectId: "project-1",
      authToken: "token",
      user: {
        userId: "user-1",
        name: "donk",
        color: "#4f8cff",
      },
      fileAdapter,
      realtimeSyncEnabled: false,
    });

    const snapshot = {
      tree: [
        {
          id: "file-main",
          name: "main.tex",
          path: "main.tex",
          kind: "file",
          isText: true,
          fileType: "latex",
        },
      ],
    } as const;

    const summary = await manager.getWorkspaceSyncSummary(snapshot as never);

    expect(summary.byPath["main.tex"]).toBe("pending-push");
  });

  it("marks bootstrapped cloud files as synced after seeding the baseline", async () => {
    const memory = new Map<string, string>();
    const fileAdapter = {
      readFile: vi.fn(async (path: string) => {
        const content = memory.get(path);
        if (content === undefined) {
          throw new Error("missing");
        }
        return {
          path,
          language: "json",
          content,
        };
      }),
      saveFile: vi.fn(async (path: string, content: string) => {
        memory.set(path, content);
      }),
      readAsset: vi.fn(),
      readPdfBinary: vi.fn(async () => null),
      createFile: vi.fn(async () => undefined),
      createFolder: vi.fn(async () => undefined),
      deleteFile: vi.fn(async () => undefined),
      renameFile: vi.fn(async () => undefined),
    };

    shared.listCloudDocuments.mockResolvedValue([
      {
        id: "doc-1",
        projectId: "project-1",
        path: "main.tex",
        kind: "text",
        latestVersion: 0,
        updatedAt: "2026-03-16T00:00:00.000Z",
      },
    ]);

    await seedCollabSyncBaseline(fileAdapter as never, "project-1", await shared.listCloudDocuments());

    const manager = new CollabDocManager({
      enabled: true,
      projectId: "project-1",
      authToken: "token",
      user: {
        userId: "user-1",
        name: "donk",
        color: "#4f8cff",
      },
      fileAdapter: fileAdapter as never,
      realtimeSyncEnabled: false,
    });

    const snapshot = {
      tree: [
        {
          id: "file-main",
          name: "main.tex",
          path: "main.tex",
          kind: "file",
          isText: true,
          fileType: "latex",
        },
      ],
    } as const;

    const summary = await manager.getWorkspaceSyncSummary(snapshot as never);

    expect(summary.byPath["main.tex"]).toBe("synced");
  });
});
