# build_judge_simple_query

Constructs a simplified re-evaluation prompt for the Judge Agent during iteration rounds.

## Parameters

| Parameter    | Type   | Description |
|--------------|--------|-------------|
| `survey_res` | string | The finalized selected idea |
| `prepare_res`| string | JSON with reference codebases and paths |
| `plan_res`   | string | Detailed implementation plan |
| `ml_dev_res` | string | The ML Agent's latest implementation result |

## Template

```
You are given an innovative idea:
{survey_res}
and the reference codebases chosen by the `Prepare Agent`:
{prepare_res}
and the detailed coding plan:
{plan_res}
The implementation of the project:
{ml_dev_res}
Please evaluate the implementation, and give a suggestion about the implementation.
```

## Usage

This is the **simplified** judge query used in iteration rounds 1+ (after the first
full evaluation). It is appended to `judge_messages` and the Judge Agent re-evaluates
the refined implementation.

The Judge outputs `suggestion_dict` with:
- `fully_correct`: boolean — if `true`, the iteration loop exits early
- `suggestion`: dict of key points to suggestions, or `null`
