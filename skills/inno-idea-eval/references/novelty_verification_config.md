# Novelty Verification — Configuration & Protocol

## Configuration Constants

| Constant | Default | Description |
|----------|---------|-------------|
| `NUM_QUERIES` | 4 | Number of search queries extracted from the idea |
| `MAX_RESULTS_PER_QUERY` | 10 | Maximum results returned per query per source |
| `DEFAULT_SOURCES` | `arxiv,semantic_scholar,openalex` | Search sources for novelty verification |
| `YEAR_WINDOW` | 3 | Years back to search (from current year) |
| `CRITICAL_OVERLAP_FAST_FAIL` | `true` | Present user checkpoint on critical overlap detection |

## Search Invocation

Following the `inno-deep-research` precedent, invoke the shared search script:

```bash
python3 ~/.claude/skills/searching-ai-papers/scripts/search_ai_papers.py \
  --query "<query>" \
  --sources arxiv,semantic_scholar,openalex \
  --max-results 10 \
  --year-from <current_year - YEAR_WINDOW> \
  --format json
```

Run once per query (4 invocations total). Collect all results and cross-deduplicate by title similarity before analysis.

## Novelty Threat Levels

| Level | Definition | Novelty Score Guidance |
|-------|-----------|----------------------|
| `critical_overlap` | A paper implements the same method on the same problem | 0-3 |
| `high_overlap` | Multiple papers collectively cover most contributions | 2-5 |
| `moderate_overlap` | Components exist separately, combination is new | 4-7 |
| `low_overlap` | Only tangentially related work found | 5-8 |
| `novel` | No significantly related work found | 6-10 |

Guidance ranges are advisory — reviewers may deviate with strong reasoning, but significant deviation from the guidance range requires explicit justification.

## Fast-Fail Protocol

When `CRITICAL_OVERLAP_FAST_FAIL` is `true` and the analysis yields `critical_overlap` on a paper that is **not** an `[INSPIRATION_SOURCE]`:

1. **Pause** the evaluation pipeline before persona reviews
2. **Present** to the user:
   - The critically overlapping paper (title, authors, year, URL)
   - A brief comparison showing what overlaps and what (if anything) differs
   - The novelty analyst's assessment
3. **Offer** three choices:
   - **Proceed**: Continue evaluation with the overlap noted (reviewers will see it)
   - **Refine**: Return to idea generation to differentiate from the found paper
   - **Abandon**: Stop evaluation of this idea
4. **Record** the user's decision in the novelty JSON log (`fast_fail_triggered: true`, `user_decision: "proceed|refine|abandon"`)

If `CRITICAL_OVERLAP_FAST_FAIL` is `false`, skip the checkpoint and proceed with the overlap noted in the report.

## Inspiration Source Matching

A search result is tagged `[INSPIRATION_SOURCE]` if:
- Its title has high similarity (>80% token overlap after lowercasing and removing stop words) to any paper in the `source_papers` list
- OR the first author matches a first author in the `source_papers` list AND the title has >50% token overlap

This is consistent with the existing Self-Discovery Check in persona reviews — papers that inspired the idea should not penalize its novelty assessment.

## Edge Case Handling

| Case | Protocol |
|------|----------|
| Search API failures | Log the error; proceed with available results. If ALL sources fail for a query, note it in the report. If ALL queries fail entirely, set threat level to `unverified` and proceed without grounded novelty. |
| Zero results across all queries | Set threat level to `novel` with a caveat: "No prior art found, but this may reflect query limitations rather than true novelty." |
| Papers without abstracts | Triage based on title only at lower confidence. Default to `low` relevance unless the title strongly suggests overlap. Note title-only assessment in the triage entry. |
| Vague or underspecified idea | Query extraction notes the limitation. Generic queries produce noisy results. Default to `low_overlap` unless specific matches are found. |
| Refinement re-run (v2+) | Re-run Step 0.5 with the refined idea. Save as `novelty_grounding_report_v{N}.txt` and `idea_eval_agent_novelty_v{N}.json`. |
| >8 high/medium-relevance papers | Deep-analyze the top 8 (by relevance tier, then recency). Summarize the rest in a one-line list. |

## Report Versioning

For the initial evaluation: `novelty_grounding_report.txt`
For refinement iterations: `novelty_grounding_report_v{N}.txt` where N matches the refinement iteration number.
