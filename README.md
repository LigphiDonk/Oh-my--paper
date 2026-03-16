# ViewerLeaf

<p align="center">
  <img src="./icons/icon.png" alt="ViewerLeaf logo" width="160" height="160" />
</p>

<p align="center">
  A local-first desktop workbench for LaTeX writing, synchronized PDF feedback, agent workflows, and optional cloud collaboration.
</p>

English | [中文](#中文)

## English

ViewerLeaf is a macOS-first academic writing environment built for people who want source editing, compile feedback, PDF preview, AI assistance, and project operations to stay in the same workspace.

Instead of splitting LaTeX, model clients, figure tools, and collaboration links across separate apps, ViewerLeaf keeps them attached to the same project context.

### Core Capabilities

- Multi-file LaTeX workspace with project tree, recent projects, top-level workspace tabs, and file or folder creation
- CodeMirror-based source editor with outline extraction, shortcuts, and comment gutter support
- PDF preview powered by `pdf.js`, plus SyncTeX-style navigation between source and preview
- Compile pipeline with diagnostics, compile logs, local toolchain checks, and an integrated terminal panel
- Provider-aware agent workflows with configurable model endpoints, profile-based runs, patch application, and usage tracking
- Figure workflow for drafting figure briefs, generating assets, and inserting snippets back into LaTeX files
- Optional cloud collaboration with project linking, share links, role-based sync, review comments, and Worker deployment helpers

### Repository Layout

| Path | Purpose |
| --- | --- |
| `src/` | React + Vite frontend for the desktop shell, editor panes, preview panes, sidebars, and collaboration UI |
| `src-tauri/` | Rust backend for desktop commands such as file access, compile, terminal, provider, skill, sync, and agent orchestration |
| `sidecar/` | Node-based sidecar runtime that executes provider-backed agent and tool workflows |
| `workers/` | Optional Cloudflare Worker collaboration backend and deployment scripts |
| `skills/` | Built-in writing and figure skills used by the agent workflow |

### Prerequisites

- Node.js 20+
- Rust toolchain with Cargo
- `latexmk`
- `synctex`
- Optional for collaboration deployment: a Cloudflare account authenticated with Wrangler

### Local Development

Run the desktop app:

```bash
npm install
npm run tauri dev
```

Run only the frontend shell in a browser:

```bash
npm install
npm run dev
```

### Quality Checks

```bash
npm run test
npm run lint
npm run build
```

### Production Build

```bash
npm run tauri build
```

### Collaboration Notes

- The browser runtime uses a mock backend so the UI can be exercised without Tauri.
- The packaged desktop app expects a local LaTeX toolchain for compile and SyncTeX-related flows.
- In the desktop app, Worker quick deploy exports a bundled Worker template into the app data directory before installing dependencies and deploying.
- End users do not need a checked-out local `./workers` folder when deploying from the app, but they still need Node.js and a valid Wrangler login.

### macOS Install Note

GitHub Actions builds are currently unsigned and not notarized. On macOS, downloading the app from GitHub may trigger a warning such as "is damaged" or prevent the app from opening.

To remove the quarantine flag locally:

```bash
xattr -dr com.apple.quarantine /Applications/ViewerLeaf.app
```

If you are opening a downloaded DMG first, you can also remove quarantine from the DMG:

```bash
xattr -dr com.apple.quarantine /path/to/ViewerLeaf_0.1.0_aarch64.dmg
```

You may also need to open the app once from `System Settings -> Privacy & Security`.

### License

This project is licensed under the MIT License. See [LICENSE](./LICENSE).

## 中文

ViewerLeaf 是一个面向 macOS、强调本地优先的学术写作工作台，把 LaTeX 编辑、编译反馈、PDF 预览、AI 工作流和项目级操作放进同一个桌面环境里。

它的目标不是再包一层编辑器，而是减少论文写作时在源码、模型客户端、图表工具和协作入口之间来回切换的成本。

### 核心能力

- 面向多文件 LaTeX 项目的工作区壳层，包含项目树、最近项目、工作区标签和文件或文件夹创建
- 基于 CodeMirror 的源码编辑器，支持大纲提取、快捷键和评论标记
- 基于 `pdf.js` 的 PDF 预览，以及源码和预览之间的 SyncTeX 式跳转
- 编译流水线、诊断信息、编译日志、本地工具链检测和内置终端面板
- 面向多 Provider 的 Agent 工作流，支持模型端点配置、Profile 运行、补丁应用和用量统计
- 图表工作流，支持生成 figure brief、产出素材并把 LaTeX 片段插回文档
- 可选的云协作能力，包含项目关联、分享链接、角色化同步、评论面板和 Worker 部署辅助

### 仓库结构

| 路径 | 作用 |
| --- | --- |
| `src/` | React + Vite 前端，负责桌面工作区、编辑器、预览区、侧栏和协作界面 |
| `src-tauri/` | Rust 桌面后端，负责文件访问、编译、终端、Provider、技能、同步和 Agent 编排 |
| `sidecar/` | 基于 Node 的 sidecar 运行时，用来执行 Provider 驱动的 Agent 与工具调用流程 |
| `workers/` | 可选的 Cloudflare Worker 协作后端及部署脚本 |
| `skills/` | 内置写作与图表技能定义 |

### 环境要求

- Node.js 20+
- Rust toolchain 与 Cargo
- `latexmk`
- `synctex`
- 如果要部署协作服务，还需要已登录 Wrangler 的 Cloudflare 账号

### 本地开发

启动桌面应用：

```bash
npm install
npm run tauri dev
```

只启动浏览器里的前端壳层：

```bash
npm install
npm run dev
```

### 质量检查

```bash
npm run test
npm run lint
npm run build
```

### 构建

```bash
npm run tauri build
```

### 协作相关说明

- 浏览器运行模式使用 mock backend，因此不依赖 Tauri 也可以检查界面流程。
- 打包后的桌面应用依赖本地 LaTeX 工具链来完成编译与 SyncTeX 相关功能。
- 桌面版里的 Worker 快捷部署会先把内置 Worker 模板释放到应用数据目录，再安装依赖并执行部署。
- 终端用户从应用里部署时不需要项目仓库中的 `./workers` 文件夹，但仍然需要本机有 Node.js，并且已经通过 Wrangler 登录 Cloudflare。

### macOS 安装说明

当前 GitHub Actions 构建产物还没有做 Apple 签名和公证。在 macOS 上直接从 GitHub 下载时，系统可能提示“已损坏”或阻止应用打开。

可以在本地移除 quarantine 标记：

```bash
xattr -dr com.apple.quarantine /Applications/ViewerLeaf.app
```

如果你是先下载 `.dmg` 再安装，也可以先对 DMG 执行：

```bash
xattr -dr com.apple.quarantine /path/to/ViewerLeaf_0.1.0_aarch64.dmg
```

必要时还可以到“系统设置 -> 隐私与安全性”中手动允许打开一次。

### 许可证

本项目采用 MIT 许可证，见 [LICENSE](./LICENSE)。
