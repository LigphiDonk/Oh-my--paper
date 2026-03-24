import { useState, useEffect } from "react";
import type { AppLocale, ProviderConfig } from "../types";
import { ProviderCard, AgentSelector, ProviderEditModal } from "./ProviderCard";
import { ComputeNodePanel } from "./ComputeNodePanel";
import { WeChatRemotePanel } from "./WeChatRemotePanel";

type SettingsTab = "general" | "ai-engine" | "compute-node" | "wechat-remote";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  locale: AppLocale;
  onLocaleChange: (locale: AppLocale) => void;
  providers: ProviderConfig[];
  activeProviderId?: string;
  onActivateProvider: (id: string) => void;
  onAddProvider: (provider: ProviderConfig) => Promise<void>;
  onUpdateProvider: (id: string, patch: Partial<ProviderConfig>) => Promise<void>;
  onDeleteProvider: (id: string) => void;
  onRefreshProviders: () => void;
}

export function SettingsModal({
  isOpen,
  onClose,
  locale,
  onLocaleChange,
  providers,
  activeProviderId,
  onActivateProvider,
  onAddProvider,
  onUpdateProvider,
  onDeleteProvider,
  onRefreshProviders,
}: SettingsModalProps) {
  const isZh = locale === "zh-CN";
  const [activeTab, setActiveTab] = useState<SettingsTab>("general");
  const [editingProviderId, setEditingProviderId] = useState<string | null>(null);

  const editingProvider = editingProviderId
    ? providers.find((p) => p.id === editingProviderId) ?? null
    : null;

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [isOpen]);

  async function handleSaveProvider(patch: Partial<ProviderConfig>) {
    if (!editingProviderId) return;
    await onUpdateProvider(editingProviderId, patch);
    onRefreshProviders();
  }

  if (!isOpen) return null;

  const tabs: { id: SettingsTab; icon: React.ReactNode; label: string }[] = [
    {
      id: "general",
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="18" height="18">
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33" />
          <path d="M4.6 9A1.65 1.65 0 0 0 4.27 7.18l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 8.92 4" />
          <path d="M9 19.08A1.65 1.65 0 0 0 7.18 19l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4 14.92" />
          <path d="M15 4.92A1.65 1.65 0 0 0 16.82 5l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 20 9.08" />
        </svg>
      ),
      label: isZh ? "常规" : "General",
    },
    {
      id: "ai-engine",
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="18" height="18">
          <rect x="3" y="11" width="18" height="10" rx="2" />
          <circle cx="12" cy="5" r="2" />
          <path d="M12 7v4" />
          <line x1="8" y1="16" x2="8" y2="16" />
          <line x1="16" y1="16" x2="16" y2="16" />
        </svg>
      ),
      label: isZh ? "AI 引擎" : "AI Engine",
    },
    {
      id: "compute-node",
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="18" height="18">
          <rect x="2" y="2" width="20" height="8" rx="2" ry="2" />
          <rect x="2" y="14" width="20" height="8" rx="2" ry="2" />
          <line x1="6" y1="6" x2="6.01" y2="6" />
          <line x1="6" y1="18" x2="6.01" y2="18" />
        </svg>
      ),
      label: isZh ? "计算节点" : "Compute Nodes",
    },
    {
      id: "wechat-remote",
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="18" height="18">
          <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
        </svg>
      ),
      label: isZh ? "微信远程" : "WeChat Remote",
    },
  ];

  return (
    <div className="settings-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="settings-modal">
        {/* Close button */}
        <button
          className="settings-modal__close"
          type="button"
          onClick={onClose}
          aria-label={isZh ? "关闭设置" : "Close settings"}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18">
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </button>

        {/* Left nav */}
        <nav className="settings-modal__nav">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              className={`settings-nav-item ${activeTab === tab.id ? "is-active" : ""}`}
              onClick={() => setActiveTab(tab.id)}
            >
              <span className="settings-nav-icon">{tab.icon}</span>
              <span className="settings-nav-label">{tab.label}</span>
            </button>
          ))}
        </nav>

        {/* Right content */}
        <div className="settings-modal__content">
          {activeTab === "general" && (
            <div className="settings-panel">
              <h2 className="settings-panel__title">{isZh ? "常规" : "General"}</h2>

              <div className="settings-section">
                <div className="settings-section__label">{isZh ? "界面语言" : "Interface Language"}</div>
                <div className="settings-language-options">
                  <button
                    type="button"
                    className={`settings-lang-btn ${locale === "zh-CN" ? "is-active" : ""}`}
                    onClick={() => onLocaleChange("zh-CN")}
                  >
                    中文
                  </button>
                  <button
                    type="button"
                    className={`settings-lang-btn ${locale === "en-US" ? "is-active" : ""}`}
                    onClick={() => onLocaleChange("en-US")}
                  >
                    English
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeTab === "ai-engine" && (
            <div className="settings-panel">
              <h2 className="settings-panel__title">{isZh ? "AI 引擎" : "AI Engine"}</h2>

              <div className="settings-section">
                <div className="settings-section__label">{isZh ? "已配置的引擎" : "Configured Engines"}</div>
                <div className="settings-provider-list">
                  {providers.map((provider) => (
                    <ProviderCard
                      key={provider.id}
                      provider={provider}
                      isActive={provider.id === activeProviderId}
                      onActivate={onActivateProvider}
                      onTest={() => {}}
                      onDelete={onDeleteProvider}
                      onEdit={setEditingProviderId}
                    />
                  ))}
                </div>
              </div>

              <div className="settings-section">
                <div className="settings-section__label">{isZh ? "添加新引擎" : "Add New Engine"}</div>
                <AgentSelector onAdd={onAddProvider} existingCount={providers.length} />
              </div>
            </div>
          )}

          {activeTab === "compute-node" && (
            <div className="settings-panel">
              <h2 className="settings-panel__title">{isZh ? "计算节点" : "Compute Nodes"}</h2>
              <ComputeNodePanel locale={locale} />
            </div>
          )}

          {activeTab === "wechat-remote" && (
            <div className="settings-panel">
              <h2 className="settings-panel__title">{isZh ? "微信远程" : "WeChat Remote"}</h2>
              <WeChatRemotePanel locale={locale} />
            </div>
          )}
        </div>
      </div>

      {editingProvider && (
        <ProviderEditModal
          provider={editingProvider}
          onSave={handleSaveProvider}
          onClose={() => setEditingProviderId(null)}
        />
      )}
    </div>
  );
}
