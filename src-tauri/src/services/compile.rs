use anyhow::Result;
use regex::Regex;
use std::path::Path;
use std::process::Command;

use crate::models::{CompileResult, Diagnostic};
use crate::services::enriched_path;
use crate::state::AppState;

fn parse_diagnostics(output: &str) -> Vec<Diagnostic> {
    let file_line = Regex::new(r"(?m)^(\./)?(?P<file>[^:\n]+):(?P<line>\d+): (?P<message>.+)$")
        .expect("valid regex");
    let latex_warning =
        Regex::new(r"(?m)^LaTeX Warning: (?P<message>.+?)(?: on input line (?P<line>\d+))?$")
            .expect("valid regex");

    let mut diagnostics = Vec::new();

    for caps in file_line.captures_iter(output) {
        diagnostics.push(Diagnostic {
            file_path: caps["file"].to_string(),
            line: caps["line"].parse::<usize>().unwrap_or(1),
            level: "error".into(),
            message: caps["message"].to_string(),
        });
    }

    for caps in latex_warning.captures_iter(output) {
        diagnostics.push(Diagnostic {
            file_path: "main.tex".into(),
            line: caps
                .name("line")
                .and_then(|line| line.as_str().parse::<usize>().ok())
                .unwrap_or(1),
            level: "warning".into(),
            message: caps["message"].trim().to_string(),
        });
    }

    diagnostics
}

pub fn compile_project(state: &AppState, file_path: &str) -> Result<CompileResult> {
    let store = state.store.read().expect("store lock poisoned");
    let root_path = store.project_config.root_path.clone();
    let main_tex = store.project_config.main_tex.clone();
    let engine = store.project_config.engine.clone();
    drop(store);

    let root = Path::new(&root_path);
    let engine_flag = match engine.as_str() {
        "pdflatex" => "-pdf",
        "lualatex" => "-lualatex",
        _ => "-xelatex",
    };

    let output = match Command::new("latexmk")
        .args([
            engine_flag,
            "-synctex=1",
            "-interaction=nonstopmode",
            "-file-line-error",
            &main_tex,
        ])
        .env("PATH", enriched_path())
        .current_dir(root)
        .output()
    {
        Ok(output) => output,
        Err(err) => {
            let result = failed_compile_result(
                root,
                &main_tex,
                format!("failed to run latexmk for {file_path}: {err}"),
            );

            let mut store = state.store.write().expect("store lock poisoned");
            store.last_compile = result.clone();
            return Ok(result);
        }
    };

    let stdout = String::from_utf8_lossy(&output.stdout);
    let stderr = String::from_utf8_lossy(&output.stderr);
    let log_output = format!("{stdout}\n{stderr}");
    let diagnostics = parse_diagnostics(&log_output);
    let pdf_path = root.join(main_tex.replace(".tex", ".pdf"));
    let synctex_path = root.join(main_tex.replace(".tex", ".synctex.gz"));

    let result = CompileResult {
        status: if output.status.success() {
            "success".into()
        } else {
            "failed".into()
        },
        pdf_path: Some(pdf_path.to_string_lossy().to_string()),
        synctex_path: Some(synctex_path.to_string_lossy().to_string()),
        diagnostics,
        log_path: root
            .join(".viewerleaf/logs/latest.log")
            .to_string_lossy()
            .to_string(),
        log_output,
        timestamp: format!("{:?}", std::time::SystemTime::now()),
    };

    let mut store = state.store.write().expect("store lock poisoned");
    store.last_compile = result.clone();
    Ok(result)
}

fn failed_compile_result(root: &Path, main_tex: &str, log_output: String) -> CompileResult {
    CompileResult {
        status: "failed".into(),
        pdf_path: Some(root.join(main_tex.replace(".tex", ".pdf")).to_string_lossy().to_string()),
        synctex_path: Some(
            root.join(main_tex.replace(".tex", ".synctex.gz"))
                .to_string_lossy()
                .to_string(),
        ),
        diagnostics: parse_diagnostics(&log_output),
        log_path: root
            .join(".viewerleaf/logs/latest.log")
            .to_string_lossy()
            .to_string(),
        log_output,
        timestamp: format!("{:?}", std::time::SystemTime::now()),
    }
}
