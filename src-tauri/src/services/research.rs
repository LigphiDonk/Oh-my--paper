use std::collections::{BTreeSet, HashMap};
use std::fs;
use std::path::{Path, PathBuf};

use anyhow::Result;
use serde::Deserialize;
use serde_json::{json, Value};
use walkdir::WalkDir;

use crate::models::{
    ResearchBootstrapState, ResearchCanvasSnapshot, ResearchStageSummary, ResearchTask,
    ResearchTaskCounts,
};

const STAGE_ORDER: [&str; 5] = [
    "survey",
    "ideation",
    "experiment",
    "publication",
    "promotion",
];

const AGENTS_TEMPLATE: &str = include_str!("../../../templates/research/AGENTS.md");
const CLAUDE_TEMPLATE: &str = include_str!("../../../templates/research/CLAUDE.md");
const RESEARCH_SCOPE_FIXTURE: &str = include_str!("../../../skills/research-scope.json");
const RESEARCH_STAGE_MAP_FIXTURE: &str = include_str!("../../../skills/research-stage-map.json");

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct PipelineMeta {
    start_stage: Option<String>,
    current_stage: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct BriefMeta {
    topic: Option<String>,
    goal: Option<String>,
    pipeline: Option<PipelineMeta>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct TasksEnvelope {
    tasks: Vec<ResearchTask>,
}

#[derive(Debug, Deserialize)]
struct ResearchScopeManifest {
    skills: Vec<String>,
}

#[derive(Debug, Deserialize, Clone, Default)]
struct StageSkillConfig {
    #[serde(default)]
    base: Vec<String>,
    #[serde(default, rename = "byTaskType")]
    by_task_type: HashMap<String, Vec<String>>,
}

fn normalize_stage(stage: Option<&str>) -> String {
    let Some(raw) = stage.map(str::trim).filter(|value| !value.is_empty()) else {
        return "survey".into();
    };
    let lowered = raw.to_ascii_lowercase();
    if STAGE_ORDER.contains(&lowered.as_str()) {
        lowered
    } else {
        "survey".into()
    }
}

fn stage_index(stage: &str) -> usize {
    STAGE_ORDER
        .iter()
        .position(|candidate| *candidate == stage)
        .unwrap_or_default()
}

fn stage_label(stage: &str) -> &'static str {
    match stage {
        "survey" => "Survey",
        "ideation" => "Ideation",
        "experiment" => "Experiment",
        "publication" => "Publication",
        "promotion" => "Promotion",
        _ => "Research",
    }
}

fn stage_description(stage: &str) -> &'static str {
    match stage {
        "survey" => "Collect traceable literature, screen the field, and stabilize the problem boundary.",
        "ideation" => "Turn the survey into a concrete angle, hypothesis, or position worth testing.",
        "experiment" => "Define implementation, datasets, metrics, ablations, and analysis checkpoints.",
        "publication" => "Move the validated state into the main LaTeX workspace and draft the paper.",
        "promotion" => "Prepare follow-up deliverables such as slides, summaries, and release notes.",
        _ => "Research workflow stage.",
    }
}

fn status_rank(status: &str) -> usize {
    match status {
        "in-progress" => 0,
        "pending" => 1,
        "review" => 2,
        "done" => 3,
        "deferred" => 4,
        "cancelled" => 5,
        _ => 6,
    }
}

fn task_is_open(task: &ResearchTask) -> bool {
    matches!(task.status.as_str(), "pending" | "in-progress" | "review" | "")
}

fn task_is_done(task: &ResearchTask) -> bool {
    task.status == "done"
}

fn dependency_satisfied(task: &ResearchTask, done_ids: &BTreeSet<String>) -> bool {
    task.dependencies.iter().all(|dependency| done_ids.contains(dependency))
}

fn research_root(root: &Path) -> PathBuf {
    root.join(".viewerleaf").join("research")
}

