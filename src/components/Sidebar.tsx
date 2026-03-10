import clsx from "clsx";
import type { ReactNode } from "react";
import type {
    AgentMessage,
    AgentProfile,
    FigureBriefDraft,
    GeneratedAsset,
    ProviderConfig,
} from "../types";

interface SidebarProps {
    tab: string;
    messages: AgentMessage[];
    profiles: AgentProfile[];
    activeProfileId: string;
    onSelectProfile: (profileId: string) => void;
    onRunAgent: () => void;
    pendingPatchSummary?: string;
    onApplyPatch: () => void;
    compileLog: string;
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
    explorerNode: ReactNode; // Pass ProjectTree here
}

export function Sidebar({
    tab,
    messages,
    profiles,
    activeProfileId,
    onSelectProfile,
    onRunAgent,
    pendingPatchSummary,
    onApplyPatch,
    compileLog,
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
    explorerNode,
}: SidebarProps) {

    return (
        <div className="primary-sidebar">
            {tab === "explorer" && (
                <>
                    <div className="sidebar-header">项目资源 (Explorer)</div>
                    <div className="sidebar-content" style={{ padding: "8px 0" }}>
                        {explorerNode}
                    </div>
                </>
            )}

            {tab === "ai" && (
                <>
                    <div className="sidebar-header">AI 智能体助手</div>
                    <div className="sidebar-content" style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                        <div className="card hover-spring">
                            <div className="card-header">智能体配置</div>
                            <select
                                style={{ width: "100%", padding: "6px", borderRadius: "4px", border: "1px solid var(--border-light)", fontSize: "12px", marginBottom: "12px" }}
                                value={activeProfileId}
                                onChange={(e) => onSelectProfile(e.target.value)}
                            >
                                {profiles.map(p => (
                                    <option key={p.id} value={p.id}>{p.label} - {p.model}</option>
                                ))}
                            </select>

                            <div style={{ display: "flex", gap: "8px" }}>
                                <button className="btn-primary" onClick={onRunAgent} style={{ flex: 1 }}>执行分析</button>
                                <button
                                    className="btn-secondary"
                                    disabled={!pendingPatchSummary}
                                    onClick={onApplyPatch}
                                >
                                    应用补丁
                                </button>
                            </div>
                            {pendingPatchSummary && (
                                <div style={{ marginTop: "8px", fontSize: "11px", color: "var(--accent-primary)" }}>
                                    待处理: {pendingPatchSummary}
                                </div>
                            )}
                        </div>

                        <div className="message-list">
                            {messages.map((message) => (
                                <div key={message.id} className={clsx("message", `role - ${message.role} `)}>
                                    <div className="message-header">
                                        {message.role === "user" ? "用户 (User)" : "助手 (Assistant)"} · {message.profileId}
                                    </div>
                                    <div className="message-bubble">
                                        {message.content}
                                    </div>
                                </div>
                            ))}
                            {messages.length === 0 && (
                                <div style={{ textAlign: "center", color: "var(--text-tertiary)", marginTop: "20px", fontSize: "13px" }}>
                                    暂无对话记录
                                </div>
                            )}
                        </div>
                    </div>
                </>
            )}

            {tab === "logs" && (
                <>
                    <div className="sidebar-header">编译日志 (Logs)</div>
                    <div className="sidebar-content" style={{ display: "flex", flexDirection: "column" }}>
                        <div style={{ marginBottom: "12px", fontSize: "13px" }}>
                            <span className={clsx("status-badge", diagnosticsCount > 0 ? "failed" : "success")}>
                                {diagnosticsCount ? `发现 ${diagnosticsCount} 个问题` : "暂无编译问题"}
                            </span>
                        </div>
                        <pre className="log-surface" style={{ flex: 1 }}>{compileLog || "无日志输出"}</pre>
                    </div>
                </>
            )}

            {tab === "figures" && (
                <>
                    <div className="sidebar-header">图表生成 (Figures)</div>
                    <div className="sidebar-content">
                        <div className="card">
                            <div className="card-header">操作面板</div>
                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", marginBottom: "8px" }}>
                                <button className="btn-primary" onClick={onCreateBrief}>新建概要</button>
                                <button className="btn-secondary" disabled={!selectedBriefId} onClick={onRunFigureSkill}>预处理</button>
                                <button className="btn-secondary" disabled={!selectedBriefId} onClick={onGenerateFigure}>生成图像</button>
                                <button className="btn-secondary" disabled={!selectedAssetId} onClick={onInsertFigure}>插入文档</button>
                            </div>
                        </div>

                        <div style={{ marginTop: "16px", marginBottom: "8px", fontSize: "12px", fontWeight: 600, color: "var(--text-secondary)" }}>
                            图表概要 (Briefs)
                        </div>
                        <div style={{ display: "grid", gap: "8px" }}>
                            {briefs.map((brief) => (
                                <div
                                    key={brief.id}
                                    className={clsx("card hover-spring", selectedBriefId === brief.id && "is-active")}
                                    style={{ cursor: "pointer", borderColor: selectedBriefId === brief.id ? "var(--accent-primary)" : "", marginBottom: 0 }}
                                    onClick={() => onSelectBrief(brief.id)}
                                >
                                    <div style={{ fontWeight: 500, fontSize: "12px", color: "var(--text-primary)" }}>{brief.sourceSectionRef || "未命名节点"}</div>
                                    <div style={{ fontSize: "11px", color: "var(--text-tertiary)" }}>状态: {brief.status}</div>
                                </div>
                            ))}
                            {briefs.length === 0 && <div className="text-subtle text-xs">暂无数据</div>}
                        </div>

                        <div style={{ marginTop: "16px", marginBottom: "8px", fontSize: "12px", fontWeight: 600, color: "var(--text-secondary)" }}>
                            已生成资源 (Assets)
                        </div>
                        <div style={{ display: "grid", gap: "8px" }}>
                            {assets.map((asset) => (
                                <div
                                    key={asset.id}
                                    className="card hover-spring"
                                    style={{ cursor: "pointer", borderColor: selectedAssetId === asset.id ? "var(--accent-primary)" : "", marginBottom: 0 }}
                                    onClick={() => onSelectAsset(asset.id)}
                                >
                                    <img alt={asset.filePath} src={asset.previewUri} style={{ width: "100%", borderRadius: "4px", marginBottom: "6px" }} />
                                    <div style={{ fontSize: "11px", wordBreak: "break-all" }}>{asset.filePath}</div>
                                </div>
                            ))}
                            {assets.length === 0 && <div className="text-subtle text-xs">暂无数据</div>}
                        </div>
                    </div>
                </>
            )}

            {tab === "providers" && (
                <>
                    <div className="sidebar-header">API 配置 (Providers)</div>
                    <div className="sidebar-content">
                        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                            {providers.map((provider) => (
                                <div key={provider.id} className="card hover-spring">
                                    <div style={{ fontWeight: 600, color: "var(--text-primary)", fontSize: "13px" }}>{provider.vendor}</div>
                                    <div style={{ color: "var(--text-secondary)", fontSize: "12px", marginTop: "4px" }}>默认模型: {provider.defaultModel}</div>
                                    <div style={{ color: "var(--text-tertiary)", fontSize: "11px", marginTop: "2px", wordBreak: "break-all" }}>{provider.baseUrl}</div>
                                </div>
                            ))}
                            {providers.length === 0 && (
                                <div className="text-subtle text-xs" style={{ textAlign: "center", padding: "10px" }}>未提供API配置</div>
                            )}
                        </div>

                        <button className="btn-secondary hover-spring" style={{ width: "100%", marginTop: "16px" }}>
                            添加大模型提供商
                        </button>
                    </div>
                </>
            )}
        </div>
    );
}
