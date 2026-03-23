import { useCallback, useEffect, useMemo, useState } from "react";
import Markdown from "react-markdown";

import type { AppLocale, LiteratureItem } from "../types";
import { desktop } from "../lib/desktop";

/* ── Tiny helpers ── */
const t = (locale: AppLocale, zh: string, en: string) =>
  locale === "zh-CN" ? zh : en;

function basename(path: string) {
  return path.split("/").pop() ?? path;
}

function fileExtension(path: string) {
  const dot = path.lastIndexOf(".");
  return dot >= 0 ? path.slice(dot + 1).toLowerCase() : "";
}

function generateId() {
  return crypto.randomUUID?.() ?? Math.random().toString(36).slice(2);
}

/* ── Paper bank paper shape (loose, supports various field names) ── */
interface PaperEntry {
  id?: string;
  title?: string;
  authors?: string[] | string;
  year?: number;
  doi?: string;
  abstract?: string;
  journal?: string;
  venue?: string;
  url?: string;
  link?: string;
  tags?: string[];
  keywords?: string[];
  notes?: string;
  method?: string;
  category?: string;
  status?: string;
  [key: string]: unknown;
}

function extractPapers(parsed: unknown): PaperEntry[] | null {
  if (Array.isArray(parsed)) {
    return parsed as PaperEntry[];
  }
  if (parsed && typeof parsed === "object") {
    const obj = parsed as Record<string, unknown>;
    if (Array.isArray(obj.papers)) {
      return obj.papers as PaperEntry[];
    }
    if (Array.isArray(obj.items)) {
      return obj.items as PaperEntry[];
    }
    if (Array.isArray(obj.references)) {
      return obj.references as PaperEntry[];
    }
  }
  return null;
}

function formatAuthors(authors: string[] | string | undefined): string {
  if (!authors) return "";
  if (typeof authors === "string") return authors;
  if (authors.length === 0) return "";
  if (authors.length <= 3) return authors.join(", ");
  return `${authors.slice(0, 3).join(", ")} et al.`;
}

function resolvePaperUrl(paper: PaperEntry): string {
  if (paper.url) return paper.url;
  if (paper.link) return paper.link;
  if (paper.doi) return `https://doi.org/${paper.doi}`;
  return "";
}

/* ── JSON type detection ── */
function isResearchBrief(name: string): boolean {
  return name.toLowerCase().includes("research_brief");
}

function isIdeaBoard(name: string): boolean {
  return name.toLowerCase().includes("idea_board");
}

/* ── MD locale file helpers ── */
function localeVariantPaths(path: string): { zh: string; en: string } {
  const base = path.replace(/\.md$/i, "");
  return { zh: `${base}.zh.md`, en: `${base}.en.md` };
}

