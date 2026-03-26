//! Lightweight polling watcher for research pipeline files.
//!
//! Monitors `.pipeline/tasks/tasks.json` and `.pipeline/docs/research_brief.json`
//! for external modifications and emits a Tauri event so the frontend can refresh
//! the research snapshot automatically.

use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::time::{Duration, SystemTime};

use tauri::{AppHandle, Emitter};

/// Interval between filesystem polls.
const POLL_INTERVAL: Duration = Duration::from_secs(2);

/// Minimum cooldown between successive emitted events to avoid flooding the
/// frontend when multiple files change in quick succession.
const EMIT_COOLDOWN: Duration = Duration::from_millis(500);

/// Tracked file paths relative to the project root.
const WATCHED_RELATIVE_PATHS: &[&str] = &[
    ".pipeline/tasks/tasks.json",
    ".pipeline/docs/research_brief.json",
];

static RUNNING: AtomicBool = AtomicBool::new(false);
static STOP_FLAG: AtomicBool = AtomicBool::new(false);

/// Guard that keeps the watcher's `RUNNING` flag synchronized.
struct WatcherGuard;
impl Drop for WatcherGuard {
    fn drop(&mut self) {
        RUNNING.store(false, Ordering::SeqCst);
    }
}

/// Cached mtime for a single file.
fn file_mtime(path: &Path) -> Option<SystemTime> {
    std::fs::metadata(path).ok().and_then(|m| m.modified().ok())
}

/// Start the polling watcher for the given project root.
///
/// If a watcher is already running it will be stopped first.
pub fn start_task_watcher(app_handle: &AppHandle, project_root: &Path) {
    // Signal any existing watcher to stop.
    stop_task_watcher();

    // Wait briefly for the previous thread to exit.
    for _ in 0..20 {
        if !RUNNING.load(Ordering::SeqCst) {
            break;
        }
        std::thread::sleep(Duration::from_millis(50));
    }

    STOP_FLAG.store(false, Ordering::SeqCst);
    RUNNING.store(true, Ordering::SeqCst);

    let app = app_handle.clone();
    let root = project_root.to_path_buf();

    std::thread::Builder::new()
        .name("task-watcher".into())
        .spawn(move || {
            let _guard = WatcherGuard;
            run_poll_loop(&app, &root);
        })
        .ok();
}

/// Signal the watcher thread to stop.
pub fn stop_task_watcher() {
    STOP_FLAG.store(true, Ordering::SeqCst);
}

fn run_poll_loop(app: &AppHandle, root: &Path) {
    let paths: Vec<PathBuf> = WATCHED_RELATIVE_PATHS
        .iter()
        .map(|rel| root.join(rel))
        .collect();

    // Seed initial mtimes.
    let mut mtimes: Vec<Option<SystemTime>> = paths.iter().map(|p| file_mtime(p)).collect();
    let mut last_emit = std::time::Instant::now() - EMIT_COOLDOWN;

    loop {
        if STOP_FLAG.load(Ordering::SeqCst) {
            break;
        }

        std::thread::sleep(POLL_INTERVAL);

        if STOP_FLAG.load(Ordering::SeqCst) {
            break;
        }

        let mut changed = false;
        for (i, path) in paths.iter().enumerate() {
            let current = file_mtime(path);
            if current != mtimes[i] {
                mtimes[i] = current;
                changed = true;
            }
        }

        if changed && last_emit.elapsed() >= EMIT_COOLDOWN {
            let _ = app.emit("research:snapshot-changed", ());
            last_emit = std::time::Instant::now();
        }
    }
}
