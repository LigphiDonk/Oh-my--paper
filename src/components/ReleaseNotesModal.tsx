import ReactMarkdown from "react-markdown";

interface ReleaseNotesModalProps {
  version: string;
  body: string;
  publishedAt?: string;
  htmlUrl?: string;
  onClose: () => void;
}

function formatPublishedAt(value?: string) {
  if (!value) {
    return "";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return date.toLocaleString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function ReleaseNotesModal({
  version,
  body,
  publishedAt,
  htmlUrl,
  onClose,
}: ReleaseNotesModalProps) {
  const publishedLabel = formatPublishedAt(publishedAt);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-box release-notes-modal"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="modal-header">
          <div className="release-notes-header">
            <span>版本更新</span>
            <span className="release-notes-version">v{version}</span>
          </div>
          <button className="modal-close" type="button" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body release-notes-body">
          {publishedLabel && (
            <div className="release-notes-meta">发布时间：{publishedLabel}</div>
          )}
          <div className="release-notes-markdown">
            <ReactMarkdown>{body}</ReactMarkdown>
          </div>
        </div>
        <div className="modal-footer">
          {htmlUrl ? (
            <a
              className="btn-secondary release-notes-link"
              href={htmlUrl}
              target="_blank"
              rel="noreferrer"
            >
              在 GitHub 查看
            </a>
          ) : (
            <span />
          )}
          <button className="btn-primary" type="button" onClick={onClose}>知道了</button>
        </div>
      </div>
    </div>
  );
}