/* ── ResearchBriefView ── */
function ResearchBriefView({ data, locale }: { data: Record<string, unknown>; locale: AppLocale }) {
  const isZh = locale === "zh-CN";
  const [showPrompt, setShowPrompt] = useState(false);
  const [showMemory, setShowMemory] = useState(false);

  const topic = (data.topic as string) || "";
  const goal = (data.goal as string) || "";
  const pipeline = data.pipeline as Record<string, unknown> | undefined;
  const currentStage = (pipeline?.currentStage as string) || "";
  const initializedStages = (pipeline?.initializedStages as string[]) || [];
  const systemPrompt = (data.systemPrompt as string) || "";
  const workingMemory = (data.workingMemory as string) || "";
  const interactionRules = (data.interactionRules as string[]) || [];

  return (
    <div className="research-brief-view">
      <div className="research-brief-view__card">
        <div className="research-brief-view__field">
          <span className="research-brief-view__icon">📌</span>
          <div>
            <div className="research-brief-view__label">{isZh ? "研究主题" : "Topic"}</div>
            <div className="research-brief-view__value">{topic || "—"}</div>
          </div>
        </div>
        <div className="research-brief-view__field">
          <span className="research-brief-view__icon">🎯</span>
          <div>
            <div className="research-brief-view__label">{isZh ? "研究目标" : "Goal"}</div>
            <div className="research-brief-view__value">{goal || "—"}</div>
          </div>
        </div>
        <div className="research-brief-view__field">
          <span className="research-brief-view__icon">📊</span>
          <div>
            <div className="research-brief-view__label">{isZh ? "当前阶段" : "Current Stage"}</div>
            <div className="research-brief-view__value">{currentStage || "—"}</div>
          </div>
        </div>
        {initializedStages.length > 0 && (
          <div className="research-brief-view__field">
            <span className="research-brief-view__icon">✅</span>
            <div>
              <div className="research-brief-view__label">{isZh ? "已初始化阶段" : "Initialized Stages"}</div>
              <div className="research-brief-view__tags">
                {initializedStages.map((s) => <span key={s} className="research-brief-view__tag">{s}</span>)}
              </div>
            </div>
          </div>
        )}
      </div>
      {systemPrompt && (
        <div className="research-brief-view__collapsible">
          <button type="button" className="research-brief-view__toggle" onClick={() => setShowPrompt(!showPrompt)}>
            <span>{showPrompt ? "▾" : "▸"}</span>
            <span>🔧 {isZh ? "系统提示词" : "System Prompt"}</span>
          </button>
          {showPrompt && <pre className="research-brief-view__pre">{systemPrompt}</pre>}
        </div>
      )}
      {workingMemory && (
        <div className="research-brief-view__collapsible">
          <button type="button" className="research-brief-view__toggle" onClick={() => setShowMemory(!showMemory)}>
            <span>{showMemory ? "▾" : "▸"}</span>
            <span>🧠 {isZh ? "工作记忆" : "Working Memory"}</span>
          </button>
          {showMemory && <pre className="research-brief-view__pre">{workingMemory}</pre>}
        </div>
      )}
      {interactionRules.length > 0 && (
        <div className="research-brief-view__rules">
          <div className="research-brief-view__label">📋 {isZh ? "交互规则" : "Interaction Rules"}</div>
          <ol>
            {interactionRules.map((rule, i) => <li key={i}>{rule}</li>)}
          </ol>
        </div>
      )}
    </div>
  );
}

/* ── IdeaBoardView ── */
interface IdeaEntry {
  title?: string;
  name?: string;
  description?: string;
  summary?: string;
  tags?: string[];
  keywords?: string[];
  score?: number;
  rating?: number;
  selected?: boolean;
  status?: string;
  [key: string]: unknown;
}

function extractIdeas(parsed: unknown): IdeaEntry[] | null {
  if (Array.isArray(parsed)) return parsed as IdeaEntry[];
  if (parsed && typeof parsed === "object") {
    const obj = parsed as Record<string, unknown>;
    if (Array.isArray(obj.ideas)) return obj.ideas as IdeaEntry[];
    if (Array.isArray(obj.items)) return obj.items as IdeaEntry[];
    if (Array.isArray(obj.candidates)) return obj.candidates as IdeaEntry[];
  }
  return null;
}