fn survey_root(root: &Path) -> PathBuf {
    research_root(root).join("Survey")
}

fn ideation_root(root: &Path) -> PathBuf {
    research_root(root).join("Ideation")
}

fn experiment_root(root: &Path) -> PathBuf {
    research_root(root).join("Experiment")
}

fn promotion_root(root: &Path) -> PathBuf {
    research_root(root).join("Promotion")
}

fn pipeline_root(root: &Path) -> PathBuf {
    root.join(".pipeline")
}

fn bundled_skills_root(app_root: &Path) -> PathBuf {
    app_root.join("skills")
}

fn write_if_missing(path: &Path, contents: &str) -> Result<()> {
    if path.exists() {
        return Ok(());
    }
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)?;
    }
    fs::write(path, contents)?;
    Ok(())
}

fn write_json_if_missing(path: &Path, value: &Value) -> Result<()> {
    if path.exists() {
        return Ok(());
    }
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)?;
    }
    fs::write(path, serde_json::to_string_pretty(value)?)?;
    Ok(())
}

fn copy_dir_contents(source: &Path, target: &Path) -> Result<()> {
    if !source.exists() {
        return Ok(());
    }
    if target.exists() {
        fs::remove_dir_all(target)?;
    }
    fs::create_dir_all(target)?;

    for entry in WalkDir::new(source).into_iter().filter_map(|entry| entry.ok()) {
        let relative = match entry.path().strip_prefix(source) {
            Ok(path) => path,
            Err(_) => continue,
        };
        if relative.as_os_str().is_empty() {
            continue;
        }
        let destination = target.join(relative);
        if entry.file_type().is_dir() {
            fs::create_dir_all(&destination)?;
            continue;
        }
        if let Some(parent) = destination.parent() {
            fs::create_dir_all(parent)?;
        }
        fs::copy(entry.path(), &destination)?;
    }

    Ok(())
}

fn relative_path(root: &Path, path: &Path) -> String {
    path.strip_prefix(root)
        .unwrap_or(path)
        .to_string_lossy()
        .replace('\\', "/")
}

fn collect_files_under(root: &Path, dir: &Path) -> Vec<String> {
    if !dir.exists() {
        return Vec::new();
    }
    let mut files = WalkDir::new(dir)
        .into_iter()
        .filter_map(|entry| entry.ok())
        .filter(|entry| entry.file_type().is_file())
        .map(|entry| relative_path(root, entry.path()))
        .collect::<Vec<_>>();
    files.sort();
    files
}

fn collect_publication_files(root: &Path) -> Vec<String> {
    let mut files = WalkDir::new(root)
        .into_iter()
        .filter_entry(|entry| {
            if entry.path() == root {
                return true;
            }
            let name = entry.file_name().to_string_lossy();
            !(entry.file_type().is_dir() && name.starts_with('.'))
        })
        .filter_map(|entry| entry.ok())
        .filter(|entry| entry.file_type().is_file())
        .filter_map(|entry| {
            let ext = entry
                .path()
                .extension()
                .and_then(|value| value.to_str())
                .unwrap_or_default()
                .to_ascii_lowercase();
            if matches!(ext.as_str(), "tex" | "bib") {
                Some(relative_path(root, entry.path()))
            } else {
                None
            }
        })
        .collect::<Vec<_>>();
    files.sort();
    files
}

fn default_research_brief(project_title: &str, start_stage: &str) -> Value {
    json!({
        "version": 1,
        "topic": project_title,
        "goal": "Turn this topic into a traceable research workflow inside ViewerLeaf.",
        "pipeline": {
            "startStage": start_stage,
            "currentStage": start_stage
        },
        "stageNotes": {
            "survey": "Collect traceable papers and define the research boundary.",
            "ideation": "Extract gaps, candidate contributions, and a viable angle.",
            "experiment": "Plan implementation, metrics, ablations, and analysis.",
            "publication": "Draft the paper in the main LaTeX workspace.",
            "promotion": "Prepare slides, summaries, and follow-up deliverables."
        }
    })
}

