import clsx from "clsx";
import { useState } from "react";

import { ChatPanel } from "./ChatPanel";
import { ProviderCard, ProviderEditModal } from "./ProviderCard";
import type {
  AgentMessage,
  AgentProfile,
  CompileEnvironmentStatus,
  DrawerTab,
  FigureBriefDraft,
  GeneratedAsset,
  LatexEngine,
  ProjectConfig,
  ProviderConfig,
  SkillManifest,
  TestResult,
  UsageRecord,
} from "../types";

interface SidebarProps {
  tab: DrawerTab;
  messages: AgentMessage[];
  profiles: AgentProfile[];
  activeProfileId: string;
  onSelectProfile: (profileId: string) => void;
  onRunAgent: () => void;
  pendingPatchSummary?: string;
  onApplyPatch: () => void;
  compileStatus: string;
  compileLog: string;
  projectConfig: ProjectConfig;
  compileEnvironment: CompileEnvironmentStatus | null;
  isCheckingCompileEnvironment: boolean;
  onRefreshCompileEnvironment: () => void;
  onSetCompileEngine: (engine: LatexEngine) => void;
  onSetAutoCompile: (enabled: boolean) => void;
  diagnosticsCount: number;
  briefs: FigureBriefDraft[];
  assets: GeneratedAsset[];
  selectedBriefId?: string;
  selectedAssetId?: string;
  onCreateBrief: () => void;
  onRunFigureSkill: () => void;
  onGenerateFigure: () => void;
  onInsertFigure: () => void;
  onSelectBrief: (briefId: string) => void;
  onSelectAsset: (assetId: string) => void;
  providers: ProviderConfig[];
  activeProviderId?: string;
  skills: SkillManifest[];
  usageRecords: UsageRecord[];
  onAddProvider: (provider: ProviderConfig) => Promise<void>;
  onUpdateProvider: (providerId: string, patch: Partial<ProviderConfig>) => Promise<void>;
  onDeleteProvider: (providerId: string) => Promise<void>;
  onTestProvider: (providerId: string) => Promise<TestResult>;
  onActivateProvider: (providerId: string) => void;
  onToggleSkill: (skill: SkillManifest) => Promise<void>;
  streamText?: string;
  isStreaming?: boolean;
  onSendMessage: (text: string) => void;
  onDismissPatch: () => void;
}

function skillEnabled(skill: SkillManifest) {
  return skill.isEnabled ?? skill.enabled ?? false;
}

const LATEX_ENGINES: LatexEngine[] = ["xelatex", "pdflatex", "lualatex"];
const LATEX_ENGINE_LABELS: Record<LatexEngine, string> = {
  xelatex: "XeLaTeX",
  pdflatex: "pdfLaTeX",
  lualatex: "LuaLaTeX",
};

