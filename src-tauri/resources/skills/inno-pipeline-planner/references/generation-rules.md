# Generation Rules

Shared rules for generating pipeline files.

## Directory layout

```text
.pipeline/
  config.json
  docs/
    research_brief.json
  tasks/
    tasks.json
```

## `.pipeline/config.json`

Create when missing:

```json
{
  "version": "1.0",
  "provider": "dr-claw-web",
  "initializedAt": "<ISO timestamp>"
}
```

## Brief generation rules

- Fill content from user conversation and existing project files only.
- Leave unknown fields as empty string or empty array.
- Set `pipeline.mode`:
  - Use `"plan"` when user provides concrete method/architecture/training plan.
  - Use `"idea"` otherwise.
- Set `pipeline.startStage`:
  - Use `"survey"` (default) when user is starting from scratch or needs literature review first.
  - Use `"ideation"` when the user already has enough literature context and needs to shape a direction.
  - Use `"experiment"` when user already has a research idea, problem framing, and success criteria.
  - Use `"publication"` when user already has experimental results and analysis.
  - Use `"promotion"` when user already has a manuscript or publication draft and mainly needs presentation or dissemination assets.
- Make `task_blueprints` and `quality_gate` domain-specific to the topic.
- For skipped stages (before `startStage`): still populate `sections.*` with whatever context the user provided, but `task_blueprints` in those stages will not produce tasks.

## Task generation rules

Stage order: `survey` < `ideation` < `experiment` < `publication` < `promotion`.

1. **Only generate tasks for stages >= `pipeline.startStage`**. Skip earlier stages entirely during task generation.
2. Create tasks from each active stage's `task_blueprints`.
3. Create define/refine tasks for each `required_element` in active stages:
   - Use `Define <field>` when empty.
   - Use `Refine <field>` when already populated.
4. Add one quality-gate review task at the end of each active stage with `quality_gate`.
5. Order tasks by execution flow:
   - exploration -> implementation -> analysis -> writing -> scripting/rendering/narration/delivery
6. Add dependencies when obvious (for example, implementation depends on exploration in the same stage).

## `nextActionPrompt` template

```text
Task: <task title>
Stage: <stage>
User inputs: <relevant extracted values from research_brief.json>
Suggested skills: <comma-separated skills>
Quality gate: <gate items if relevant>
Stage guidance: <short stage-specific instruction>
Please produce a concrete next-step plan and execution output. If user inputs are provided, polish and make them concrete, then write updates back to .pipeline/docs/research_brief.json.
```