fn research_scope_skill_ids() -> Vec<String> {
    serde_json::from_str::<ResearchScopeManifest>(RESEARCH_SCOPE_FIXTURE)
        .map(|manifest| manifest.skills)
        .unwrap_or_default()
}

fn research_stage_map() -> HashMap<String, StageSkillConfig> {
    serde_json::from_str::<HashMap<String, StageSkillConfig>>(RESEARCH_STAGE_MAP_FIXTURE)
        .unwrap_or_default()
}

fn recommended_skills(stage: &str, task_type: &str) -> Vec<String> {
    let stage_map = research_stage_map();
    let Some(config) = stage_map.get(stage) else {
        return Vec::new();
    };

    let mut skills = config.base.clone();
    if let Some(by_task_type) = config.by_task_type.get(task_type) {
        skills.extend(by_task_type.clone());
    }
    skills.sort();
    skills.dedup();
    skills
}

fn build_next_action_prompt(stage: &str, task_type: &str, suggested_skills: &[String]) -> String {
    if suggested_skills.is_empty() {
        return "Review the current research state, update the project artifacts, and keep outputs traceable.".into();
    }

    let skill_list = suggested_skills
        .iter()
        .take(3)
        .cloned()
        .collect::<Vec<_>>()
        .join(", ");
    format!(
        "Use the suggested research skills ({skill_list}) to advance the {stage} stage with a {task_type} task, update the project artifacts, and keep outputs traceable."
    )
}

