# Per-Persona Evaluation Query

## Parameters

| Parameter | Source | Description |
|-----------|--------|-------------|
| `persona_name` | `references/reviewer_personas.md` | Name of the reviewer persona |
| `persona_description` | `references/reviewer_personas.md` | Full persona description + priorities |
| `selected_idea` | `Ideation/ideas/selected_idea.txt` | The idea text to evaluate |
| `evidence_block` | `prompts/build_evidence_assembly.md` output | Persona-filtered evidence from pipeline artifacts |
| `scoring_rubric` | `references/eval_agent_instructions.md` | The 5-dimension scoring rubric (0-10 per dim) |
| `grounded_note` | Pipeline state | Empty if grounded; disclaimer if standalone mode |

## Conversation setup

Start a **new conversation** for each persona. Do NOT reuse the idea-generation conversation.

System prompt: Use the Eval Agent system prompt from `references/eval_agent_instructions.md`.

## Template

```text
You are acting as: {persona_name}

{persona_description}

## Idea to Evaluate

{selected_idea}

## Available Evidence

{evidence_block}

{grounded_note}

## Evaluation Instructions

Evaluate the above research idea across the following 5 dimensions. For each dimension, provide:
1. A score from 0-10 (see calibration below)
2. A detailed reason for the score (2-4 sentences)
3. Specific references from the evidence that support your assessment

{scoring_rubric}

### Self-Discovery Check & Active Novelty Verification (Novelty dimension only)
Papers tagged `[INSPIRATION_SOURCE]` in the Active Novelty Verification Report are known inspiration — apply Self-Discovery Check (do NOT penalize novelty for building upon its own inspiration). For papers NOT tagged as inspiration, overlap should be reflected in your novelty score.

If the evidence includes an Active Novelty Verification Report, use its threat level and analysis as the primary basis for your novelty assessment. If no such report is present (e.g., all searches failed), fall back to evaluating novelty from the evidence alone and note the limitation.

## Required Output Format

Provide your review in the following structure:

### Dimension Scores

**Clarity**: [score]/10
[Reason with evidence references]

**Novelty**: [score]/10
[Reason with evidence references]

**Validity**: [score]/10
[Reason with evidence references]

**Feasibility**: [score]/10
[Reason with evidence references]

**Significance**: [score]/10
[Reason with evidence references]

### Summary

**Strengths:**
- [strength 1]
- [strength 2]
- ...

**Weaknesses:**
- [weakness 1]
- [weakness 2]
- ...

**Suggestions for Improvement:**
- [suggestion 1]
- [suggestion 2]
- ...

**Overall Recommendation:** [Accept / Borderline Accept / Borderline Reject / Reject]
```

## Post-processing

After receiving the Eval Agent's response:
1. Parse scores from the "Dimension Scores" section (extract integer 0-10 for each dimension)
2. Extract strengths, weaknesses, and suggestions as lists
3. Extract the overall recommendation
4. Build the structured JSON for the persona's `.json` cache file
