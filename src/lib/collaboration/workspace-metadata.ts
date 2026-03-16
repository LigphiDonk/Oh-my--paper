import type { FileAdapter } from "../adapters";
import type { WorkspaceCollabMetadata } from "../../types";

const WORKSPACE_COLLAB_METADATA_PATH = ".viewerleaf/collab.json";

export async function readWorkspaceCollabMetadata(fileAdapter: FileAdapter): Promise<WorkspaceCollabMetadata | null> {
  try {
    const file = await fileAdapter.readFile(WORKSPACE_COLLAB_METADATA_PATH);
    const parsed = JSON.parse(file.content) as Partial<WorkspaceCollabMetadata>;
    if (!parsed || typeof parsed !== "object") {
      return null;
    }
    return {
      mode: parsed.mode === "cloud" ? "cloud" : "local",
      cloudProjectId: typeof parsed.cloudProjectId === "string" && parsed.cloudProjectId ? parsed.cloudProjectId : null,
      checkoutRoot: typeof parsed.checkoutRoot === "string" ? parsed.checkoutRoot : "",
      linkedAt: typeof parsed.linkedAt === "string" ? parsed.linkedAt : "",
    };
  } catch {
    return null;
  }
}

export async function writeWorkspaceCollabMetadata(
  fileAdapter: FileAdapter,
  metadata: WorkspaceCollabMetadata,
) {
  try {
    await fileAdapter.createFolder(".viewerleaf");
  } catch {
    // The metadata folder may already exist.
  }
  await fileAdapter.saveFile(WORKSPACE_COLLAB_METADATA_PATH, JSON.stringify(metadata, null, 2));
}

export async function clearWorkspaceCollabMetadata(fileAdapter: FileAdapter) {
  try {
    await fileAdapter.deleteFile(WORKSPACE_COLLAB_METADATA_PATH);
  } catch {
    // The metadata file may already be missing.
  }
}