fn default_tasks(start_stage: &str) -> Vec<ResearchTask> {
    let all_tasks = vec![
        ResearchTask {
            id: "survey-1".into(),
            title: "Define the survey boundary".into(),
            description: "Clarify topic scope, target venue, and screening criteria.".into(),
            status: "pending".into(),
            stage: "survey".into(),
            priority: "high".into(),
            dependencies: vec![],
            task_type: "exploration".into(),
            inputs_needed: vec!["topic boundary".into(), "target venue".into()],
            suggested_skills: recommended_skills("survey", "exploration"),
            next_action_prompt: build_next_action_prompt(
                "survey",
                "exploration",
                &recommended_skills("survey", "exploration"),
            ),
            artifact_paths: vec![],
        },
        ResearchTask {
            id: "survey-2".into(),
            title: "Screen core literature".into(),
            description: "Keep traceable papers, baseline methods, and open gaps.".into(),
            status: "pending".into(),
            stage: "survey".into(),
            priority: "high".into(),
            dependencies: vec!["survey-1".into()],
            task_type: "analysis".into(),
            inputs_needed: vec!["seed paper list".into()],
            suggested_skills: recommended_skills("survey", "analysis"),
            next_action_prompt: build_next_action_prompt(
                "survey",
                "analysis",
                &recommended_skills("survey", "analysis"),
            ),
            artifact_paths: vec![],
        },
        ResearchTask {
            id: "ideation-1".into(),
            title: "Extract a publishable angle".into(),
            description: "Turn the survey into a concrete hypothesis or contribution.".into(),
            status: "pending".into(),
            stage: "ideation".into(),
            priority: "high".into(),
            dependencies: vec!["survey-2".into()],
            task_type: "analysis".into(),
            inputs_needed: vec!["gap summary".into()],
            suggested_skills: recommended_skills("ideation", "analysis"),
            next_action_prompt: build_next_action_prompt(
                "ideation",
                "analysis",
                &recommended_skills("ideation", "analysis"),
            ),
            artifact_paths: vec![],
        },
        ResearchTask {
            id: "experiment-1".into(),
            title: "Design the experiment plan".into(),
            description: "Define implementation scope, datasets, metrics, and ablations.".into(),
            status: "pending".into(),
            stage: "experiment".into(),
            priority: "high".into(),
            dependencies: vec!["ideation-1".into()],
            task_type: "implementation".into(),
            inputs_needed: vec!["chosen idea".into()],
            suggested_skills: recommended_skills("experiment", "implementation"),
            next_action_prompt: build_next_action_prompt(
                "experiment",
                "implementation",
                &recommended_skills("experiment", "implementation"),
            ),
            artifact_paths: vec![],
        },
        ResearchTask {
            id: "experiment-2".into(),
            title: "Prepare implementation and analysis notes".into(),
            description: "Break the experiment plan into build and analysis checkpoints.".into(),
            status: "pending".into(),
            stage: "experiment".into(),
            priority: "medium".into(),
            dependencies: vec!["experiment-1".into()],
            task_type: "analysis".into(),
            inputs_needed: vec!["experiment plan".into()],
            suggested_skills: recommended_skills("experiment", "analysis"),
            next_action_prompt: build_next_action_prompt(
                "experiment",
                "analysis",
                &recommended_skills("experiment", "analysis"),
            ),
            artifact_paths: vec![],
        },
        ResearchTask {
            id: "publication-1".into(),
            title: "Move into the paper workspace".into(),
            description: "Translate the validated research state into a paper-writing checklist.".into(),
            status: "pending".into(),
            stage: "publication".into(),
            priority: "high".into(),
            dependencies: vec!["experiment-2".into()],
            task_type: "writing".into(),
            inputs_needed: vec!["validated claims".into(), "figures".into()],
            suggested_skills: recommended_skills("publication", "writing"),
            next_action_prompt: build_next_action_prompt(
                "publication",
                "writing",
                &recommended_skills("publication", "writing"),
            ),
            artifact_paths: vec!["main.tex".into()],
        },
        ResearchTask {
            id: "promotion-1".into(),
            title: "Prepare downstream deliverables".into(),
            description: "Create slides, summaries, or release notes after the paper draft is stable.".into(),
            status: "pending".into(),
            stage: "promotion".into(),
            priority: "medium".into(),
            dependencies: vec!["publication-1".into()],
            task_type: "delivery".into(),
            inputs_needed: vec!["paper draft".into()],
            suggested_skills: recommended_skills("promotion", "delivery"),
            next_action_prompt: build_next_action_prompt(
                "promotion",
                "delivery",
                &recommended_skills("promotion", "delivery"),
            ),
            artifact_paths: vec![],
        },
    ];

    let start_index = stage_index(start_stage);
    all_tasks
        .into_iter()
        .filter(|task| stage_index(&task.stage) >= start_index)
        .collect()
}

fn default_pipeline_config(start_stage: &str) -> Value {
    json!({
        "version": 1,
        "startStage": start_stage,
        "intakeCompleted": true,
        "bootstrappedAt": iso_now()
    })
}

fn default_instance(root: &Path) -> Value {
    let root_string = root.to_string_lossy().to_string();
    json!({
        "instanceId": format!("viewerleaf-{}", root.file_name().and_then(|value| value.to_str()).unwrap_or("project")),
        "Survey": {
            "references": survey_root(root).join("references").to_string_lossy().to_string(),
            "reports": survey_root(root).join("reports").to_string_lossy().to_string()
        },
        "Ideation": {
            "ideas": ideation_root(root).join("ideas").to_string_lossy().to_string(),
            "references": ideation_root(root).join("references").to_string_lossy().to_string()
        },
        "Experiment": {
            "code_references": experiment_root(root).join("code_references").to_string_lossy().to_string(),
            "datasets": experiment_root(root).join("datasets").to_string_lossy().to_string(),
            "core_code": experiment_root(root).join("core_code").to_string_lossy().to_string(),
            "analysis": experiment_root(root).join("analysis").to_string_lossy().to_string()
        },
        "Publication": {
            "paper": root_string
        },
        "Promotion": {
            "homepage": promotion_root(root).join("homepage").to_string_lossy().to_string(),
            "slides": promotion_root(root).join("slides").to_string_lossy().to_string(),
            "audio": promotion_root(root).join("audio").to_string_lossy().to_string(),
            "video": promotion_root(root).join("video").to_string_lossy().to_string()
        }
    })
}

