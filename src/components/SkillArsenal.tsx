import { useMemo, useState } from "react";
import { weaponSvg, BUILTIN_SKILLS } from "../lib/weaponPixels";
import { desktop } from "../lib/desktop";
import type { AcademicSkill, SkillManifest } from "../types";

interface SkillArsenalProps {
  skills: SkillManifest[];
  onToggleSkill: (skill: SkillManifest) => Promise<void>;
  onSkillAction?: (skill: AcademicSkill) => void;
  onSkillsChanged?: () => void;
  compact?: boolean;
}

type ResearchBundleId =
  | "survey"
  | "ideation"
  | "experiment"
  | "publication"
  | "promotion"
  | "utility";

const RESEARCH_BUNDLE_ORDER: ResearchBundleId[] = [
  "survey",
  "ideation",
  "experiment",
  "publication",
  "promotion",
  "utility",
];

const RESEARCH_BUNDLE_META: Record<ResearchBundleId, { title: string; description: string }> = {
  survey: {
    title: "领域调研与文献整理",
    description: "面向方向判断、真实文献检索、筛选与领域图谱整理。",
  },
  ideation: {
    title: "Idea 生成",
    description: "面向候选想法生成、novelty 检查与研究角度收敛。",
  },
  experiment: {
    title: "实验推进",
    description: "面向实验设计、实现计划、分析检查点与结果整理。",
  },
  publication: {
    title: "论文写作",
    description: "面向论文结构、证据映射、引用核验与投稿准备。",
  },
  promotion: {
    title: "成果传播",
    description: "面向 slides、摘要、release note 与后续展示材料。",
  },
  utility: {
    title: "通用工具",
    description: "未绑定科研阶段的工具或跨阶段能力。",
  },
};

function resolveResearchBundleId(manifest: SkillManifest): ResearchBundleId {
  const normalizedStages = (manifest.stages ?? []).map((stage) => stage.toLowerCase());
  for (const bundleId of RESEARCH_BUNDLE_ORDER) {
    if (bundleId !== "utility" && normalizedStages.includes(bundleId)) {
      return bundleId;
    }
  }
  return "utility";
}

