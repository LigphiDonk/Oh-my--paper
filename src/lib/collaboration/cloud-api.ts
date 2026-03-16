import type { CloudDocumentSummary, CloudProjectSummary } from "../../types";
import { resolveCollabBaseUrls } from "./auth";

function authHeaders(token: string) {
  return {
    authorization: `Bearer ${token}`,
  };
}

async function parseJson<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `request failed: ${response.status}`);
  }
  return response.json() as Promise<T>;
}

export async function listCloudProjects(token: string): Promise<CloudProjectSummary[]> {
  const { httpBaseUrl } = resolveCollabBaseUrls();
  const response = await fetch(`${httpBaseUrl}/api/projects`, {
    headers: authHeaders(token),
  });
  const payload = await parseJson<{ projects: CloudProjectSummary[] }>(response);
  return payload.projects;
}

export async function createCloudProject(token: string, name: string, rootMainFile = "main.tex") {
  const { httpBaseUrl } = resolveCollabBaseUrls();
  const response = await fetch(`${httpBaseUrl}/api/projects`, {
    method: "POST",
    headers: {
      ...authHeaders(token),
      "content-type": "application/json",
    },
    body: JSON.stringify({ name, rootMainFile }),
  });
  return parseJson<{ projectId: string; name: string; rootMainFile: string }>(response);
}

export async function getCloudProject(token: string, projectId: string): Promise<CloudProjectSummary> {
  const { httpBaseUrl } = resolveCollabBaseUrls();
  const response = await fetch(`${httpBaseUrl}/api/projects/${projectId}`, {
    headers: authHeaders(token),
  });
  const payload = await parseJson<{
    project: Omit<CloudProjectSummary, "role">;
    role: CloudProjectSummary["role"];
  }>(response);
  return {
    ...payload.project,
    role: payload.role,
  };
}

export async function listCloudDocuments(token: string, projectId: string): Promise<CloudDocumentSummary[]> {
  const { httpBaseUrl } = resolveCollabBaseUrls();
  const response = await fetch(`${httpBaseUrl}/api/projects/${projectId}/documents`, {
    headers: authHeaders(token),
  });
  const payload = await parseJson<{ documents: CloudDocumentSummary[] }>(response);
  return payload.documents;
}

export async function ensureCloudDocument(token: string, projectId: string, path: string) {
  const { httpBaseUrl } = resolveCollabBaseUrls();
  const response = await fetch(`${httpBaseUrl}/api/projects/${projectId}/documents`, {
    method: "POST",
    headers: {
      ...authHeaders(token),
      "content-type": "application/json",
    },
    body: JSON.stringify({ path }),
  });
  await parseJson<{ ok: boolean }>(response);
}

export async function fetchDocumentSnapshot(token: string, projectId: string, path: string) {
  const { httpBaseUrl } = resolveCollabBaseUrls();
  const url = new URL(`${httpBaseUrl}/api/projects/${projectId}/documents/snapshot`);
  url.searchParams.set("path", path);
  const response = await fetch(url.toString(), {
    headers: authHeaders(token),
  });
  if (!response.ok) {
    throw new Error(await response.text());
  }
  return new Uint8Array(await response.arrayBuffer());
}

export async function uploadDocumentSnapshot(token: string, projectId: string, path: string, update: Uint8Array) {
  const { httpBaseUrl } = resolveCollabBaseUrls();
  const url = new URL(`${httpBaseUrl}/api/projects/${projectId}/documents/snapshot`);
  url.searchParams.set("path", path);
  const bodyBytes = Uint8Array.from(update);
  const response = await fetch(url.toString(), {
    method: "POST",
    headers: {
      ...authHeaders(token),
      "content-type": "application/octet-stream",
    },
    body: new Blob([bodyBytes.buffer], { type: "application/octet-stream" }),
  });
  const payload = await parseJson<{ ok: boolean; latestVersion: number }>(response);
  return payload.latestVersion;
}

export async function joinCloudProject(
  token: string,
  projectId: string,
  role?: CloudProjectSummary["role"],
) {
  const { httpBaseUrl } = resolveCollabBaseUrls();
  const response = await fetch(`${httpBaseUrl}/api/projects/${projectId}/join`, {
    method: "POST",
    headers: {
      ...authHeaders(token),
      "content-type": "application/json",
    },
    body: JSON.stringify(role ? { role } : {}),
  });
  return parseJson<{ ok: boolean; role: CloudProjectSummary["role"] }>(response);
}
