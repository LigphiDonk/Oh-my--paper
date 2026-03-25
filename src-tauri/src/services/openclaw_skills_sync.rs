//! OpenClaw ←→ viwerleaf skill synchronization.
//!
//! Creates symlinks from the viwerleaf `skills/` directory to the
//! OpenClaw workspace skills directory, enabling the Pi agent to
//! discover and use all existing research skills.

use std::fs;
use std::path::Path;

/// Sync viwerleaf skills into the OpenClaw workspace.
///
/// For each skill directory in `skills_dir`, creates a symlink in
/// `~/.openclaw/workspace/skills/` pointing back to the original.
pub fn sync_skills_to_openclaw(skills_dir: &Path) -> Result<(), String> {
    let home = dirs::home_dir().ok_or("Could not determine home directory")?;
    let oc_skills_dir = home.join(".openclaw").join("workspace").join("skills");
    fs::create_dir_all(&oc_skills_dir)
        .map_err(|e| format!("Failed to create OpenClaw skills dir: {e}"))?;

    let entries = fs::read_dir(skills_dir)
        .map_err(|e| format!("Failed to read skills dir: {e}"))?;

    let mut synced = 0;
    for entry in entries.flatten() {
        let path = entry.path();
        if !path.is_dir() {
            continue;
        }

        // Check if this directory contains a SKILL.md
        let skill_md = path.join("SKILL.md");
        if !skill_md.exists() {
            continue;
        }

        let skill_name = path
            .file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("unknown");

        let link_path = oc_skills_dir.join(skill_name);

        // Remove existing symlink if stale
        if link_path.is_symlink() {
            let _ = fs::remove_file(&link_path);
        }

        // Only create if target doesn't already exist
        if !link_path.exists() {
            #[cfg(unix)]
            {
                std::os::unix::fs::symlink(&path, &link_path)
                    .map_err(|e| format!("Failed to symlink skill {skill_name}: {e}"))?;
            }
            #[cfg(windows)]
            {
                std::os::windows::fs::symlink_dir(&path, &link_path)
                    .map_err(|e| format!("Failed to symlink skill {skill_name}: {e}"))?;
            }
            synced += 1;
        }
    }

    eprintln!("[OpenClaw Skills] Synced {synced} skills to ~/.openclaw/workspace/skills/");
    Ok(())
}

/// Remove all viwerleaf-created symlinks from the OpenClaw workspace.
pub fn unsync_skills() -> Result<(), String> {
    let home = dirs::home_dir().ok_or("Could not determine home directory")?;
    let oc_skills_dir = home.join(".openclaw").join("workspace").join("skills");
    if !oc_skills_dir.exists() {
        return Ok(());
    }

    let entries = fs::read_dir(&oc_skills_dir)
        .map_err(|e| format!("Failed to read OpenClaw skills dir: {e}"))?;

    for entry in entries.flatten() {
        let path = entry.path();
        if path.is_symlink() {
            let _ = fs::remove_file(&path);
        }
    }

    Ok(())
}