fn copy_bundled_skill_set(app_root: &Path, target_root: &Path) -> Result<()> {
    fs::create_dir_all(target_root)?;
    for skill_id in research_scope_skill_ids() {
        let source_dir = bundled_skills_root(app_root).join(&skill_id);
        if !source_dir.exists() {
            continue;
        }
        copy_dir_contents(&source_dir, &target_root.join(&skill_id))?;
    }
    Ok(())
}

fn write_skill_views(app_root: &Path, root: &Path) -> Result<()> {
    let skill_dirs = research_scope_skill_ids();

    let skills_index = {
        let mut lines = vec![
            "# Skills Index".to_string(),
            String::new(),
            "Read only the skill that matches the current task.".to_string(),
            String::new(),
        ];
        for skill_id in &skill_dirs {
            lines.push(format!("- `{skill_id}` -> `./{skill_id}/SKILL.md`"));
        }
        lines.join("\n")
    };

    for base in [
        root.join(".agents").join("skills"),
        root.join(".claude").join("skills"),
        root.join(".codex").join("skills"),
    ] {
        fs::create_dir_all(&base)?;
        fs::write(base.join("skills-index.md"), &skills_index)?;
        copy_bundled_skill_set(app_root, &base)?;
    }

    Ok(())
}

fn write_templates(root: &Path) -> Result<()> {
    write_if_missing(&root.join("AGENTS.md"), AGENTS_TEMPLATE)?;
    write_if_missing(&root.join("CLAUDE.md"), CLAUDE_TEMPLATE)?;
    Ok(())
}

pub fn project_skill_roots(root: &Path) -> Vec<PathBuf> {
    vec![
        root.join(".agents").join("skills"),
        root.join(".claude").join("skills"),
        root.join("skills"),
    ]
}

pub fn ensure_research_scaffold(app_root: &Path, root: &Path, start_stage: Option<&str>) -> Result<()> {
    let start_stage = normalize_stage(start_stage);

    fs::create_dir_all(survey_root(root).join("references"))?;
    fs::create_dir_all(survey_root(root).join("reports"))?;
    fs::create_dir_all(ideation_root(root).join("ideas"))?;
    fs::create_dir_all(ideation_root(root).join("references"))?;
    fs::create_dir_all(experiment_root(root).join("code_references"))?;
    fs::create_dir_all(experiment_root(root).join("datasets"))?;
    fs::create_dir_all(experiment_root(root).join("core_code"))?;
    fs::create_dir_all(experiment_root(root).join("analysis"))?;
    fs::create_dir_all(promotion_root(root).join("homepage"))?;
    fs::create_dir_all(promotion_root(root).join("slides"))?;
    fs::create_dir_all(promotion_root(root).join("audio"))?;
    fs::create_dir_all(promotion_root(root).join("video"))?;
    fs::create_dir_all(pipeline_root(root).join("docs"))?;
    fs::create_dir_all(pipeline_root(root).join("tasks"))?;

    write_templates(root)?;
    copy_bundled_skill_set(app_root, &root.join("skills"))?;
    write_skill_views(app_root, root)?;

    let project_title = root
        .file_name()
        .and_then(|value| value.to_str())
        .unwrap_or("ViewerLeaf Project");

    write_json_if_missing(&root.join("instance.json"), &default_instance(root))?;
    write_json_if_missing(
        &pipeline_root(root).join("config.json"),
        &default_pipeline_config(&start_stage),
    )?;
    write_json_if_missing(
        &pipeline_root(root).join("docs").join("research_brief.json"),
        &default_research_brief(project_title, &start_stage),
    )?;
    write_json_if_missing(
        &pipeline_root(root).join("tasks").join("tasks.json"),
        &json!({
            "version": 1,
            "tasks": default_tasks(&start_stage),
        }),
    )?;

    Ok(())
}

