---
id: inno-experiment-dev
name: inno-experiment-dev
version: 1.0.0
description: |-
  Creates implementation plan, writes project code with judge feedback loop, and submits final experiment run.
stages: ["experiment"]
tools: ["read_file", "search_project", "write_file"]
summary: |-
  Creates implementation plan, writes project code with judge feedback loop, and submits final experiment run. Use after code-survey in both Idea and Plan branches.
primaryIntent: experiment
intents: ["experiment"]
capabilities: ["research-planning"]
domains: ["general"]
keywords: ["inno-experiment-dev", "experiment dev", "research-planning", "inno", "experiment", "dev", "creates", "implementation", "plan", "writes", "project", "code"]
source: builtin
status: verified
upstream:
  repo: dr-claw
  path: skills/inno-experiment-dev
  revision: 8322dc4ef575affaa374aa7922c0a0971c6db7d7
resourceFlags:
  hasReferences: true
  hasScripts: false
  hasTemplates: false
  hasAssets: false
  referenceCount: 3
  scriptCount: 0
  templateCount: 0
  assetCount: 0
  optionalScripts: false
---

# inno-experiment-dev

## Canonical Summary

Creates implementation plan, writes project code with judge feedback loop, and submits final experiment run. Use after code-survey in both Idea and Plan branches.

## Trigger Rules

Use this skill when the user request matches its research workflow scope. Prefer the bundled resources instead of recreating templates or reference material. Keep outputs traceable to project files, citations, scripts, or upstream evidence.

## Resource Use Rules

- Read from `references/` only when the current task needs the extra detail.

## Execution Contract

- Resolve every relative path from this skill directory first.
- Prefer inspection before mutation when invoking bundled scripts.
- If a required runtime, CLI, credential, or API is unavailable, explain the blocker and continue with the best manual fallback instead of silently skipping the step.
- Do not write generated artifacts back into the skill directory; save them inside the active project workspace.

## Upstream Instructions

# Inno Experiment Dev (Planning, Implementation, and Submission)

Merges the former `inno-implementation-plan`, `inno-ml-dev-iteration`, and the submit step of `inno-experiment-submit-refine`. Mirrors `_create_implementation_plan` (830-858), `_implement_and_iterate` (861-920), and the submit portion of `_submit_and_refine_experiments` (922-945) in `run_infer_idea_ours.py`.

## Inputs

| Variable | Source | Description |
|----------|--------|-------------|
| `survey_res` | inno-idea-generation or user | The finalized selected idea (or `refined_for_downstream`) |
| `references` | pipeline config | Pre-formatted string of source papers |
| `updated_prepare_res` | inno-prepare-resources | JSON with `reference_codebases` and `reference_paths` |
| `code_survey_res` | inno-code-survey | Comprehensive implementation report / model survey notes |
| `dataset_description` | from prepare step / context | Description of available datasets (not in instance.json) |
| `core_code` | instance.json `Experiment.core_code` | Absolute path when created by Dr. Claw (e.g. `<project_path>/Experiment/core_code`); use as-is or resolve with `path.join(project_path, value)` if relative |
| `code_references` | instance.json `Experiment.code_references` | Absolute path when created by Dr. Claw (e.g. `<project_path>/Experiment/code_references`); use as-is or resolve if relative |
| `max_iter_times` | pipeline config | Max judge-iteration rounds (default 2) |
| `context_variables` | shared state | Mutable dict carrying state across agents |

Plan mode additionally uses `ideas` and survey-specific prompt variants (`build_plan_query_with_survey`, `build_iteration_query_for_plan`, etc.).

## Outputs

| Variable | Description |
|----------|-------------|
| `plan_res` | Detailed implementation plan with dataset, model, training, and testing sections |
| `ml_dev_res` | Final ML Agent implementation result |
| `judge_res` | Final Judge Agent feedback |
| `judge_messages` | Full conversation thread (preserved for inno-experiment-analysis) |
| `submit_res` | Experiment submission result with statistical outputs |
| `context_variables` | Updated with `dataset_plan`, `training_plan`, `testing_plan`, `suggestion_dict`, `raw_error_stats` |

## Cache Artifacts

| File | Agent | Content |
|------|-------|---------|
| `Experiment/core_code/logs/coding_plan_agent.json` | Coding Plan Agent | `context_variables` + `messages` from planning phase |
| `Experiment/core_code/logs/machine_learning_agent.json` | ML Agent | Initial implementation messages (+ `_iter_{N}.json` for judge iterations) |
| `Experiment/core_code/logs/judge_agent.json` | Judge Agent | Evaluation messages (+ `_iter_{N}.json` for iterations) |
| `Experiment/core_code/logs/machine_learning_agent_iter_submit.json` | ML Agent | Submission run messages and results |

## Instructions

### Phase 1: Create Implementation Plan

Mirrors `_create_implementation_plan`.

1. **Optional pre-step (Idea mode only)**: If refining the idea for implementation clarity, call the idea refinement agent to produce `refined_for_downstream` with tensor interfaces and forward-pass sketch.

2. **Build plan query**:
   - **Idea mode**: `plan_query = build_plan_query(survey_res, references, updated_prepare_res, code_survey_res, dataset_description)` (see `prompts/build_plan_query.md`)
   - **Plan mode**: Use `build_plan_query_with_survey(ideas, references, prepare_res, code_survey_res, dataset_description)`

3. **Call Coding Plan Agent** with `messages = [{"role": "user", "content": plan_query}]`.
   - The agent reviews codebases using `tree` / `cat`, then creates structured plans via `plan_dataset`, `plan_training`, `plan_testing`.
   - Calls `case_resolved` to merge plans.
   - Set `plan_res = plan_messages[-1]["content"]`.
   - See `references/coding_plan_agent.md` for agent details.

