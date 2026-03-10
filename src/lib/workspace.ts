import type { ProjectFileType, ProjectNode } from "../types";

const TEXT_FILE_TYPES = new Set<ProjectFileType>([
  "latex",
  "bib",
  "json",
  "markdown",
  "text",
  "yaml",
  "xml",
  "csv",
]);

const PREVIEWABLE_FILE_TYPES = new Set<ProjectFileType>(["pdf", "image"]);

export function detectProjectFileType(path: string): ProjectFileType {
  const extension = path.split(".").pop()?.toLowerCase() ?? "";

  if (["tex", "sty", "cls"].includes(extension)) {
    return "latex";
  }
  if (extension === "bib") {
    return "bib";
  }
  if (extension === "json") {
    return "json";
  }
  if (extension === "md") {
    return "markdown";
  }
  if (["txt", "log"].includes(extension)) {
    return "text";
  }
  if (["yaml", "yml"].includes(extension)) {
    return "yaml";
  }
  if (extension === "xml") {
    return "xml";
  }
  if (extension === "csv") {
    return "csv";
  }
  if (extension === "pdf") {
    return "pdf";
  }
  if (["png", "jpg", "jpeg", "svg", "gif", "webp"].includes(extension)) {
    return "image";
  }
  return "unsupported";
}

export function isTextFileType(fileType?: ProjectFileType): boolean {
  return fileType ? TEXT_FILE_TYPES.has(fileType) : false;
}

export function isPreviewableFileType(fileType?: ProjectFileType): boolean {
  return fileType ? PREVIEWABLE_FILE_TYPES.has(fileType) : false;
}

export function mimeTypeForPath(path: string): string {
  const extension = path.split(".").pop()?.toLowerCase() ?? "";
  switch (extension) {
    case "pdf":
      return "application/pdf";
    case "png":
      return "image/png";
    case "jpg":
    case "jpeg":
      return "image/jpeg";
    case "svg":
      return "image/svg+xml";
    case "gif":
      return "image/gif";
    case "webp":
      return "image/webp";
    case "json":
      return "application/json";
    case "md":
      return "text/markdown";
    case "yaml":
    case "yml":
      return "application/yaml";
    case "xml":
      return "application/xml";
    case "csv":
      return "text/csv";
    case "bib":
      return "text/x-bibtex";
    case "tex":
    case "sty":
    case "cls":
      return "text/x-tex";
    default:
      return "text/plain";
  }
}

export function getNodeByPath(nodes: ProjectNode[], path: string): ProjectNode | null {
  for (const node of nodes) {
    if (node.path === path) {
      return node;
    }
    if (node.children) {
      const child = getNodeByPath(node.children, path);
      if (child) {
        return child;
      }
    }
  }
  return null;
}

export function findFirstTextPath(nodes: ProjectNode[]): string {
  for (const node of nodes) {
    if (node.kind !== "directory" && node.isText) {
      return node.path;
    }
    if (node.children) {
      const childPath = findFirstTextPath(node.children);
      if (childPath) {
        return childPath;
      }
    }
  }
  return "";
}

export function closeTextTab(openTabs: string[], activePath: string, closingPath: string) {
  const nextTabs = openTabs.filter((item) => item !== closingPath);
  if (activePath !== closingPath) {
    return {
      openTabs: nextTabs,
      activePath,
    };
  }

  const closingIndex = openTabs.indexOf(closingPath);
  const fallbackPath =
    nextTabs[Math.min(closingIndex, nextTabs.length - 1)] ??
    nextTabs[nextTabs.length - 1] ??
    "";

  return {
    openTabs: nextTabs,
    activePath: fallbackPath,
  };
}