#[cfg(test)]
fn read_json_file(path: &Path) -> Option<Value> {
    let raw = fs::read_to_string(path).ok()?;
    serde_json::from_str::<Value>(&raw).ok()
}

fn read_brief(path: &Path) -> Option<(Value, BriefMeta)> {
    let raw = fs::read_to_string(path).ok()?;
    let value = serde_json::from_str::<Value>(&raw).ok()?;
    let meta = serde_json::from_value::<BriefMeta>(value.clone()).ok()?;
    Some((value, meta))
}

fn read_tasks(path: &Path) -> Vec<ResearchTask> {
    let Ok(raw) = fs::read_to_string(path) else {
        return Vec::new();
    };

    if let Ok(envelope) = serde_json::from_str::<TasksEnvelope>(&raw) {
        return envelope.tasks;
    }

    serde_json::from_str::<Vec<ResearchTask>>(&raw).unwrap_or_default()
}

pub fn load_research_snapshot(root: &Path) -> Result<ResearchCanvasSnapshot> {
    let brief_path = pipeline_root(root).join("docs").join("research_brief.json");
    let tasks_path = pipeline_root(root).join("tasks").join("tasks.json");
    let has_instance = root.join("instance.json").exists();
    let has_templates = root.join("AGENTS.md").exists() && root.join("CLAUDE.md").exists();
    let has_skill_views = root.join(".agents").join("skills").exists() && root.join(".claude").join("skills").exists();
    let has_brief = brief_path.exists();
    let has_tasks = tasks_path.exists();
    let has_any_scaffold = has_instance || has_templates || has_skill_views || has_brief || has_tasks;

    let bootstrap = {
        let (status, message) = if !has_any_scaffold {
            (
                "needs-bootstrap",
                "This project has no research workflow scaffold yet.",
            )
        } else if !has_brief {
            (
                "missing-brief",
                "The research scaffold exists but the research brief is missing.",
            )
        } else if !has_tasks {
            (
                "missing-tasks",
                "The research scaffold exists but the task list is missing.",
            )
        } else if !has_templates || !has_skill_views || !has_instance {
            (
                "partial",
                "The research scaffold is only partially available and can be repaired.",
            )
        } else {
            ("ready", "Research workflow is ready.")
        };

        ResearchBootstrapState {
            status: status.into(),
            message: message.into(),
            has_instance,
            has_templates,
            has_skill_views,
            has_brief,
            has_tasks,
        }
    };

    let brief = read_brief(&brief_path);
    let brief_value = brief.as_ref().map(|(value, _)| value.clone());
    let brief_topic = brief
        .as_ref()
        .and_then(|(_, meta)| meta.topic.clone())
        .unwrap_or_else(|| {
            root.file_name()
                .and_then(|value| value.to_str())
                .unwrap_or("ViewerLeaf Project")
                .to_string()
        });
    let brief_goal = brief
        .as_ref()
        .and_then(|(_, meta)| meta.goal.clone())
        .unwrap_or_else(|| "Turn this topic into a traceable research workflow.".into());
    let start_stage = brief
        .as_ref()
        .and_then(|(_, meta)| meta.pipeline.as_ref())
        .and_then(|pipeline| pipeline.start_stage.as_deref())
        .map(Some)
        .map(normalize_stage)
        .unwrap_or_else(|| "survey".into());

    let mut tasks = read_tasks(&tasks_path)
        .into_iter()
        .map(|mut task| {
            if task.status.trim().is_empty() {
                task.status = "pending".into();
            }
            task.stage = normalize_stage(Some(&task.stage));
            task
        })
        .collect::<Vec<_>>();
    tasks.sort_by(|left, right| {
        stage_index(&left.stage)
            .cmp(&stage_index(&right.stage))
            .then(status_rank(&left.status).cmp(&status_rank(&right.status)))
            .then(left.id.cmp(&right.id))
    });

    let mut artifact_paths = HashMap::new();
    artifact_paths.insert("survey".into(), collect_files_under(root, &survey_root(root)));
    artifact_paths.insert("ideation".into(), collect_files_under(root, &ideation_root(root)));
    artifact_paths.insert(
        "experiment".into(),
        collect_files_under(root, &experiment_root(root)),
    );
    artifact_paths.insert("publication".into(), collect_publication_files(root));
    artifact_paths.insert("promotion".into(), collect_files_under(root, &promotion_root(root)));

    let done_ids = tasks
        .iter()
        .filter(|task| task_is_done(task))
        .map(|task| task.id.clone())
        .collect::<BTreeSet<_>>();

    let next_task = tasks
        .iter()
        .find(|task| task.status == "in-progress")
        .cloned()
        .or_else(|| {
            tasks.iter()
                .find(|task| task.status == "review")
                .cloned()
        })
        .or_else(|| {
            tasks.iter()
                .find(|task| task.status == "pending" && dependency_satisfied(task, &done_ids))
                .cloned()
        })
        .or_else(|| tasks.iter().find(|task| task_is_open(task)).cloned());

    let current_stage = next_task
        .as_ref()
        .map(|task| task.stage.clone())
        .or_else(|| {
            brief.as_ref()
                .and_then(|(_, meta)| meta.pipeline.as_ref())
                .and_then(|pipeline| pipeline.current_stage.as_deref())
                .map(Some)
                .map(normalize_stage)
        })
        .unwrap_or_else(|| start_stage.clone());

    let current_stage_index = stage_index(&current_stage);
    let stage_summaries = STAGE_ORDER
        .iter()
        .map(|stage| {
            let stage_tasks = tasks
                .iter()
                .filter(|task| task.stage == *stage)
                .cloned()
                .collect::<Vec<_>>();
            let mut counts = ResearchTaskCounts::default();
            counts.total = stage_tasks.len();
            for task in &stage_tasks {
                match task.status.as_str() {
                    "done" => counts.done += 1,
                    "in-progress" => counts.in_progress += 1,
                    "review" => counts.review += 1,
                    _ => counts.pending += 1,
                }
            }

            let missing_inputs = stage_tasks
                .iter()
                .flat_map(|task| task.inputs_needed.iter().cloned())
                .collect::<BTreeSet<_>>()
                .into_iter()
                .collect::<Vec<_>>();
            let suggested_skills = stage_tasks
                .iter()
                .flat_map(|task| task.suggested_skills.iter().cloned())
                .collect::<BTreeSet<_>>()
                .into_iter()
                .collect::<Vec<_>>();
            let stage_artifacts = artifact_paths
                .get(*stage)
                .cloned()
                .unwrap_or_default();
            let next_task_id = stage_tasks
                .iter()
                .find(|task| task_is_open(task))
                .map(|task| task.id.clone());
            let stage_status = if counts.total > 0 && counts.done == counts.total {
                "complete"
            } else if *stage == current_stage {
                "active"
            } else if stage_index(stage) < current_stage_index {
                "complete"
            } else if counts.total > 0 {
                "queued"
            } else {
                "idle"
            };

            ResearchStageSummary {
                stage: (*stage).into(),
                label: stage_label(stage).into(),
                description: stage_description(stage).into(),
                status: stage_status.into(),
                total_tasks: counts.total,
                done_tasks: counts.done,
                artifact_count: stage_artifacts.len(),
                artifact_paths: stage_artifacts,
                missing_inputs,
                suggested_skills,
                next_task_id,
                task_counts: counts,
            }
        })
        .collect::<Vec<_>>();

    Ok(ResearchCanvasSnapshot {
        bootstrap,
        brief: brief_value,
        tasks,
        current_stage: current_stage.clone(),
        next_task: next_task.clone(),
        stage_summaries,
        artifact_paths,
        handoff_to_writing: current_stage == "publication"
            || next_task
                .as_ref()
                .map(|task| task.stage == "publication")
                .unwrap_or(false),
        pipeline_root: relative_path(root, &pipeline_root(root)),
        instance_path: root
            .join("instance.json")
            .exists()
            .then(|| "instance.json".to_string()),
        brief_topic,
        brief_goal,
    })
}

