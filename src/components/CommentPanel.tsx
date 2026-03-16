import { useState } from "react";
import type { ReviewComment } from "../types";

interface CommentPanelProps {
  comments: ReviewComment[];
  activeFilePath: string;
  collabEnabled: boolean;
  canComment: boolean;
  currentUserId: string;
  onResolve: (id: string) => void;
  onReply: (id: string, text: string) => void;
  onDelete: (id: string) => void;
  onJumpToLine: (line: number) => void;
}

function formatTimestamp(ts: string) {
  try {
    const date = new Date(ts);
    if (Number.isNaN(date.getTime())) return ts;
    const now = new Date();
    const sameDay =
      date.getFullYear() === now.getFullYear() &&
      date.getMonth() === now.getMonth() &&
      date.getDate() === now.getDate();
    return sameDay
      ? date.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })
      : date.toLocaleDateString("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
  } catch {
    return ts;
  }
}

export function CommentPanel({
  comments,
  activeFilePath,
  collabEnabled,
  canComment,
  currentUserId,
  onResolve,
  onReply,
  onDelete,
  onJumpToLine,
}: CommentPanelProps) {
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");
  const [showResolved, setShowResolved] = useState(false);

  if (!collabEnabled) {
    return (
      <div className="card">
        <div className="card-header">批注</div>
        <div className="sidebar-empty-state">开启云协作后可使用批注功能</div>
      </div>
    );
  }

  const fileComments = comments.filter((c) => c.filePath === activeFilePath);
  const unresolved = fileComments.filter((c) => !c.resolved).sort((a, b) => a.lineStart - b.lineStart);
  const resolved = fileComments.filter((c) => c.resolved).sort((a, b) => a.lineStart - b.lineStart);

  function handleSubmitReply(commentId: string) {
    const trimmed = replyText.trim();
    if (!trimmed) return;
    onReply(commentId, trimmed);
    setReplyText("");
    setReplyingTo(null);
  }

  return (
    <div className="card">
      <div className="card-header">
        批注
        {fileComments.length > 0 && (
          <span className="text-subtle text-xs" style={{ marginLeft: 8 }}>
            {unresolved.length} 条未解决
          </span>
        )}
      </div>

      {unresolved.length === 0 && resolved.length === 0 && (
        <div className="sidebar-empty-state">
          {canComment
            ? "暂无批注 · 选中代码后点击编辑器右上角“添加批注”，或按 Cmd+Shift+M"
            : "当前权限为只读，不能创建或修改批注"}
        </div>
      )}

      {unresolved.map((comment) => (
        <div
          key={comment.id}
          className="comment-card"
          style={{ borderLeftColor: comment.userColor }}
        >
          <div className="comment-author">
            <span className="collab-color-dot" style={{ background: comment.userColor }} />
            <span>{comment.userName}</span>
            <span className="text-subtle text-xs">{formatTimestamp(comment.timestamp)}</span>
          </div>
          <button
            type="button"
            className="comment-line-ref"
            onClick={() => onJumpToLine(comment.lineStart)}
          >
            L{comment.lineStart}{comment.lineEnd !== comment.lineStart ? `–L${comment.lineEnd}` : ""}
          </button>
          <div className="comment-text">{comment.text}</div>

          {comment.replies.map((reply) => (
            <div key={reply.id} className="comment-reply">
              <div className="comment-author">
                <span className="collab-color-dot" style={{ background: reply.userColor, width: 8, height: 8 }} />
                <span>{reply.userName}</span>
                <span className="text-subtle text-xs">{formatTimestamp(reply.timestamp)}</span>
              </div>
              <div className="comment-text">{reply.text}</div>
            </div>
          ))}

          {canComment && replyingTo === comment.id && (
            <div className="comment-reply-form">
              <input
                className="sidebar-input"
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                placeholder="回复..."
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSubmitReply(comment.id);
                  }
                  if (e.key === "Escape") {
                    setReplyingTo(null);
                    setReplyText("");
                  }
                }}
              />
            </div>
          )}

          {canComment && (
            <div className="comment-actions">
              <button type="button" onClick={() => {
                setReplyingTo(replyingTo === comment.id ? null : comment.id);
                setReplyText("");
              }}>
                回复
              </button>
              <button type="button" onClick={() => onResolve(comment.id)}>
                标记已解决
              </button>
              {comment.userId === currentUserId && (
                <button type="button" onClick={() => onDelete(comment.id)}>
                  删除
                </button>
              )}
            </div>
          )}
        </div>
      ))}

      {resolved.length > 0 && (
        <>
          <button
            type="button"
            className="comment-resolved-toggle"
            onClick={() => setShowResolved(!showResolved)}
          >
            {showResolved ? "▾" : "▸"} 已解决 ({resolved.length})
          </button>
          {showResolved && resolved.map((comment) => (
            <div
              key={comment.id}
              className="comment-card comment-resolved"
              style={{ borderLeftColor: comment.userColor, opacity: 0.6 }}
            >
              <div className="comment-author">
                <span className="collab-color-dot" style={{ background: comment.userColor }} />
                <span>{comment.userName}</span>
              </div>
              <button
                type="button"
                className="comment-line-ref"
                onClick={() => onJumpToLine(comment.lineStart)}
              >
                L{comment.lineStart}{comment.lineEnd !== comment.lineStart ? `–L${comment.lineEnd}` : ""}
              </button>
              <div className="comment-text">{comment.text}</div>
              {canComment && (
                <div className="comment-actions">
                  <button type="button" onClick={() => onResolve(comment.id)}>
                    重新打开
                  </button>
                </div>
              )}
            </div>
          ))}
        </>
      )}
    </div>
  );
}