export function SkillArsenal({ skills, onToggleSkill, onSkillAction, onSkillsChanged, compact = false }: SkillArsenalProps) {
  const [pending, setPending] = useState<string | null>(null);
  const [gitUrl, setGitUrl] = useState("");
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);

  const mappedSkills: AcademicSkill[] = skills.map((manifest) => {
    const enabled = manifest.isEnabled ?? manifest.enabled ?? false;
    const builtin = BUILTIN_SKILLS.find((candidate) => candidate.id === manifest.id);
    if (builtin) {
      return {
        ...builtin,
        description: manifest.summary || manifest.description || builtin.description,
        enabled,
      };
    }
    return {
      id: manifest.id,
      name: manifest.name ?? manifest.id,
      description: manifest.summary || manifest.description || "",
      weaponType: "blade" as const,
      themeColors: { primary: "#7c6f9f", secondary: "#3a3550", accent: "#c9b8ff" },
      actionLabel: "Use",
      enabled,
      isCustom: true,
    };
  });

  const manifestById = useMemo(
    () => new Map(skills.map((manifest) => [manifest.id, manifest])),
    [skills],
  );
  const groupedSkills = useMemo(() => {
    const groups = new Map<ResearchBundleId, AcademicSkill[]>();
    mappedSkills.forEach((skill) => {
      const manifest = manifestById.get(skill.id);
      const bundleId = manifest ? resolveResearchBundleId(manifest) : "utility";
      const current = groups.get(bundleId) ?? [];
      current.push(skill);
      groups.set(bundleId, current);
    });
    return RESEARCH_BUNDLE_ORDER
      .map((bundleId) => ({
        id: bundleId,
        ...RESEARCH_BUNDLE_META[bundleId],
        skills: (groups.get(bundleId) ?? []).sort((left, right) => left.name.localeCompare(right.name, "zh-CN")),
      }))
      .filter((group) => group.skills.length > 0);
  }, [manifestById, mappedSkills]);

  const isActive = (manifest: SkillManifest) =>
    manifest.isEnabled ?? manifest.enabled ?? false;

  const handleCardClick = async (skill: AcademicSkill) => {
    const manifest = skills.find((item) => item.id === skill.id);
    if (!manifest || pending === skill.id) return;
    setPending(skill.id);
    try {
      await onToggleSkill(manifest);
    } finally {
      setPending(null);
    }
  };

  const handleAction = (event: React.MouseEvent, skill: AcademicSkill) => {
    event.stopPropagation();
    onSkillAction?.(skill);
  };

  const handleImport = async () => {
    const url = gitUrl.trim();
    if (!url || importing) return;
    setImporting(true);
    setImportError(null);
    try {
      await desktop.importSkillFromGit(url);
      setGitUrl("");
      onSkillsChanged?.();
    } catch (error: unknown) {
      setImportError(error instanceof Error ? error.message : String(error));
    } finally {
      setImporting(false);
    }
  };

  const handleRemove = async (event: React.MouseEvent, skillId: string) => {
    event.stopPropagation();
    if (pending === skillId) return;
    setPending(skillId);
    try {
      await desktop.removeSkill(skillId);
      onSkillsChanged?.();
    } catch {
      // ignore
    } finally {
      setPending(null);
    }
  };

  const renderCard = (skill: AcademicSkill, index: number) => {
    const manifest = skills.find((item) => item.id === skill.id);
    const active = manifest ? isActive(manifest) : false;
    const iconSize = compact ? 32 : 48;
    const svg = weaponSvg(skill.weaponType, iconSize, skill.themeColors.primary, skill.themeColors.accent);

    return (
      <div
        key={skill.id}
        className={`arsenal-card arsenal-card-enter${active ? " arsenal-card--active" : ""}`}
        style={{
          animationDelay: `${index * 80}ms`,
          "--arsenal-primary": skill.themeColors.primary,
          "--arsenal-secondary": skill.themeColors.secondary,
          "--arsenal-accent": skill.themeColors.accent,
        } as React.CSSProperties}
        onClick={() => handleCardClick(skill)}
      >
        <div className="arsenal-icon" dangerouslySetInnerHTML={{ __html: svg }} />
        <span className="arsenal-name">{skill.name}</span>
        {!compact && <span className="arsenal-desc">{skill.description}</span>}
        {!compact && manifest ? (
          <div className="arsenal-meta">
            {manifest.stages?.slice(0, 2).map((stage) => (
              <span key={`${skill.id}-stage-${stage}`} className="arsenal-tag">
                {stage}
              </span>
            ))}
            {manifest.domains?.slice(0, 2).map((domain) => (
              <span key={`${skill.id}-domain-${domain}`} className="arsenal-tag arsenal-tag--soft">
                {domain}
              </span>
            ))}
            {manifest.resourceFlags?.hasScripts ? (
              <span className="arsenal-tag arsenal-tag--soft">scripts</span>
            ) : null}
            {manifest.resourceFlags?.hasTemplates ? (
              <span className="arsenal-tag arsenal-tag--soft">templates</span>
            ) : null}
            {manifest.status ? (
              <span className="arsenal-tag arsenal-tag--soft">{manifest.status}</span>
            ) : null}
          </div>
        ) : null}
        <button className="arsenal-action-btn" onClick={(event) => handleAction(event, skill)}>
          {skill.actionLabel}
        </button>
        {skill.isCustom ? (
          <button
            className="arsenal-remove-btn"
            title="删除此 Skill"
            onClick={(event) => handleRemove(event, skill.id)}
          >
            ×
          </button>
        ) : null}
      </div>
    );
  };

  return (
    <div className={`arsenal ${compact ? "arsenal--compact" : ""}`}>
      {!compact && (
        <div className="arsenal-import">
          <input
            className="arsenal-import-input"
            type="text"
            placeholder="输入 Git 仓库地址导入 Skill…"
            value={gitUrl}
            onChange={(event) => setGitUrl(event.target.value)}
            onKeyDown={(event) => event.key === "Enter" && handleImport()}
            disabled={importing}
          />
          <button
            className="arsenal-import-btn"
            onClick={handleImport}
            disabled={importing || !gitUrl.trim()}
          >
            {importing ? "导入中…" : "导入"}
          </button>
          {importError ? <div className="arsenal-import-error">{importError}</div> : null}
        </div>
      )}
      {groupedSkills.map((group) => (
        <section key={group.id} className="arsenal-bundle">
          {!compact ? (
            <div className="arsenal-bundle__header">
              <div>
                <h4>{group.title}</h4>
                <p>{group.description}</p>
              </div>
              <span className="arsenal-bundle__count">{group.skills.length}</span>
            </div>
          ) : (
            <div className="arsenal-bundle__compact-title">{group.title}</div>
          )}
          <div className="arsenal-grid">
            {group.skills.map((skill, index) => renderCard(skill, index))}
          </div>
        </section>
      ))}
      {skills.length === 0 && !compact ? (
        <div className="arsenal-empty">
          还没有安装任何 Skill，通过上方输入框从 Git 仓库导入。
        </div>
      ) : null}
    </div>
  );
}
