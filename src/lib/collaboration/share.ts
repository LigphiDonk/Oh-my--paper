import type { CloudProjectRole } from "../../types";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export interface ProjectReference {
  projectId: string;
  httpBaseUrl?: string;
  wsBaseUrl?: string;
  role?: CloudProjectRole;
}

function deriveWsBaseUrl(httpBaseUrl: string) {
  const url = new URL(httpBaseUrl);
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  return url.toString().replace(/\/$/, "");
}

function parseRole(value: string | null | undefined): CloudProjectRole | undefined {
  if (value === "viewer" || value === "commenter" || value === "editor" || value === "owner") {
    return value;
  }
  return undefined;
}

export function generateShareLink(projectId: string, httpBaseUrl: string, role: CloudProjectRole = "viewer"): string {
  const url = new URL(`/join/${projectId}`, httpBaseUrl);
  url.searchParams.set("role", role);
  return url.toString();
}

export function parseShareLink(link: string): ProjectReference | null {
  try {
    const url = new URL(link);
    const match = url.pathname.match(/^\/join\/([^/]+)\/?$/i);
    const projectId = match?.[1]?.trim();
    if (!projectId || !UUID_PATTERN.test(projectId)) {
      return null;
    }
    const httpBaseUrl = url.origin.replace(/\/$/, "");
    return {
      projectId,
      httpBaseUrl,
      wsBaseUrl: deriveWsBaseUrl(httpBaseUrl),
      role: parseRole(url.searchParams.get("role")),
    };
  } catch {
    return null;
  }
}

export function parseProjectReference(value: string): ProjectReference | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const shared = parseShareLink(trimmed);
  if (shared) {
    return shared;
  }

  if (!UUID_PATTERN.test(trimmed)) {
    return null;
  }

  return { projectId: trimmed };
}