4. **Verify** the plan has clear sections: dataset, model, training, evaluation, file layout.

### Phase 2: Implement and Iterate

Mirrors `_implement_and_iterate`.

5. **Initial implementation**: Build `ml_dev_query = build_ml_dev_query(survey_res, prepare_res, code_survey_res, plan_res, dataset_description, core_code, code_references)` (see `prompts/build_ml_dev_query.md`). Use paths from `instance.json`: `Experiment.core_code`, `Experiment.code_references` (absolute in Dr. Claw–created projects; use as-is or resolve with project path if relative). Call **ML Agent** with `messages = [{"role": "user", "content": ml_dev_query}]`. Set `ml_dev_res = ml_messages[-1]["content"]`.
   - See `references/ml_agent_instructions.md` for agent details.

6. **Initial judge evaluation**: Build `judge_query = build_judge_query(survey_res, prepare_res, plan_res, ml_dev_res)` (see `prompts/build_judge_query.md`). Call **Judge Agent** with `input_messages = [{"role": "user", "content": judge_query}]`. Set `judge_res = judge_messages[-1]["content"]`.
   - See `references/judge_agent_instructions.md` for agent details.

7. **Iteration loop** (for i in 0..max_iter_times - 1):
   a. Build `iteration_query = build_iteration_query(survey_res, prepare_res, code_survey_res, plan_res, ml_dev_res, judge_res, core_code, code_references)` (see `prompts/build_iteration_query.md`). Use paths from instance.json (absolute in Dr. Claw–created projects; use as-is or resolve if relative). Plan mode uses `build_iteration_query_for_plan`.
   b. Append as user message to `judge_messages`. Call **ML Agent** with `iter_times=i+1`. Update `ml_dev_res`.
   c. Build `judge_simple_query = build_judge_simple_query(survey_res, prepare_res, plan_res, ml_dev_res)` (see `prompts/build_judge_simple_query.md`). Plan mode uses `build_judge_simple_query_for_plan`.
   d. Append as user message to `judge_messages`. Call **Judge Agent** with `iter_times=i+1`. Update `judge_res`.
   e. If `"fully_correct": true` in last message, **break early**.

8. Preserve `judge_messages` for the submit step and for downstream `inno-experiment-analysis`.

### Phase 3: Submit Experiment

Mirrors the submit portion of `_submit_and_refine_experiments`.

9. **Build submit query**: `submit_query = build_submit_query(survey_res, ml_dev_res, judge_res, core_code)` (see `prompts/build_submit_query.md`). Resolve `core_code` from `instance.Experiment.core_code`. Plan mode uses `build_submit_query_for_plan`.

10. **Append** to `judge_messages` as user message. Call **ML Agent** with `iter_times="submit"`.
    - The agent adjusts epochs (3-10), runs `run_training_testing.py`, ensures checkpoints are saved.
    - Set `submit_res = judge_messages[-1]["content"]`.

11. If the implementation is not runnable, ML Agent calls `case_not_resolved`. Otherwise, `case_resolved` with statistical results and analysis.

## Tool Mappings

All custom Python tools map to Claude Code built-in capabilities:

| Original Tool | Claude Code Equivalent |
|---------------|----------------------|
| `execute_command` | Shell tool (direct execution) |
| `run_python` | `python <script>` via Shell tool |
| `create_file` / `write_file` | Write tool |
| `read_file` | Read tool or `cat <path>` |
| `create_directory` | `mkdir -p <path>` |
| `list_files` | `ls <path>` |
| `gen_code_tree_structure` | `tree -L 3 <path>` |
| `diagnose_code_error` | Analyze stderr output + inspect code |
| `rollback_and_reimplement` | Re-write file with different approach |
| `view_error_history` | Track error fingerprints in agent memory |
| `plan_dataset` / `plan_training` / `plan_testing` | Structure plan sections in agent response |
| `case_resolved` / `case_not_resolved` | Agent returns result / failure reason |

## Checklist

- [ ] Optional idea refinement applied if desired (Idea mode).
- [ ] Correct `build_plan_query` variant used for Idea vs Plan mode.
- [ ] Coding Plan Agent called; `plan_res` has clear dataset/model/training/testing sections.
- [ ] ML Agent initial implementation completed; `ml_dev_res` recorded.
- [ ] Judge Agent initial evaluation completed; `judge_res` recorded.
- [ ] Iteration loop runs with correct prompt variants; early exit on `fully_correct`.
- [ ] `judge_messages` preserved across all phases.
- [ ] Submit query appended to `judge_messages`; ML Agent submission run completed.
- [ ] Final model checkpoint saved to `Experiment/core_code/checkpoints/model_final.pth`.
- [ ] Cache artifacts saved to `Experiment/core_code/logs/`: `coding_plan_agent.json`, `machine_learning_agent.json`, `judge_agent.json`, `machine_learning_agent_iter_submit.json`.

## References

- `run_infer_idea_ours.py`: `_create_implementation_plan` (830-858), `_implement_and_iterate` (861-920), `_submit_and_refine_experiments` submit step (922-945)
- `prompt_templates.py`: `build_plan_query` (203-233), `build_ml_dev_query` (236-381), `build_judge_query` (384-417), `build_iteration_query` (420-468), `build_judge_simple_query` (471-494), `build_submit_query` (497-527)
- Agent definitions: `plan_agent.py`, `ml_agent.py`, `judge_agent.py` in `inno/agents/inno_agent/`
