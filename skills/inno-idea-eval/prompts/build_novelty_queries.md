# Novelty Verification — Query Extraction

## Purpose

Extract 4 targeted search queries from the selected idea to probe existing literature for prior art. Queries are ordered narrow→broad to maximize recall while keeping the most relevant results at the top.

## Parameters

| Parameter | Source | Description |
|-----------|--------|-------------|
| `selected_idea` | `Ideation/ideas/selected_idea.txt` | The idea text to verify |
| `source_papers` | `references` string or `Ideation/references/papers/` | Known inspiration papers (titles + authors) |

## Conversation setup

This is an **LLM call** (not a new agent conversation). Use the orchestrating agent to extract queries from the idea.

## Template

```text
You are a research literature search specialist. Your task is to extract exactly 4 search queries from a research idea. These queries will be used to search arXiv, Semantic Scholar, and OpenAlex for existing prior art.

## Research Idea

{selected_idea}

## Known Inspiration Papers

The following papers are known inspirations for this idea. They should NOT be considered prior art — they are the idea's acknowledged sources:

{source_papers}

## Query Extraction Rules

Extract exactly 4 queries, ordered from most specific to most general:

1. **core_method** — Target the exact technique or algorithm proposed. Include the specific method name, loss function, or architecture variant. This query should find papers that implement essentially the same approach.
   - Example: "sparse autoencoder feature steering language models"

2. **problem_domain** — Target the same problem and domain, but allow any method. This finds alternative approaches to the same task.
   - Example: "mechanistic interpretability feature extraction transformer models"

3. **key_component** — Target the most distinctive technical building block of the idea. This finds papers using the same core technique in any context.
   - Example: "sparse dictionary learning neural network activations"

4. **broad_approach** — Target the general methodological family. This catches tangentially related work and survey papers.
   - Example: "representation learning interpretability deep neural networks"

## Guidelines

- Each query should be 4-8 words (optimal for academic search APIs)
- Use technical terminology from the idea, not colloquial descriptions
- Avoid overly generic terms that would return thousands of irrelevant results
- If the idea combines techniques from different fields, ensure at least one query targets each field
- Do NOT include author names, paper titles, or year constraints in queries (these are handled by search parameters)

## Required Output Format

Return a JSON object with the following structure:

```json
{
  "queries": [
    {
      "type": "core_method",
      "query": "...",
      "rationale": "Why this query targets the core contribution"
    },
    {
      "type": "problem_domain",
      "query": "...",
      "rationale": "Why this query captures the problem space"
    },
    {
      "type": "key_component",
      "query": "...",
      "rationale": "Why this query isolates the key technical building block"
    },
    {
      "type": "broad_approach",
      "query": "...",
      "rationale": "Why this query covers the methodological family"
    }
  ],
  "idea_summary": "One-sentence summary of the core contribution",
  "key_terms": ["term1", "term2", "term3", "..."]
}
```

The `key_terms` list should contain 5-10 distinctive technical terms from the idea that can be used for deduplication and relevance filtering.
```

## Post-processing

After receiving the LLM response:
1. Parse the JSON output
2. Validate that exactly 4 queries are present with correct types
3. Store the queries, idea_summary, and key_terms for use in Step 0.5b (search execution)
4. If parsing fails, fall back to extracting queries from the idea title and key sentences