export function Sidebar({
  tab,
  messages,
  profiles,
  activeProfileId,
  onSelectProfile,
  onRunAgent,
  pendingPatchSummary,
  onApplyPatch,
  compileStatus,
  compileLog,
  projectConfig,
  compileEnvironment,
  isCheckingCompileEnvironment,
  onRefreshCompileEnvironment,
  onSetCompileEngine,
  onSetAutoCompile,
  diagnosticsCount,
  briefs,
  assets,
  selectedBriefId,
  selectedAssetId,
  onCreateBrief,
  onRunFigureSkill,
  onGenerateFigure,
  onInsertFigure,
  onSelectBrief,
  onSelectAsset,
  providers,
  activeProviderId,
  skills,
  usageRecords,
  onAddProvider,
  onUpdateProvider,
  onDeleteProvider,
  onTestProvider,
  onActivateProvider,
  onToggleSkill,
  streamText,
  isStreaming,
  onSendMessage,
  onDismissPatch,
}: SidebarProps) {
  // Provider form state (blank by default — no presets)
  const [providerForm, setProviderForm] = useState({
    name: "",
    baseUrl: "",
    apiKey: "",
    defaultModel: "",
    vendor: "custom" as string,
  });
  const [providerActionState, setProviderActionState] = useState<Record<string, string>>({});
  const [isSubmittingProvider, setIsSubmittingProvider] = useState(false);
  const [editingProviderId, setEditingProviderId] = useState<string | null>(null);
  const availableEngineSet = new Set<LatexEngine>(compileEnvironment?.availableEngines ?? []);
  const selectedEngineAvailable = availableEngineSet.has(projectConfig.engine as LatexEngine);

  const totalInputTokens = usageRecords.reduce((sum, item) => sum + item.inputTokens, 0);
  const totalOutputTokens = usageRecords.reduce((sum, item) => sum + item.outputTokens, 0);

  async function handleAddProvider() {
    if (!providerForm.name.trim() || !providerForm.baseUrl.trim() || !providerForm.defaultModel.trim()) return;
    setIsSubmittingProvider(true);
    try {
      await onAddProvider({
        id: `custom-${Date.now()}`,
        name: providerForm.name.trim(),
        vendor: "custom",
        baseUrl: providerForm.baseUrl.trim(),
        apiKey: providerForm.apiKey,
        defaultModel: providerForm.defaultModel.trim(),
        isEnabled: true,
        sortOrder: providers.length,
        metaJson: "{}",
      });
      setProviderForm({ name: "", baseUrl: "", apiKey: "", defaultModel: "", vendor: "custom" });
    } finally {
      setIsSubmittingProvider(false);
    }
  }

  async function handleTestProvider(providerId: string) {
    setProviderActionState((current) => ({ ...current, [providerId]: "测试中..." }));
    try {
      const result = await onTestProvider(providerId);
      setProviderActionState((current) => ({
        ...current,
        [providerId]: result.success
          ? `连接正常 · ${result.latencyMs}ms`
          : `失败: ${result.error ?? "unknown error"}`,
      }));
    } catch (error) {
      setProviderActionState((current) => ({
        ...current,
        [providerId]: error instanceof Error ? error.message : String(error),
      }));
    }
  }

  return (
    <div className="primary-sidebar">
      {tab === "latex" && (
        <>
          <div className="sidebar-header">LaTeX 编译</div>
          <div className="sidebar-content sidebar-stack">
            <div className="card latex-status-card">
              <div className="latex-status-header">
                <div>
                  <div className="card-header" style={{ marginBottom: 4 }}>本地编译环境</div>
                  <div className="text-subtle text-xs">
                    打开这个面板时会重新检查 `latexmk`、`synctex` 和可用引擎。
                  </div>
                </div>
                <button className="btn-secondary" type="button" onClick={onRefreshCompileEnvironment}>
                  {isCheckingCompileEnvironment ? "检查中..." : "重新检测"}
                </button>
              </div>

              <div className="latex-tool-pills">
                <span className={clsx("latex-tool-pill", compileEnvironment?.latexmkAvailable ? "ready" : "missing")}>
                  latexmk
                </span>
                <span className={clsx("latex-tool-pill", compileEnvironment?.synctexAvailable ? "ready" : "missing")}>
                  synctex
                </span>
                {LATEX_ENGINES.map((engine) => (
                  <span
                    key={engine}
                    className={clsx("latex-tool-pill", availableEngineSet.has(engine) ? "ready" : "missing")}
                  >
                    {LATEX_ENGINE_LABELS[engine]}
                  </span>
                ))}
              </div>
            </div>

            {(isCheckingCompileEnvironment && !compileEnvironment) || !compileEnvironment ? (
              <div className="card">
                <div className="sidebar-empty-state">正在检查本地 TeX 工具链…</div>
              </div>
            ) : !compileEnvironment.ready ? (
              <div className="card latex-setup-card">
                <div className="card-header">还没检测到完整的本地编译资源</div>
                <div className="text-subtle text-xs">
                  缺少: {compileEnvironment.missingTools.join(" / ") || "latexmk / synctex / engine"}
                </div>
                <ol className="latex-guide-list">
                  <li>先安装一个本地 TeX 发行版。macOS 上优先用 MacTeX，轻量方案可选 TinyTeX。</li>
                  <li>安装完成后，在终端确认 `latexmk -v`、`xelatex --version`、`synctex` 至少能执行。</li>
                  <li>如果是刚安装完，再重启一次 ViewerLeaf，然后回到这里点“重新检测”。</li>
                </ol>
                <pre className="latex-code-block">{`# 完整方案（推荐）
brew install --cask mactex-no-gui

# 轻量方案
curl -sL "https://yihui.org/tinytex/install-bin-unix.sh" | sh`}</pre>
              </div>
            ) : (
              <>
                <div className="card">
                  <div className="card-header">项目编译选项</div>
                  <label className="latex-toggle-row">
                    <div>
                      <div className="latex-row-title">自动编译</div>
                      <div className="text-subtle text-xs">保存当前文件后自动触发本地编译。</div>
                    </div>
                    <input
                      type="checkbox"
                      checked={projectConfig.autoCompile}
                      onChange={(event) => onSetAutoCompile(event.target.checked)}
                    />
                  </label>

                  <div className="sidebar-section-title" style={{ marginTop: 16 }}>编译引擎</div>
                  <div className="latex-engine-grid">
                    {LATEX_ENGINES.map((engine) => {
                      const available = availableEngineSet.has(engine);
                      const active = projectConfig.engine === engine;
                      return (
                        <button
                          key={engine}
                          type="button"
                          className={clsx(
                            "latex-engine-option",
                            active && "is-active",
                            !available && "is-unavailable",
                          )}
                          disabled={!available}
                          onClick={() => onSetCompileEngine(engine)}
                        >
                          <span>{LATEX_ENGINE_LABELS[engine]}</span>
                          <span className="text-subtle text-xs">{available ? "已检测到" : "未检测到"}</span>
                        </button>
                      );
                    })}
                  </div>

                  {!selectedEngineAvailable && (
                    <div className="latex-warning-note">
                      当前项目配置为 {LATEX_ENGINE_LABELS[projectConfig.engine as LatexEngine] ?? projectConfig.engine}，
                      但本机没有检测到这个引擎。先切到可用引擎，再手动编译。
                    </div>
                  )}
                </div>

                <div className="card">
                  <div className="card-header">当前状态</div>
                  <div className="latex-inline-meta">
                    <span
                      className={clsx(
                        "status-badge",
                        compileStatus === "running" ? "running" : diagnosticsCount > 0 ? "failed" : "success",
                      )}
                    >
                      {compileStatus === "success"
                        ? "最近一次编译成功"
                        : compileStatus === "failed"
                          ? "最近一次编译失败"
                          : compileStatus === "running"
                            ? "正在编译"
                            : "等待编译"}
                    </span>
                    <span className="text-subtle text-xs">诊断 {diagnosticsCount} 项</span>
                  </div>
                </div>
              </>
            )}
          </div>
        </>
      )}

      {tab === "ai" && (
        <>
          <div className="sidebar-header">AI 智能体助手</div>
          <div className="sidebar-content" style={{ padding: 0, display: "flex", flexDirection: "column", overflow: "hidden" }}>
            <ChatPanel
              messages={messages}
              profiles={profiles}
              activeProfileId={activeProfileId}
              onSelectProfile={onSelectProfile}
              onRunAgent={onRunAgent}
              onSendMessage={onSendMessage}
              pendingPatchSummary={pendingPatchSummary}
              onApplyPatch={onApplyPatch}
              onDismissPatch={onDismissPatch}
              streamText={streamText}
              isStreaming={isStreaming}
              skills={skills}
              onToggleSkill={onToggleSkill}
              usageRecords={usageRecords}
            />
          </div>
        </>
      )}

      {tab === "figures" && (
        <>
          <div className="sidebar-header">图表生成</div>
          <div className="sidebar-content sidebar-stack">
            <div className="card">
              <div className="card-header">操作面板</div>
              <div className="sidebar-grid-actions">
                <button className="btn-primary" onClick={onCreateBrief}>新建概要</button>
                <button className="btn-secondary" disabled={!selectedBriefId} onClick={onRunFigureSkill}>预处理</button>
                <button className="btn-secondary" disabled={!selectedBriefId} onClick={onGenerateFigure}>生成图像</button>
                <button className="btn-secondary" disabled={!selectedAssetId} onClick={onInsertFigure}>插入文档</button>
              </div>
            </div>

            <div>
              <div className="sidebar-section-title">图表概要</div>
              <div className="sidebar-stack-compact">
                {briefs.map((brief) => (
                  <button
                    key={brief.id}
                    className={clsx("card", "sidebar-compact-card", selectedBriefId === brief.id && "sidebar-card-active")}
                    type="button"
                    onClick={() => onSelectBrief(brief.id)}
                  >
                    <div style={{ fontWeight: 500, fontSize: "12px", color: "var(--text-primary)" }}>
                      {brief.sourceSectionRef || "未命名节点"}
                    </div>
                    <div className="text-subtle text-xs">状态: {brief.status}</div>
                  </button>
                ))}
                {briefs.length === 0 && <div className="sidebar-empty-state">暂无概要</div>}
              </div>
            </div>

            <div>
              <div className="sidebar-section-title">已生成资源</div>
              <div className="sidebar-stack-compact">
                {assets.map((asset) => (
                  <button
                    key={asset.id}
                    className={clsx("card", "sidebar-compact-card", selectedAssetId === asset.id && "sidebar-card-active")}
                    type="button"
                    onClick={() => onSelectAsset(asset.id)}
                  >
                    <img
                      alt={asset.filePath}
                      src={asset.previewUri}
                      style={{ width: "100%", borderRadius: "var(--radius-sm)", marginBottom: "8px" }}
                    />
                    <div className="text-xs" style={{ wordBreak: "break-all" }}>{asset.filePath}</div>
                  </button>
                ))}
                {assets.length === 0 && <div className="sidebar-empty-state">暂无资源</div>}
              </div>
            </div>
          </div>
        </>
      )}

      {tab === "skills" && (
        <>
          <div className="sidebar-header">技能应用</div>
          <div className="sidebar-content sidebar-stack">
            <div className="card">
              <div className="card-header">已安装技能</div>
              <div className="text-subtle text-xs">
                所有技能都保持侧栏化展示，不再接管整个编辑工作区。
              </div>
            </div>

            <div className="sidebar-stack-compact">
              {skills.map((skill) => {
                const enabled = skillEnabled(skill);
                return (
                  <div key={skill.id} className={clsx("card", "sidebar-compact-card", enabled && "sidebar-card-active")}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-primary)" }}>
                          {skill.name}
                        </div>
                        <div className="text-subtle text-xs">
                          {skill.source} · v{skill.version}
                        </div>
                      </div>
                      <span
                        className="status-badge"
                        style={{
                          background: enabled ? "var(--accent-bg)" : "var(--bg-surface-hover)",
                          color: enabled ? "var(--accent-primary)" : "var(--text-secondary)",
                        }}
                      >
                        {enabled ? "启用" : "停用"}
                      </span>
                    </div>
                    {skill.stages.length > 0 && (
                      <div className="text-subtle text-xs" style={{ marginTop: "8px" }}>
                        {skill.stages.join(" / ")}
                      </div>
                    )}
                    <button
                      className={enabled ? "btn-secondary" : "btn-primary"}
                      style={{ width: "100%", marginTop: "12px" }}
                      type="button"
                      onClick={() => void onToggleSkill(skill)}
                    >
                      {enabled ? "停用技能" : "启用技能"}
                    </button>
                  </div>
                );
              })}
              {skills.length === 0 && <div className="sidebar-empty-state">暂无技能</div>}
            </div>
          </div>
        </>
      )}

      {tab === "providers" && (
        <>
          <div className="sidebar-header">API 配置</div>
          <div className="sidebar-content sidebar-stack">
            {/* Add provider form */}
            <div className="card">
              <div className="card-header">添加 Provider</div>
              <div className="sidebar-stack-compact">
                <input
                  className="sidebar-input"
                  value={providerForm.name}
                  onChange={(event) => setProviderForm((current) => ({ ...current, name: event.target.value }))}
                  placeholder="名称（如：Fastcode、88code、我的Key）"
                  autoFocus
                />
                <input
                  className="sidebar-input"
                  value={providerForm.baseUrl}
                  onChange={(event) => setProviderForm((current) => ({ ...current, baseUrl: event.target.value }))}
                  placeholder="Base URL（如：https://api.openai.com/v1）"
                />
                <input
                  className="sidebar-input"
                  value={providerForm.defaultModel}
                  onChange={(event) => setProviderForm((current) => ({ ...current, defaultModel: event.target.value }))}
                  placeholder="默认模型（如：claude-sonnet-4）"
                />
                <input
                  className="sidebar-input"
                  type="password"
                  value={providerForm.apiKey}
                  onChange={(event) => setProviderForm((current) => ({ ...current, apiKey: event.target.value }))}
                  placeholder="API Key（如：sk-…）"
                />
                <button
                  className="btn-primary"
                  type="button"
                  onClick={() => void handleAddProvider()}
                  disabled={isSubmittingProvider || !providerForm.name.trim() || !providerForm.baseUrl.trim() || !providerForm.defaultModel.trim()}
                >
                  {isSubmittingProvider ? "保存中…" : "+ 添加 Provider"}
                </button>
              </div>
            </div>

            {/* Provider cards */}
            <div className="pcard-list">
              {providers.map((provider) => (
                <ProviderCard
                  key={provider.id}
                  provider={provider}
                  isActive={provider.id === activeProviderId}
                  testState={providerActionState[provider.id]}
                  onActivate={onActivateProvider}
                  onTest={(id) => void handleTestProvider(id)}
                  onDelete={(id) => void onDeleteProvider(id)}
                  onEdit={(id) => setEditingProviderId(id)}
                />
              ))}
              {providers.length === 0 && (
                <div className="sidebar-empty-state">暂无 Provider，在上方添加第一个</div>
              )}
            </div>
          </div>

          {/* Edit modal */}
          {editingProviderId && (() => {
            const p = providers.find(pr => pr.id === editingProviderId);
            if (!p) return null;
            return (
              <ProviderEditModal
                provider={p}
                onSave={(patch) => onUpdateProvider(p.id, patch)}
                onClose={() => setEditingProviderId(null)}
              />
            );
          })()}
        </>
      )}

      {tab === "usage" && (
        <>
          <div className="sidebar-header">用量统计</div>
          <div className="sidebar-content sidebar-stack">
            <div className="sidebar-metrics-grid">
              <div className="card sidebar-metric-card">
                <div className="text-subtle text-xs">调用次数</div>
                <div className="sidebar-metric-value">{usageRecords.length}</div>
              </div>
              <div className="card sidebar-metric-card">
                <div className="text-subtle text-xs">输入 Tokens</div>
                <div className="sidebar-metric-value">{totalInputTokens}</div>
              </div>
              <div className="card sidebar-metric-card">
                <div className="text-subtle text-xs">输出 Tokens</div>
                <div className="sidebar-metric-value">{totalOutputTokens}</div>
              </div>
            </div>

            <div className="sidebar-stack-compact">
              {usageRecords.map((record) => (
                <div key={record.id} className="card sidebar-compact-card">
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: "13px", color: "var(--text-primary)" }}>
                        {record.model}
                      </div>
                      <div className="text-subtle text-xs">
                        {record.providerId}
                      </div>
                    </div>
                    <div className="text-xs text-muted" style={{ textAlign: "right" }}>
                      <div>In {record.inputTokens}</div>
                      <div>Out {record.outputTokens}</div>
                    </div>
                  </div>
                </div>
              ))}
              {usageRecords.length === 0 && <div className="sidebar-empty-state">暂无调用记录</div>}
            </div>
          </div>
        </>
      )}

      {tab === "logs" && (
        <>
          <div className="sidebar-header">编译日志</div>
          <div className="sidebar-content sidebar-stack">
            <div className="card">
              <div className="card-header">编译状态</div>
              <span className={clsx("status-badge", diagnosticsCount > 0 ? "failed" : "success")}>
                {diagnosticsCount ? `发现 ${diagnosticsCount} 个问题` : "暂无编译问题"}
              </span>
            </div>
            <pre className="log-surface" style={{ flex: 1, minHeight: 0 }}>
              {compileLog || "无日志输出"}
            </pre>
          </div>
        </>
      )}
    </div>
  );
}
