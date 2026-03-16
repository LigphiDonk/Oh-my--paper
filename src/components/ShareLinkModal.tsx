import { useMemo, useState } from "react";

import type { CloudProjectRole } from "../types";
import { generateShareLink } from "../lib/collaboration/share";

interface ShareLinkModalProps {
  projectId: string;
  httpBaseUrl: string;
  onClose: () => void;
  onCopy: (role: CloudProjectRole) => void;
}

const ROLE_OPTIONS: Array<{
  role: CloudProjectRole;
  title: string;
  description: string;
}> = [
  {
    role: "viewer",
    title: "只读",
    description: "能打开项目并拉取最新内容，但不能批注，也不能推送到云端。",
  },
  {
    role: "commenter",
    title: "可批注",
    description: "能拉取内容和提交批注，但不能修改正文。",
  },
  {
    role: "editor",
    title: "可编辑",
    description: "能拉取、批注并推送正文修改。",
  },
];

export function ShareLinkModal({ projectId, httpBaseUrl, onClose, onCopy }: ShareLinkModalProps) {
  const [role, setRole] = useState<CloudProjectRole>("viewer");
  const link = useMemo(() => generateShareLink(projectId, httpBaseUrl, role), [httpBaseUrl, projectId, role]);

  return (
    <div className="modal-backdrop" onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <div className="modal-box share-link-modal">
        <div className="modal-header">
          <span>创建分享链接</span>
          <button className="modal-close" type="button" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <div className="text-subtle text-xs">
            选择接收方拿到这个链接后，会获得哪一种权限。
          </div>
          <div className="share-role-grid">
            {ROLE_OPTIONS.map((option) => (
              <button
                key={option.role}
                type="button"
                className={`share-role-card ${role === option.role ? "is-active" : ""}`}
                onClick={() => setRole(option.role)}
              >
                <span className="share-role-title">{option.title}</span>
                <span className="share-role-description">{option.description}</span>
              </button>
            ))}
          </div>
          <label className="modal-label">
            预览链接
            <input className="sidebar-input" value={link} readOnly />
          </label>
        </div>
        <div className="modal-footer">
          <button className="btn-secondary" type="button" onClick={onClose}>取消</button>
          <button className="btn-primary" type="button" onClick={() => onCopy(role)}>
            复制链接
          </button>
        </div>
      </div>
    </div>
  );
}
