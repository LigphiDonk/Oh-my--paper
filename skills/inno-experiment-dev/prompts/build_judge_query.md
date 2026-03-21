# build_judge_query

Constructs the initial prompt for the Judge Agent to evaluate the implementation.

## Parameters

| Parameter    | Type   | Description |
|--------------|--------|-------------|
| `survey_res` | string | The finalized selected idea |
| `prepare_res`| string | JSON with reference codebases and paths |
| `plan_res`   | string | Detailed implementation plan |
| `ml_dev_res` | string | The ML Agent's implementation result (last message content) |

## Template

```
INPUT:
You are given an innovative idea:
{survey_res}
and the reference codebases chosen by the `Prepare Agent`:
{prepare_res}
and the detailed coding plan:
{plan_res}
The implementation of the project:
{ml_dev_res}
Your task is to evaluate the implementation, and give a suggestion about the implementation.
Note that you should carefully check whether the implementation meets the idea,
especially the atomic academic concepts in the model survey notes one by one!
If not, give comprehensive suggestions about the implementation.

[IMPORTANT] You should fully utilize the existing resources in the reference codebases
as much as possible, including using the existing datasets, model components, and
training process, but you should also implement the idea by creating new model components!

[IMPORTANT] You should recognize every key point in the innovative idea, and carefully
check whether the implementation meets the idea one by one!

[IMPORTANT] Some tips about the evaluation:
1. The implementation should carefully follow the plan. Please check every component
   in the plan step by step.
2. The implementation should have the test process. All in all, you should train ONE
   dataset with TWO epochs, and finally test the model on the test dataset within one
   script. The test metrics should follow the plan.
3. The model should be train on GPU device. If you meet Out of Memory problem, you
   should try another specific GPU device.
```

## Usage

This is the **first** judge evaluation. The Judge Agent reads the project code,
delegates atomic checks to the Code Review Agent, and produces a `suggestion_dict`
with `fully_correct` (bool) and `suggestion` (dict of key points to suggestions).

If `fully_correct` is `true`, no further iterations are needed.
