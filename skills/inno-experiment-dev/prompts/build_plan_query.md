# build_plan_query

Constructs the prompt for the Coding Plan Agent to create a detailed implementation plan.

## Parameters

| Parameter             | Type   | Description |
|-----------------------|--------|-------------|
| `survey_res`          | string | The finalized selected idea (from `selected_idea.txt` or `final_selected_idea_data`) |
| `references`          | string | Pre-formatted string listing all source papers |
| `prepare_res`         | string | JSON with `reference_codebases` and `reference_paths` (from `inno-prepare-resources`) |
| `code_survey_res`     | string | Comprehensive implementation report (from `inno-code-survey` Phase B, stored as `model_survey`) |
| `dataset_description` | string | Description of available datasets |

## Template

```
I have an innovative ideas related to machine learning:
{survey_res}
And a list of papers for your reference:
{references}

I have carefully gone through these papers' github repositories and found download some of them in my local machine, with the following information:
{prepare_res}

I have also understood the innovative idea, comprehensively reviewed the codebases, and generated a comprehensive implementation report:
{code_survey_res}

We have already selected the following datasets as experimental datasets:
{dataset_description}

Your task is to carefully review the existing resources and understand the task, and give me a detailed plan for the implementation.
```

## Usage

This is sent as the **first message** to the Coding Plan Agent. The agent will:
1. Review all codebases using `tree`, `cat`, etc.
2. Create structured plans with sections:
   - `dataset_plan`: description, location, task definition, data processing pipeline
   - `training_plan`: pipeline code, loss function, optimizer, configurations, logging
   - `testing_plan`: metrics, test data, test function
3. Call `case_resolved` to finalize the merged plan

## Output

The agent produces `plan_res` — a detailed implementation plan stored as the last message content.
The plan's structured components are also stored in `context_variables`:
- `dataset_plan`, `training_plan`, `testing_plan`
