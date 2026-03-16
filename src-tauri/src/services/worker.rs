use std::fs;
use std::path::{Path, PathBuf};

use anyhow::{anyhow, Context, Result};

use crate::state::AppState;

const TEMPLATE_FILES: [&str; 7] = [
    "package.json",
    "package-lock.json",
    "tsconfig.json",
    "wrangler.template.toml",
    "migrations",
    "scripts",
    "src",
];

pub fn prepare_worker_deploy_dir(state: &AppState, template_dir: &Path) -> Result<PathBuf> {
    validate_template_dir(template_dir)?;

    let target_dir = state
        .app_data_dir
        .join("cloudflare")
        .join("viewerleaf-worker");
    fs::create_dir_all(&target_dir).with_context(|| {
        format!(
            "failed to create worker deploy directory {}",
            target_dir.display()
        )
    })?;

    for relative in TEMPLATE_FILES {
        let source = template_dir.join(relative);
        let target = target_dir.join(relative);

        if target.is_dir() {
            fs::remove_dir_all(&target).with_context(|| {
                format!(
                    "failed to refresh staged worker directory {}",
                    target.display()
                )
            })?;
        } else if target.is_file() {
            fs::remove_file(&target).with_context(|| {
                format!("failed to refresh staged worker file {}", target.display())
            })?;
        }

        copy_path(&source, &target)?;
    }

    Ok(target_dir)
}

fn validate_template_dir(template_dir: &Path) -> Result<()> {
    for relative in TEMPLATE_FILES {
        let candidate = template_dir.join(relative);
        if candidate.exists() {
            continue;
        }
        return Err(anyhow!(
            "worker template is incomplete, missing {}",
            candidate.display()
        ));
    }

    Ok(())
}

fn copy_path(source: &Path, target: &Path) -> Result<()> {
    if source.is_dir() {
        fs::create_dir_all(target)
            .with_context(|| format!("failed to create {}", target.display()))?;
        for entry in
            fs::read_dir(source).with_context(|| format!("failed to read {}", source.display()))?
        {
            let entry = entry?;
            copy_path(&entry.path(), &target.join(entry.file_name()))?;
        }
        return Ok(());
    }

    if let Some(parent) = target.parent() {
        fs::create_dir_all(parent)
            .with_context(|| format!("failed to create {}", parent.display()))?;
    }

    fs::copy(source, target).with_context(|| {
        format!(
            "failed to copy worker template file {} -> {}",
            source.display(),
            target.display()
        )
    })?;

    Ok(())
}
