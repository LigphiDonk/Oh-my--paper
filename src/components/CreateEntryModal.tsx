import { useEffect, useState } from "react";

interface CreateEntryModalProps {
  kind: "file" | "folder";
  parentDir: string;
  busy?: boolean;
  onSubmit: (name: string) => void | Promise<void>;
  onClose: () => void;
}

export function CreateEntryModal({ kind, parentDir, busy = false, onSubmit, onClose }: CreateEntryModalProps) {
  const [value, setValue] = useState(kind === "file" ? "new-section.tex" : "new-folder");

  useEffect(() => {
    setValue(kind === "file" ? "new-section.tex" : "new-folder");
  }, [kind, parentDir]);

  const title = kind === "file" ? "新建文件" : "新建文件夹";
  const label = kind === "file" ? "文件名" : "文件夹名";
  const targetLabel = parentDir || "项目根目录";

  return (
    <div className="modal-backdrop" onClick={(event) => { if (event.target === event.currentTarget && !busy) onClose(); }}>
      <div className="modal-box modal-box-compact">
        <div className="modal-header">
          <span>{title}</span>
          <button className="modal-close" type="button" onClick={onClose} disabled={busy}>✕</button>
        </div>
        <div className="modal-body">
          <div className="text-subtle text-xs">创建位置：{targetLabel}</div>
          <label className="modal-label">
            {label}
            <input
              className="sidebar-input"
              value={value}
              onChange={(event) => setValue(event.target.value)}
              placeholder={kind === "file" ? "例如 appendix.tex" : "例如 figures"}
              autoFocus
            />
          </label>
        </div>
        <div className="modal-footer">
          <button className="btn-secondary" type="button" onClick={onClose} disabled={busy}>取消</button>
          <button
            className="btn-primary"
            type="button"
            onClick={() => void onSubmit(value.trim())}
            disabled={!value.trim() || busy}
          >
            {busy ? "创建中..." : "创建"}
          </button>
        </div>
      </div>
    </div>
  );
}
