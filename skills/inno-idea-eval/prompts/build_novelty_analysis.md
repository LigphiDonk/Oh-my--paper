# Novelty Verification — Similarity Analysis

## Purpose

Analyze search results against the selected idea to produce a structured Novelty Grounding Report. This report becomes primary evidence for novelty scoring in all persona reviews.

## Parameters

| Parameter | Source | Description |
|-----------|--------|-------------|
| `selected_idea` | `Ideation/ideas/selected_idea.txt` | The idea text being evaluated |
| `search_results` | Step 0.5b output | Deduplicated search results (JSON array of papers with title, abstract, authors, year, source, url) |
| `source_papers` | `references` string or `Ideation/references/papers/` | Known inspiration papers (titles + authors) for `[INSPIRATION_SOURCE]` tagging |
| `idea_summary` | Step 0.5a output | One-sentence summary from query extraction |
| `key_terms` | Step 0.5a output | Distinctive technical terms from the idea |

## Conversation setup

This is an **LLM call** (not a new agent conversation). Use the orchestrating agent to analyze search results.

## Template

```text
You are a research novelty analyst. Your task is to analyze search results and determine how much prior art exists for a proposed research idea. Your analysis will be used by expert reviewers to ground their novelty assessments.

## Research Idea

{selected_idea}

**Idea Summary**: {idea_summary}
**Key Terms**: {key_terms}

## Known Inspiration Sources

The following papers are the acknowledged inspiration for this idea. If any appear in the search results, tag them as `[INSPIRATION_SOURCE]` — they should NOT count against novelty.

{source_papers}

## Search Results

{search_results}

## Analysis Protocol

Perform analysis in three phases:

### Phase 1: Triage

For EACH paper in the search results, assign a relevance tier and brief assessment:

- **high**: Directly addresses the same problem with a similar or identical method
- **medium**: Addresses the same problem with a different method, OR uses the same method for a different problem
- **low**: Shares some technical components or domain but differs substantially
- **irrelevant**: No meaningful connection to the proposed idea

For each paper, also check if it matches any known inspiration source (by title similarity or author overlap). If so, prepend `[INSPIRATION_SOURCE]` to its entry.

Format each entry as:
```
- [{relevance}] {title} ({year}) — {1-line assessment}
  {[INSPIRATION_SOURCE] if applicable}
```

### Phase 2: Deep Analysis

Select the top 5-8 papers from high and medium tiers (excluding `[INSPIRATION_SOURCE]` papers). For each:

1. **Overlap**: What specific aspects of the proposed idea does this paper already implement or propose?
2. **Differences**: What distinguishes the proposed idea from this paper?
3. **Threat Level**: How much does this paper diminish the novelty of the proposed idea? (critical / high / moderate / low)

If there are more than 8 high/medium-relevance papers, deep-analyze the top 8 and list the remainder with one-line assessments.

### Phase 3: Synthesis

Based on your triage and deep analysis, provide:

1. **Overall Novelty Threat Level** — one of:
   - `critical_overlap`: A paper implements the same method on the same problem (guidance: novelty 0-3)
   - `high_overlap`: Multiple papers collectively cover most contributions (guidance: novelty 2-5)
   - `moderate_overlap`: Components exist separately but the combination is new (guidance: novelty 4-7)
   - `low_overlap`: Only tangentially related work found (guidance: novelty 5-8)
   - `novel`: No significantly related work found (guidance: novelty 6-10)

2. **Genuine Novel Contributions** — List the specific aspects of the proposed idea that are NOT covered by any found paper (excluding inspiration sources). These are the idea's true differentiators.

3. **Reviewer Recommendation** — A paragraph summarizing what persona reviewers should consider when scoring novelty. Mention:
   - Which papers pose the greatest threat to novelty claims
   - Which claimed contributions survive the prior art check
   - Whether the novelty is in the method, the application, or the combination
   - Any caveats about search coverage (e.g., if queries may have missed relevant work)

## Required Output Format

Structure your response as a Novelty Grounding Report:

```markdown
# Active Novelty Verification Report

## Search Coverage
- Queries executed: {number}
- Total raw results: {number}
- Unique papers after deduplication: {number}
- Sources searched: {list}
- Year window: {range}

## Phase 1: Triage Summary
- High relevance: {count}
- Medium relevance: {count}
- Low relevance: {count}
- Irrelevant: {count}
- Inspiration sources identified: {count}

### All Papers (by relevance)
{triage entries}

## Phase 2: Deep Analysis
{for each analyzed paper}
### {paper title} ({year})
- **Overlap**: ...
- **Differences**: ...
- **Threat Level**: ...
{end for each}

## Phase 3: Synthesis

### Overall Novelty Threat Level: {level}

### Genuine Novel Contributions
- {contribution 1}
- {contribution 2}
- ...

### Reviewer Recommendation
{paragraph}
```
```

## Post-processing

After receiving the LLM response:
1. Write the full report text to `Ideation/ideas/novelty_grounding_report.txt`
2. Parse structured data for the JSON log:
   - Extract threat level, triage counts, analyzed papers, novel contributions
3. Write `Ideation/ideas/logs/idea_eval_agent_novelty.json` with `report_text` copied verbatim from the `.txt` file
4. Check for `critical_overlap` on non-inspiration papers → trigger fast-fail checkpoint if found