function IdeaBoardView({ data, locale }: { data: unknown; locale: AppLocale }) {
  const isZh = locale === "zh-CN";
  const ideas = extractIdeas(data);
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);

  if (!ideas || ideas.length === 0) {
    return <div className="idea-board-view__empty">{isZh ? "暂无候选 Idea" : "No ideas yet"}</div>;
  }

  return (
    <div className="idea-board-view">
      <div className="idea-board-view__header">
        <span>{isZh ? `共 ${ideas.length} 个候选` : `${ideas.length} candidate(s)`}</span>
      </div>
      <div className="idea-board-view__grid">
        {ideas.map((idea, idx) => {
          const title = idea.title || idea.name || `Idea ${idx + 1}`;
          const desc = idea.description || idea.summary || "";
          const tags = idea.tags || idea.keywords || [];
          const score = idea.score ?? idea.rating;
          const isSelected = idea.selected === true || idea.status === "selected";
          const isExpanded = expandedIdx === idx;

          return (
            <div
              key={idx}
              className={`idea-board-view__card${isSelected ? " is-selected" : ""}`}
              onClick={() => setExpandedIdx(isExpanded ? null : idx)}
            >
              <div className="idea-board-view__card-header">
                <span className="idea-board-view__card-title">{title}</span>
                {score != null && (
                  <span className="idea-board-view__card-score">
                    {"★".repeat(Math.min(Math.round(score), 5))}
                  </span>
                )}
                {isSelected && <span className="idea-board-view__selected-badge">{isZh ? "已选定" : "Selected"}</span>}
              </div>
              {desc && (
                <div className="idea-board-view__card-desc">
                  {isExpanded ? desc : desc.length > 120 ? `${desc.slice(0, 120)}…` : desc}
                </div>
              )}
              {tags.length > 0 && (
                <div className="idea-board-view__card-tags">
                  {tags.map((tag, i) => <span key={i} className="idea-board-view__tag">{typeof tag === "string" ? tag : String(tag)}</span>)}
                </div>
              )}
              {isExpanded && (
                <div className="idea-board-view__card-extra">
                  {Object.entries(idea)
                    .filter(([k]) => !["title", "name", "description", "summary", "tags", "keywords", "score", "rating", "selected", "status"].includes(k))
                    .map(([k, v]) => (
                      <div key={k} className="idea-board-view__extra-row">
                        <span className="idea-board-view__extra-key">{k}:</span>
                        <span className="idea-board-view__extra-val">{typeof v === "object" ? JSON.stringify(v) : String(v)}</span>
                      </div>
                    ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ── JsonTreeView ── */
function JsonTreeView({ data, depth = 0 }: { data: unknown; depth?: number }) {
  const [collapsed, setCollapsed] = useState(depth > 1);

  if (data === null) return <span className="json-tree__null">null</span>;
  if (data === undefined) return <span className="json-tree__null">undefined</span>;
  if (typeof data === "boolean") return <span className="json-tree__bool">{String(data)}</span>;
  if (typeof data === "number") return <span className="json-tree__number">{data}</span>;
  if (typeof data === "string") {
    if (data.length > 200) {
      return <span className="json-tree__string">"{data.slice(0, 200)}…"</span>;
    }
    return <span className="json-tree__string">"{data}"</span>;
  }

  if (Array.isArray(data)) {
    if (data.length === 0) return <span className="json-tree__bracket">{"[]"}</span>;
    return (
      <span className="json-tree__node">
        <button type="button" className="json-tree__toggle" onClick={() => setCollapsed(!collapsed)}>
          {collapsed ? "▸" : "▾"} <span className="json-tree__bracket">[</span>
          {collapsed && <span className="json-tree__count">{data.length} items</span>}
          {collapsed && <span className="json-tree__bracket">]</span>}
        </button>
        {!collapsed && (
          <div className="json-tree__children">
            {data.map((item, i) => (
              <div key={i} className="json-tree__entry">
                <span className="json-tree__index">{i}: </span>
                <JsonTreeView data={item} depth={depth + 1} />
              </div>
            ))}
            <span className="json-tree__bracket">]</span>
          </div>
        )}
      </span>
    );
  }

  if (typeof data === "object") {
    const entries = Object.entries(data as Record<string, unknown>);
    if (entries.length === 0) return <span className="json-tree__bracket">{"{}"}</span>;
    return (
      <span className="json-tree__node">
        <button type="button" className="json-tree__toggle" onClick={() => setCollapsed(!collapsed)}>
          {collapsed ? "▸" : "▾"} <span className="json-tree__bracket">{"{"}</span>
          {collapsed && <span className="json-tree__count">{entries.length} keys</span>}
          {collapsed && <span className="json-tree__bracket">{"}"}</span>}
        </button>
        {!collapsed && (
          <div className="json-tree__children">
            {entries.map(([key, val]) => (
              <div key={key} className="json-tree__entry">
                <span className="json-tree__key">{key}: </span>
                <JsonTreeView data={val} depth={depth + 1} />
              </div>
            ))}
            <span className="json-tree__bracket">{"}"}</span>
          </div>
        )}
      </span>
    );
  }

  return <span>{String(data)}</span>;
}

/* ── Props ── */
interface ArtifactPreviewModalProps {
  path: string;
  locale: AppLocale;
  onClose: () => void;
  onOpenLiterature: () => void;
}

/* ── Component ── */
export function ArtifactPreviewModal({
  path,
  locale,
  onClose,
  onOpenLiterature,
}: ArtifactPreviewModalProps) {
  const [content, setContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [importedDois, setImportedDois] = useState<Set<string>>(new Set());
  const [importedTitles, setImportedTitles] = useState<Set<string>>(new Set());
  const [importingAll, setImportingAll] = useState(false);

  /* ── MD locale switching ── */
  const [altLangContent, setAltLangContent] = useState<string | null>(null);
  const [showAltLang, setShowAltLang] = useState(false);
  const [hasAltLang, setHasAltLang] = useState(false);
  const [altLangLabel, setAltLangLabel] = useState("");

  const ext = fileExtension(path);
  const name = basename(path);
  const isPaperBank = name.toLowerCase().includes("paper_bank");

  /* Load file content */
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setAltLangContent(null);
    setShowAltLang(false);
    setHasAltLang(false);

    desktop
      .readFile(path)
      .then((file) => {
        if (!cancelled) {
          setContent(file.content);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : String(err));
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    /* Check for locale variants of MD files */
    if (ext === "md" && !path.match(/\.(zh|en)\.md$/i)) {
      const variants = localeVariantPaths(path);
      const isCurrentZh = locale === "zh-CN";
      const altPath = isCurrentZh ? variants.en : variants.zh;
      const altLabel = isCurrentZh ? "EN" : "中";

      desktop.readFile(altPath)
        .then((file) => {
          if (!cancelled && file.content) {
            setAltLangContent(file.content);
            setHasAltLang(true);
            setAltLangLabel(altLabel);
          }
        })
        .catch(() => { /* no alt lang variant */ });
    }

    return () => {
      cancelled = true;
    };
  }, [path, ext, locale]);

  /* Pre-load existing library for dedup */
  useEffect(() => {
    if (!isPaperBank) return;
    desktop.listLiterature().then((items) => {
      setImportedDois(new Set(items.filter((i) => i.doi).map((i) => i.doi)));
      setImportedTitles(new Set(items.map((i) => i.title.toLowerCase().trim())));
    }).catch(() => { /* ignore */ });
  }, [isPaperBank]);

  /* Parsed JSON / papers */
  const parsedJson = useMemo(() => {
    if (ext !== "json" || !content) return null;
    try {
      return JSON.parse(content);
    } catch {
      return null;
    }
  }, [ext, content]);

  const papers = useMemo(() => {
    if (!parsedJson) return null;
    return extractPapers(parsedJson);
  }, [parsedJson]);

  const isPaperAlreadyImported = useCallback(
    (paper: PaperEntry) => {
      if (paper.doi && importedDois.has(paper.doi)) return true;
      if (paper.title && importedTitles.has(paper.title.toLowerCase().trim())) return true;
      return false;
    },
    [importedDois, importedTitles],
  );

  const handleImportPaper = useCallback(
    async (paper: PaperEntry) => {
      const authorsArray = Array.isArray(paper.authors)
        ? paper.authors
        : paper.authors
          ? [paper.authors]
          : [];
      const item: LiteratureItem = {
        id: generateId(),
        title: paper.title ?? "Untitled",
        authors: authorsArray,
        year: paper.year ?? 0,
        journal: paper.venue || paper.journal || "",
        doi: paper.doi ?? "",
        abstract: paper.abstract ?? "",
        tags: paper.tags || paper.keywords || [],
        notes: paper.notes ?? "",
        dedupHash: "",
        linkedTaskIds: [],
        addedAt: "",
        updatedAt: "",
      };
      try {
        await desktop.addLiterature(item);
        if (paper.doi) {
          setImportedDois((prev) => new Set(prev).add(paper.doi!));
        }
        if (paper.title) {
          setImportedTitles((prev) => new Set(prev).add(paper.title!.toLowerCase().trim()));
        }
      } catch (err) {
        console.error("Failed to import paper:", err);
      }
    },
    [],
  );

  const handleImportAll = useCallback(async () => {
    if (!papers) return;
    setImportingAll(true);
    const toImport = papers.filter((p) => !isPaperAlreadyImported(p));
    for (const paper of toImport) {
      await handleImportPaper(paper);
    }
    setImportingAll(false);
  }, [papers, isPaperAlreadyImported, handleImportPaper]);

  /* Close on Escape */
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        onClose();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  /* ── Render body ── */
  function renderBody() {
    if (loading) {
      return (
        <div className="artifact-preview-modal__loading">
          {t(locale, "加载中…", "Loading…")}
        </div>
      );
    }
    if (error) {
      return (
        <div className="artifact-preview-modal__error">
          <p>{t(locale, "无法加载文件", "Failed to load file")}</p>
          <p className="artifact-preview-modal__error-detail">{error}</p>
        </div>
      );
    }
    if (!content && content !== "") {
      return null;
    }

    /* Markdown */
    if (ext === "md") {
      const displayContent = showAltLang && altLangContent ? altLangContent : content;
      return (
        <div className="artifact-preview-modal__markdown">
          <Markdown>{displayContent}</Markdown>
        </div>
      );
    }

    /* JSON – Paper Bank */
    if (ext === "json" && isPaperBank && papers) {
      const unimportedCount = papers.filter((p) => !isPaperAlreadyImported(p)).length;
      const metadata = parsedJson?.metadata as Record<string, unknown> | undefined;

      return (
        <div className="artifact-preview-modal__papers">
          <div className="artifact-preview-modal__papers-toolbar">
            <span>
              {t(locale, `共 ${papers.length} 篇文献`, `${papers.length} paper(s)`)}
              {metadata?.domain != null && (
                <span className="artifact-preview-modal__papers-domain"> · {String(metadata.domain)}</span>
              )}
            </span>
            <div style={{ display: "flex", gap: 8 }}>
              <button
                type="button"
                className="artifact-preview-modal__import-all-btn"
                onClick={() => void handleImportAll()}
                disabled={importingAll || unimportedCount === 0}
              >
                {importingAll
                  ? t(locale, "导入中…", "Importing…")
                  : unimportedCount === 0
                    ? t(locale, "✓ 全部已导入", "✓ All Imported")
                    : t(locale, `全部导入 (${unimportedCount})`, `Import All (${unimportedCount})`)}
              </button>
              <button
                type="button"
                className="artifact-preview-modal__goto-lib-btn"
                onClick={() => { onOpenLiterature(); onClose(); }}
              >
                {t(locale, "打开文献库 →", "Open Library →")}
              </button>
            </div>
          </div>
          <div className="artifact-preview-modal__paper-list">
            {papers.map((paper, idx) => {
              const imported = isPaperAlreadyImported(paper);
              const paperUrl = resolvePaperUrl(paper);
              const authorsStr = formatAuthors(paper.authors);
              const venue = paper.venue || paper.journal || "";
              const keywords = paper.keywords || paper.tags || [];

              return (
                <div key={paper.id || paper.doi || paper.title || idx} className={`artifact-preview-modal__paper-card${imported ? " is-imported" : ""}`}>
                  <div className="artifact-preview-modal__paper-title">
                    {paperUrl ? (
                      <a href={paperUrl} target="_blank" rel="noopener noreferrer">
                        {paper.title ?? t(locale, "无标题", "Untitled")}
                        <span className="artifact-preview-modal__paper-link-icon"> ↗</span>
                      </a>
                    ) : (
                      paper.title ?? t(locale, "无标题", "Untitled")
                    )}
                  </div>
                  <div className="artifact-preview-modal__paper-meta">
                    {authorsStr && <span>{authorsStr}</span>}
                    {paper.year ? <span>{paper.year}</span> : null}
                    {venue ? <span>{venue}</span> : null}
                  </div>
                  {paper.method && (
                    <div className="artifact-preview-modal__paper-method">
                      <span className="artifact-preview-modal__paper-method-label">
                        {t(locale, "方法", "Method")}:
                      </span>
                      {" "}{paper.method}
                    </div>
                  )}
                  {paper.doi && (
                    <div className="artifact-preview-modal__paper-doi">
                      DOI:{" "}
                      <a href={`https://doi.org/${paper.doi}`} target="_blank" rel="noopener noreferrer">
                        {paper.doi}
                      </a>
                    </div>
                  )}
                  {!paper.doi && paperUrl && (
                    <div className="artifact-preview-modal__paper-doi">
                      <a href={paperUrl} target="_blank" rel="noopener noreferrer">
                        {paperUrl}
                      </a>
                    </div>
                  )}
                  {!paperUrl && !paper.doi && (
                    <div className="artifact-preview-modal__paper-no-link">
                      {t(locale, "⚠ 缺少链接", "⚠ No link available")}
                    </div>
                  )}
                  {keywords.length > 0 && (
                    <div className="artifact-preview-modal__paper-keywords">
                      {keywords.map((kw, i) => (
                        <span key={i} className="artifact-preview-modal__paper-kw-tag">
                          {typeof kw === "string" ? kw : String(kw)}
                        </span>
                      ))}
                    </div>
                  )}
                  {paper.category && (
                    <div className="artifact-preview-modal__paper-category">
                      {paper.category}
                    </div>
                  )}
                  {paper.abstract && (
                    <div className="artifact-preview-modal__paper-abstract">
                      {paper.abstract.length > 200 ? `${paper.abstract.slice(0, 200)}…` : paper.abstract}
                    </div>
                  )}
                  <div className="artifact-preview-modal__paper-actions">
                    {imported ? (
                      <span className="artifact-preview-modal__imported-badge">
                        {t(locale, "✓ 已导入", "✓ Imported")}
                      </span>
                    ) : (
                      <button
                        type="button"
                        className="artifact-preview-modal__import-btn"
                        onClick={() => void handleImportPaper(paper)}
                      >
                        {t(locale, "导入到文献库", "Import to Library")}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      );
    }

    /* JSON – Research Brief */
    if (ext === "json" && isResearchBrief(name) && parsedJson) {
      return <ResearchBriefView data={parsedJson} locale={locale} />;
    }

    /* JSON – Idea Board */
    if (ext === "json" && isIdeaBoard(name) && parsedJson) {
      return <IdeaBoardView data={parsedJson} locale={locale} />;
    }

    /* JSON – generic (tree view) */
    if (ext === "json" && parsedJson) {
      return (
        <div className="artifact-preview-modal__json-tree">
          <JsonTreeView data={parsedJson} depth={0} />
        </div>
      );
    }

    /* Fallback: raw text */
    return (
      <div className="artifact-preview-modal__raw">
        <pre>{content}</pre>
      </div>
    );
  }

  return (
    <div className="artifact-preview-modal" onClick={onClose}>
      <div
        className="artifact-preview-modal__panel"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="artifact-preview-modal__header">
          <div className="artifact-preview-modal__header-info">
            <span className="artifact-preview-modal__file-icon">
              {ext === "md" ? "📝" : ext === "json" ? "📊" : "📄"}
            </span>
            <span className="artifact-preview-modal__file-name">{name}</span>
            <span className="artifact-preview-modal__file-badge">{ext.toUpperCase()}</span>
          </div>
          <div className="artifact-preview-modal__header-actions">
            {ext === "md" && hasAltLang && (
              <button
                type="button"
                className="artifact-preview-modal__lang-toggle"
                onClick={() => setShowAltLang(!showAltLang)}
                title={showAltLang ? t(locale, "显示原文", "Show original") : t(locale, "切换语言", "Switch language")}
              >
                🌐 {showAltLang ? t(locale, "原文", "Original") : altLangLabel}
              </button>
            )}
            <button
              type="button"
              className="artifact-preview-modal__close-btn"
              onClick={onClose}
            >
              ×
            </button>
          </div>
        </div>
        <div className="artifact-preview-modal__body">
          {renderBody()}
        </div>
      </div>
    </div>
  );
}
