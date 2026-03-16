import { desktop } from "../desktop";
import type { CompileAdapter, ProjectAdapter } from "./types";

export class LocalDesktopAdapter implements ProjectAdapter, CompileAdapter {
  openProject() {
    return desktop.openProject();
  }

  switchProject(rootPath: string) {
    return desktop.switchProject(rootPath);
  }

  createProject(parentDir: string, name: string) {
    return desktop.createProject(parentDir, name);
  }

  updateProjectConfig(config: Parameters<typeof desktop.updateProjectConfig>[0]) {
    return desktop.updateProjectConfig(config);
  }

  readFile(path: string) {
    return desktop.readFile(path);
  }

  saveFile(path: string, content: string) {
    return desktop.saveFile(path, content).then(() => undefined);
  }

  readAsset(path: string) {
    return desktop.readAsset(path);
  }

  readPdfBinary(absolutePath: string) {
    return desktop.readPdfBinary(absolutePath);
  }

  createFile(path: string, content = "") {
    return desktop.createFile(path, content).then(() => undefined);
  }

  createFolder(path: string) {
    return desktop.createFolder(path).then(() => undefined);
  }

  deleteFile(path: string) {
    return desktop.deleteFile(path).then(() => undefined);
  }

  renameFile(oldPath: string, newPath: string) {
    return desktop.renameFile(oldPath, newPath).then(() => undefined);
  }

  compileProject(filePath: string) {
    return desktop.compileProject(filePath);
  }

  getCompileEnvironment() {
    return desktop.getCompileEnvironment();
  }

  forwardSearch(filePath: string, line: number, column?: number) {
    return desktop.forwardSearch(filePath, line, column);
  }

  reverseSearch(page: number, h?: number, v?: number) {
    return desktop.reverseSearch(page, h, v);
  }
}