fn iso_now() -> String {
    use std::time::{SystemTime, UNIX_EPOCH};

    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_secs().to_string())
        .unwrap_or_else(|_| "0".into())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn make_temp_project(name: &str) -> PathBuf {
        let dir = std::env::temp_dir().join(format!("viewerleaf-{name}-{}", iso_now()));
        fs::create_dir_all(&dir).expect("failed to create temp dir");
        dir
    }

    fn make_app_root() -> PathBuf {
        let dir = std::env::temp_dir().join(format!("viewerleaf-app-root-{}", iso_now()));
        fs::create_dir_all(dir.join("skills")).expect("failed to create app skills dir");
        for skill_id in research_scope_skill_ids() {
            let skill_dir = dir.join("skills").join(&skill_id);
            fs::create_dir_all(&skill_dir).expect("failed to create skill dir");
            fs::write(
                skill_dir.join("SKILL.md"),
                format!(
                    "---\nid: {skill_id}\nname: {skill_id}\nsummary: summary\nstages: [\"survey\"]\n---\n\n# {skill_id}\n"
                ),
            )
            .expect("failed to write skill");
        }
        dir
    }

    #[test]
    fn scaffold_is_idempotent_and_preserves_main_tex() {
        let root = make_temp_project("research-idempotent");
        let app_root = make_app_root();
        fs::create_dir_all(root.join(".viewerleaf")).expect("viewerleaf dir");
        fs::write(root.join("main.tex"), "% existing main tex").expect("main tex");

        ensure_research_scaffold(&app_root, &root, Some("survey")).expect("first scaffold");
        ensure_research_scaffold(&app_root, &root, Some("publication")).expect("second scaffold");

        let main_tex = fs::read_to_string(root.join("main.tex")).expect("read main tex");
        assert_eq!(main_tex, "% existing main tex");
        assert!(root.join("AGENTS.md").exists());
        assert!(root.join("CLAUDE.md").exists());
        assert!(root.join(".viewerleaf/research/Survey/references").exists());
        assert!(root.join(".pipeline/docs/research_brief.json").exists());
        assert!(root.join(".pipeline/tasks/tasks.json").exists());
        assert!(root.join("instance.json").exists());
    }

    #[test]
    fn publication_points_to_project_root() {
        let root = make_temp_project("research-instance");
        let app_root = make_app_root();
        ensure_research_scaffold(&app_root, &root, Some("publication")).expect("scaffold");

        let instance = read_json_file(&root.join("instance.json")).expect("instance json");
        let publication = instance
            .get("Publication")
            .and_then(|value| value.get("paper"))
            .and_then(|value| value.as_str())
            .expect("publication paper path");

        assert_eq!(publication, root.to_string_lossy());
    }

    #[test]
    fn snapshot_derives_ready_state_and_stage_summary() {
        let root = make_temp_project("research-snapshot");
        let app_root = make_app_root();
        ensure_research_scaffold(&app_root, &root, Some("publication")).expect("scaffold");

        let snapshot = load_research_snapshot(&root).expect("research snapshot");
        assert_eq!(snapshot.bootstrap.status, "ready");
        assert_eq!(snapshot.current_stage, "publication");
        assert!(snapshot.handoff_to_writing);
        assert_eq!(snapshot.stage_summaries.len(), STAGE_ORDER.len());
    }

    #[test]
    fn recommendations_use_stage_map() {
        let skills = recommended_skills("publication", "writing");
        assert!(skills.iter().any(|skill| skill == "inno-paper-writing"));
        assert!(skills.iter().any(|skill| skill == "ml-paper-writing"));
    }
}
