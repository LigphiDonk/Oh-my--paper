import type {
  AssetResource,
  CollabMember,
  CompileEnvironmentStatus,
  CompileResult,
  ProjectConfig,
  ProjectFile,
  SyncLocation,
  WorkspaceSnapshot,
} from "../../types";

export interface FileAdapter {
  readFile(path: string): Promise<ProjectFile>;
  saveFile(path: string, content: string): Promise<void>;
  readAsset(path: string): Promise<AssetResource>;
  readPdfBinary(absolutePath: string): Promise<Uint8Array | null>;
  createFile(path: string, content?: string): Promise<void>;
  createFolder(path: string): Promise<void>;
  deleteFile(path: string): Promise<void>;
  renameFile(oldPath: string, newPath: string): Promise<void>;
}

export interface ProjectAdapter extends FileAdapter {
  openProject(): Promise<WorkspaceSnapshot>;
  switchProject(rootPath: string): Promise<WorkspaceSnapshot>;
  createProject(parentDir: string, name: string): Promise<WorkspaceSnapshot>;
  updateProjectConfig(config: ProjectConfig): Promise<ProjectConfig>;
}

export interface CompileAdapter {
  compileProject(filePath: string): Promise<CompileResult>;
  getCompileEnvironment(): Promise<CompileEnvironmentStatus>;
  forwardSearch(filePath: string, line: number, column?: number): Promise<SyncLocation>;
  reverseSearch(page: number, h?: number, v?: number): Promise<SyncLocation>;
}

export interface CollabDocHandle {
  path: string;
  destroy(): void;
}

export interface CollabAdapter {
  connectDoc(docPath: string): Promise<CollabDocHandle>;
  disconnectDoc(docPath: string): Promise<void>;
}

export interface CloudProjectAdapter {
  createProject(name: string, rootMainFile?: string): Promise<{ projectId: string }>;
  listProjects(): Promise<Array<{ id: string; name: string }>>;
  listProjectMembers(projectId: string): Promise<CollabMember[]>;
}
