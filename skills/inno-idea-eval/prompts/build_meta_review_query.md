# Meta-Review Query (Area Chair Aggregation)

## Parameters

| Parameter | Source | Description |
|-----------|--------|-------------|
| `persona_1_review` | `Ideation/ideas/eval_persona_1_review.txt` | Senior ML Researcher review text |
| `persona_2_review` | `Ideation/ideas/eval_persona_2_review.txt` | Domain Expert review text |
| `persona_3_review` | `Ideation/ideas/eval_persona_3_review.txt` | Methods Specialist review text |
| `persona_1_scores` | `logs/idea_eval_agent_persona_1.json` | Persona 1 structured scores |
| `persona_2_scores` | `logs/idea_eval_agent_persona_2.json` | Persona 2 structured scores |
| `persona_3_scores` | `logs/idea_eval_agent_persona_3.json` | Persona 3 structured scores |
| `selected_idea` | `Ideation/ideas/selected_idea.txt` | Original idea text for reference |

## Conversation setup

Start a **new conversation**. Do NOT reuse any persona review conversation.

System prompt: Use the Eval Agent system prompt from `references/eval_agent_instructions.md`, with the additional instruction that this agent acts as **Area Chair**.

## Template

```text
You are acting as the **Area Chair** for a research idea review process. Three expert reviewers have independently evaluated the following research idea. Your task is to synthesize their reviews, resolve disagreements, and produce a final recommendation.

## Original Idea

{selected_idea}

## Reviewer 1: Senior ML Researcher
### Scores
{persona_1_scores}
### Full Review
{persona_1_review}

## Reviewer 2: Domain Expert
### Scores
{persona_2_scores}
### Full Review
{persona_2_review}

## Reviewer 3: Methods Specialist
### Scores
{persona_3_scores}
### Full Review
{persona_3_review}

## Your Task as Area Chair

1. **Aggregate Scores**: Compute the average score for each dimension across all 3 reviewers.

2. **Resolve Disagreements**: For any dimension where reviewer scores differ by more than 3 points, analyze the reviewers' reasoning and determine which assessment is more justified. Explain your reasoning.

3. **Synthesize Feedback**: Combine the strengths, weaknesses, and suggestions from all reviewers into a unified assessment. Identify consensus points and unique insights.

4. **Final Decision**: Based on the overall average score, apply the following thresholds:
   - Average >= 7.0 → `strong_accept` (Proceed to code survey)
   - Average >= 6.0 → `accept` (Proceed to code survey)
   - Average >= 5.0 → `borderline_accept` (Present report, ask user)
   - Average >= 4.0 → `borderline_reject` (Suggest refinement, ask user)
   - Average < 4.0 → `reject` (Trigger refinement loop)

## Required Output Format

### Score Aggregation

| Dimension | Reviewer 1 | Reviewer 2 | Reviewer 3 | Average | Disagreement? |
|-----------|-----------|-----------|-----------|---------|---------------|
| Clarity | | | | | |
| Novelty | | | | | |
| Validity | | | | | |
| Feasibility | | | | | |
| Significance | | | | | |

**Overall Average**: [X.X]

### Disagreement Resolution
[For each dimension with >3 point spread, explain which reviewer's assessment is more justified and why]

### Synthesized Assessment

**Key Strengths (consensus):**
- [strength 1]
- ...

**Key Weaknesses (consensus):**
- [weakness 1]
- ...

**Unique Insights:**
- [Reviewer X raised...]
- ...

**Actionable Suggestions:**
- [suggestion 1]
- ...

### Final Decision

**Decision**: [strong_accept / accept / borderline_accept / borderline_reject / reject]
**Rationale**: [2-3 sentences explaining the decision]
**Action**: [What should happen next in the pipeline]
```

## Post-processing

After receiving the Area Chair's response:
1. Parse the score aggregation table to extract per-dimension averages
2. Compute overall average across all dimensions
3. Extract the final decision string
4. Build the `idea_evaluation_result` dict for `context_variables`
5. Determine pipeline action based on decision thresholds
