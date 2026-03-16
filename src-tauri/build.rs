use std::env;
use std::fs;
use std::io;
use std::path::{Path, PathBuf};

fn main() {
    stage_worker_template().expect("failed to stage worker template resources");
    tauri_build::build()
}

fn stage_worker_template() -> io::Result<()> {
    let manifest_dir =
        PathBuf::from(env::var("CARGO_MANIFEST_DIR").expect("CARGO_MANIFEST_DIR is missing"));
    let source_root = manifest_dir.join("../workers");
    let target_root = manifest_dir.join("resources/worker-template");

    let include_paths = [
        "package.json",
        "package-lock.json",
        "tsconfig.json",
        "wrangler.template.toml",
        "migrations",
        "scripts",
        "src",
    ];

    if target_root.exists() {
        fs::remove_dir_all(&target_root)?;
    }
    fs::create_dir_all(&target_root)?;

    for relative in include_paths {
        let source = source_root.join(relative);
        let target = target_root.join(relative);
        emit_rerun_markers(&source)?;
        copy_path(&source, &target)?;
    }

    Ok(())
}

fn emit_rerun_markers(path: &Path) -> io::Result<()> {
    println!("cargo:rerun-if-changed={}", path.display());
    if !path.is_dir() {
        return Ok(());
    }

    for entry in fs::read_dir(path)? {
        let entry = entry?;
        emit_rerun_markers(&entry.path())?;
    }

    Ok(())
}

fn copy_path(source: &Path, target: &Path) -> io::Result<()> {
    if source.is_dir() {
        fs::create_dir_all(target)?;
        for entry in fs::read_dir(source)? {
            let entry = entry?;
            copy_path(&entry.path(), &target.join(entry.file_name()))?;
        }
        return Ok(());
    }

    if let Some(parent) = target.parent() {
        fs::create_dir_all(parent)?;
    }
    fs::copy(source, target)?;
    Ok(())
}
