import { useState } from "react";
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

export function SkillArsenal({ skills, onToggleSkill, onSkillAction, onSkillsChanged, compact = false }: SkillArsenalProps) {
  const [pending, setPending] = useState<string | null>(null);
  const [gitUrl, setGitUrl] = useState("");
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);

  const mappedSkills: AcademicSkill[] = skills.map((manifest) => {
    const enabled = manifest.isEnabled ?? manifest.enabled ?? false;
    const builtin = BUILTIN_SKILLS.find((b) => b.id === manifest.id);
    if (builtin) return { ...builtin, enabled };
    return {
      id: manifest.id,
      name: manifest.name ?? manifest.id,
      description: "",
      weaponType: "blade" as const,
      themeColors: { primary: "#7c6f9f", secondary: "#3a3550", accent: "#c9b8ff" },
      actionLabel: "Use",
      enabled,
      isCustom: true,
    };
  });

  const isActive = (manifest: SkillManifest) =>
    manifest.isEnabled ?? manifest.enabled ?? false;

  const handleCardClick = async (skill: AcademicSkill) => {
    const manifest = skills.find((s) => s.id === skill.id);
    if (!manifest || pending === skill.id) return;
    setPending(skill.id);
    try {
      await onToggleSkill(manifest);
    } finally {
      setPending(null);
    }
  };

  const handleAction = (e: React.MouseEvent, skill: AcademicSkill) => {
    e.stopPropagation();
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
    } catch (err: unknown) {
      setImportError(err instanceof Error ? err.message : String(err));
    } finally {
      setImporting(false);
    }
  };

  const handleRemove = async (e: React.MouseEvent, skillId: string) => {
    e.stopPropagation();
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

  return (
    <div className={`arsenal ${compact ? "arsenal--compact" : ""}`}>
      {!compact && (
        <div className="arsenal-import">
          <input
            className="arsenal-import-input"
            type="text"
            placeholder="输入 Git 仓库地址导入 Skill…"
            value={gitUrl}
            onChange={(e) => setGitUrl(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleImport()}
            disabled={importing}
          />
          <button
            className="arsenal-import-btn"
            onClick={handleImport}
            disabled={importing || !gitUrl.trim()}
          >
            {importing ? "导入中…" : "导入"}
          </button>
          {importError && <div className="arsenal-import-error">{importError}</div>}
        </div>
      )}
      <div className="arsenal-grid">
        {mappedSkills.map((skill, index) => {
          const manifest = skills.find((s) => s.id === skill.id);
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
              <button
                className="arsenal-action-btn"
                onClick={(e) => handleAction(e, skill)}
              >
                {skill.actionLabel}
              </button>
              {skill.isCustom && (
                <button
                  className="arsenal-remove-btn"
                  title="删除此 Skill"
                  onClick={(e) => handleRemove(e, skill.id)}
                >
                  ×
                </button>
              )}
            </div>
          );
        })}
      </div>
      {skills.length === 0 && !compact && (
        <div className="arsenal-empty">
          还没有安装任何 Skill，通过上方输入框从 Git 仓库导入。
        </div>
      )}
    </div>
  );
}
