import { useEffect, useState } from "react";
import type { Awareness } from "y-protocols/awareness";
import type * as Y from "yjs";

import type { CollabMember } from "../types";
import type { ManagedCollabDocHandle } from "../lib/collaboration/doc-manager";
import { CollabDocManager } from "../lib/collaboration/doc-manager";
import { readCollabAuthSession } from "../lib/collaboration/auth";
import { resolveCollabBaseUrls } from "../lib/collaboration/auth";
import type { FileAdapter } from "../lib/adapters";

interface UseCollaborativeDocParams {
  docPath: string;
  projectId: string | null;
  userId: string | null;
  enabled: boolean;
  manager?: CollabDocManager | null;
  fileAdapter?: FileAdapter;
}

interface CollaborativeDocState {
  yDoc: Y.Doc | null;
  yText: Y.Text | null;
  provider: ManagedCollabDocHandle["provider"] | null;
  awareness: Awareness | null;
  connected: boolean;
  synced: boolean;
  connectionError: string;
  members: CollabMember[];
}

function projectScopedManager(projectId: string, fileAdapter: FileAdapter, userId?: string | null) {
  const session = readCollabAuthSession();
  const { httpBaseUrl } = resolveCollabBaseUrls();
  if (!session || !projectId || !httpBaseUrl) {
    return null;
  }

  return new CollabDocManager({
    enabled: true,
    projectId,
    authToken: session.token,
    user: {
      userId: userId || session.userId,
      name: session.name,
      color: session.color,
    },
    fileAdapter,
    realtimeSyncEnabled: false,
  });
}

export function useCollaborativeDoc({
  docPath,
  projectId,
  userId,
  enabled,
  manager,
  fileAdapter,
}: UseCollaborativeDocParams): CollaborativeDocState {
  const [state, setState] = useState<CollaborativeDocState>({
      yDoc: null,
      yText: null,
      provider: null,
      awareness: null,
      connected: false,
      synced: false,
      connectionError: "",
      members: [],
  });

  useEffect(() => {
    if (!enabled || !projectId || !docPath) {
      setState({
        yDoc: null,
        yText: null,
        provider: null,
        awareness: null,
        connected: false,
        synced: false,
        connectionError: "",
        members: [],
      });
      return;
    }

    const resolvedManager = manager ?? (fileAdapter ? projectScopedManager(projectId, fileAdapter, userId) : null);
    if (!resolvedManager) {
      return;
    }

    let cancelled = false;
    let unsubscribe: (() => void) | undefined;

    void resolvedManager.openDoc(docPath).then((handle) => {
      if (!handle || cancelled) {
        return;
      }

      const syncState = () => {
        setState({
          yDoc: handle.yDoc,
          yText: handle.yText,
          provider: handle.provider,
          awareness: handle.awareness,
          connected: handle.connected,
          synced: handle.synced,
          connectionError: handle.connectionError,
          members: handle.members,
        });
      };

      unsubscribe = handle.subscribe(syncState);
      syncState();
    });

    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, [docPath, enabled, fileAdapter, manager, projectId, userId]);

  return state;
}
