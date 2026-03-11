import { useState } from "react";
import type { ProviderConfig } from "../types";

function initials(name: string) {
  return name
    .split(/\s+/)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .slice(0, 2)
    .join("") || "?";
}

function nameHue(name: string) {
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) & 0xffffffff;
  return Math.abs(h) % 360;
}

function ProviderAvatar({ name }: { name: string }) {
  const hue = nameHue(name);
  return (
    <div
      className="pcard-avatar"
      style={{ background: `hsl(${hue},50%,88%)`, color: `hsl(${hue},55%,32%)` }}
    >
      {initials(name)}
    </div>
  );
}

interface CardProps {
  provider: ProviderConfig;
  isActive: boolean;
  testState?: string;
  onActivate: (id: string) => void;
  onTest: (id: string) => void;
  onDelete: (id: string) => void;
  onEdit: (id: string) => void;
}

export function ProviderCard({ provider, isActive, testState, onActivate, onTest, onDelete, onEdit }: CardProps) {
  const name = provider.name || provider.vendor;
  const hue = nameHue(name);

  return (
    <div className={`pcard ${isActive ? "pcard--active" : ""}`}>
      {/* background glow */}
      <div
        className="pcard-glow"
        style={{ opacity: isActive ? 1 : 0, background: `linear-gradient(135deg, hsl(${hue},50%,95%), transparent)` }}
      />

      <div className="pcard-row">
        <ProviderAvatar name={name} />

        <div className="pcard-info">
          <div className="pcard-name">{name}</div>
          <div className="pcard-sub">
            {provider.baseUrl
              ? provider.baseUrl.replace(/^https?:\/\//, "")
              : <span style={{ opacity: 0.45 }}>未配置 Base URL</span>}
          </div>
          <div className="pcard-model">{provider.defaultModel || "—"}</div>
        </div>

        <div className="pcard-actions">
          {isActive ? (
            <div className="pcard-in-use">
              <span className="pcard-dot" />
              使用中
            </div>
          ) : (
            <button className="pcard-enable-btn" type="button" onClick={() => onActivate(provider.id)}>
              ▶ 启用
            </button>
          )}

          <div className="pcard-icon-row">
            <button className="pcard-icon-btn" type="button" title="编辑名称/配置" onClick={() => onEdit(provider.id)}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="13" height="13"><path d="M11 4H4a2 2 0 0 0-2 2v14c0 1.1.9 2 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            </button>
            <button className="pcard-icon-btn" type="button" title="测试连接" onClick={() => onTest(provider.id)}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="13" height="13"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
            </button>
            <button className="pcard-icon-btn pcard-icon-btn--danger" type="button" title="删除" onClick={() => onDelete(provider.id)}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="13" height="13"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>
            </button>
          </div>

          {testState && <div className="pcard-test-state">{testState}</div>}
        </div>
      </div>
    </div>
  );
}

/* ── Edit modal ─────────────────────────────── */
interface EditModalProps {
  provider: ProviderConfig;
  onSave: (patch: Partial<ProviderConfig>) => Promise<void>;
  onClose: () => void;
}

export function ProviderEditModal({ provider, onSave, onClose }: EditModalProps) {
  const [form, setForm] = useState({
    name: provider.name ?? "",
    baseUrl: provider.baseUrl ?? "",
    defaultModel: provider.defaultModel ?? "",
    apiKey: "",
  });
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    try {
      await onSave({
        name: form.name.trim() || provider.vendor,
        baseUrl: form.baseUrl.trim(),
        defaultModel: form.defaultModel.trim(),
        ...(form.apiKey ? { apiKey: form.apiKey } : {}),
      });
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal-box">
        <div className="modal-header">
          <span>编辑 Provider</span>
          <button className="modal-close" type="button" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <label className="modal-label">
            自定义名称
            <input className="sidebar-input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Fastcode · 88code · 我的Key" autoFocus />
          </label>
          <label className="modal-label">
            Base URL
            <input className="sidebar-input" value={form.baseUrl} onChange={e => setForm(f => ({ ...f, baseUrl: e.target.value }))} placeholder="https://api.openai.com/v1" />
          </label>
          <label className="modal-label">
            默认模型
            <input className="sidebar-input" value={form.defaultModel} onChange={e => setForm(f => ({ ...f, defaultModel: e.target.value }))} placeholder="claude-sonnet-4" />
          </label>
          <label className="modal-label">
            API Key <span style={{ opacity: 0.5, fontSize: 11 }}>（留空不修改）</span>
            <input className="sidebar-input" type="password" value={form.apiKey} onChange={e => setForm(f => ({ ...f, apiKey: e.target.value }))} placeholder="sk-…" />
          </label>
        </div>
        <div className="modal-footer">
          <button className="btn-secondary" type="button" onClick={onClose}>取消</button>
          <button className="btn-primary" type="button" onClick={() => void handleSave()} disabled={saving}>
            {saving ? "保存中…" : "保存"}
          </button>
        </div>
      </div>
    </div>
  );
}
