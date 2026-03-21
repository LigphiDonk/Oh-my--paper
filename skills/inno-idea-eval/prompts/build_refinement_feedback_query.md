# Refinement Feedback Query

## Purpose

When the evaluation decision is `borderline_reject` or `reject`, this template builds structured feedback that is appended to the original idea-generation conversation. The Idea Agent then revises (not regenerates) the idea based on this feedback.

## Parameters

| Parameter | Source | Description |
|-----------|--------|-------------|
| `eval_report` | `Ideation/ideas/eval_report.txt` | Full meta-review report |
| `weaknesses` | Meta-review JSON | Consolidated weaknesses from all persona reviews |
| `suggestions` | Meta-review JSON | Consolidated actionable suggestions |
| `selected_idea` | `Ideation/ideas/selected_idea.txt` | Current idea text being refined |
| `iteration` | Pipeline state | Current refinement iteration (1 or 2) |
| `max_iterations` | Configuration | Maximum refinement iterations (default: 2) |

## Conversation setup

**Append** this prompt to the **original idea-generation conversation** (the one from `inno-idea-generation` Step 3, selection). Do NOT start a new conversation — the Idea Agent needs context from the original generation to revise coherently.

## Template

```text
Your previously selected idea has been evaluated by a panel of expert reviewers. The evaluation identified several areas for improvement. Please revise the idea to address the feedback below.

**IMPORTANT**: You are REVISING the existing idea, not generating a new one. Maintain the core concept and approach while strengthening the identified weaknesses.

## Current Idea

{selected_idea}

## Evaluation Summary

{eval_report}

## Key Weaknesses to Address

{weaknesses}

## Suggested Improvements

{suggestions}

## Revision Guidelines

1. **Preserve the core idea**: Keep the fundamental approach and innovation intact
2. **Address each weakness**: For each listed weakness, either fix it or explain why it's acceptable
3. **Incorporate suggestions**: Apply the actionable suggestions where they strengthen the idea
4. **Strengthen mathematical formulation**: If validity concerns were raised, provide more rigorous formulations
5. **Clarify feasibility**: If feasibility concerns were raised, detail the implementation pathway
6. **Maintain completeness**: The revised idea must be self-contained — include all sections from the original

This is refinement iteration {iteration} of {max_iterations}. If the revision cannot adequately address the feedback, note which concerns remain open.

Output the complete revised idea in the same format as the original.
```

## Post-processing

After receiving the Idea Agent's revised idea:
1. Save as `Ideation/ideas/refined_idea_v{iteration}.txt`
2. Update `selected_idea.txt` with the refined version
3. Update `context_variables["final_selected_idea_data"]["selected_idea_text"]`
4. Re-run evaluation pipeline (Steps 0-4) on the refined idea
5. If still below threshold and iteration < max_iterations, repeat refinement
6. If max iterations reached, present final report to user for decision

## Refinement Constraints

- Maximum 2 refinement iterations (configurable via `MAX_REFINEMENT_ITERATIONS`)
- The Idea Agent must revise, not regenerate — the prompt is appended to existing conversation
- Each refinement iteration produces a separate `refined_idea_v{N}.txt` for audit trail
- If accepted after refinement, the final refined version becomes the new `selected_idea.txt`
