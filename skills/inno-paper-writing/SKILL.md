---
id: inno-paper-writing
name: inno-paper-writing
version: 1.0.0
description: |-
  Creates formal academic research papers following IEEE/ACM formatting standards with proper structure, citations, and scholarly writing style.
stages: ["publication"]
tools: ["read_file", "search_project", "write_file"]
summary: |-
  Creates formal academic research papers following IEEE/ACM formatting standards with proper structure, citations, and scholarly writing style. Use when the user asks to write a research paper, academic paper, or conference paper on any top...
primaryIntent: writing
intents: ["writing", "research"]
capabilities: ["visualization-reporting"]
domains: ["general"]
keywords: ["inno-paper-writing", "paper writing", "visualization-reporting", "inno", "paper", "writing", "creates", "formal", "academic", "research", "papers", "following"]
source: builtin
status: verified
upstream:
  repo: dr-claw
  path: skills/inno-paper-writing
  revision: 8322dc4ef575affaa374aa7922c0a0971c6db7d7
resourceFlags:
  hasReferences: true
  hasScripts: false
  hasTemplates: false
  hasAssets: false
  referenceCount: 3
  scriptCount: 0
  templateCount: 0
  assetCount: 0
  optionalScripts: false
---

# inno-paper-writing

## Canonical Summary

Creates formal academic research papers following IEEE/ACM formatting standards with proper structure, citations, and scholarly writing style. Use when the user asks to write a research paper, academic paper, or conference paper on any top...

## Trigger Rules

Use this skill when the user request matches its research workflow scope. Prefer the bundled resources instead of recreating templates or reference material. Keep outputs traceable to project files, citations, scripts, or upstream evidence.

## Resource Use Rules

- Read from `references/` only when the current task needs the extra detail.

## Execution Contract

- Resolve every relative path from this skill directory first.
- Prefer inspection before mutation when invoking bundled scripts.
- If a required runtime, CLI, credential, or API is unavailable, explain the blocker and continue with the best manual fallback instead of silently skipping the step.
- Do not write generated artifacts back into the skill directory; save them inside the active project workspace.

## Upstream Instructions

# Research Paper Writer

## Overview

This skill guides the creation of formal academic research papers that meet publication standards for IEEE and ACM conferences/journals. It ensures proper structure, formatting, academic writing style, and comprehensive coverage of research topics.

## Workflow

### 1. Understanding the Research Topic

When asked to write a research paper:

1. **Clarify the topic and scope** with the user:
   - What is the main research question or contribution?
   - What is the target audience (conference, journal, general academic)?
   - What is the desired length (page count or word count)?
   - Are there specific sections required?
   - What formatting standard to use (IEEE or ACM)?

2. **Gather context** if needed:
   - Review any provided research materials, data, or references
   - Understand the domain and technical background
   - Identify key related work or existing research to reference

### 2. Paper Structure

Follow this standard academic paper structure:

```
1. Title and Abstract
   - Concise title reflecting the main contribution
   - Abstract: 150-250 words summarizing purpose, methods, results, conclusions

2. Introduction
   - Motivation and problem statement
   - Research gap and significance
   - Main contributions (typically 3-5 bullet points)
   - Paper organization paragraph

3. Related Work / Background
   - Literature review of relevant research
   - Comparison with existing approaches
   - Positioning of current work

4. Methodology / Approach / System Design
   - Detailed description of proposed method/system
   - Architecture diagrams if applicable
   - Algorithms or procedures
   - Design decisions and rationale

5. Implementation (if applicable)
   - Technical details
   - Tools and technologies used
   - Challenges and solutions

6. Evaluation / Experiments / Results
   - Experimental setup
   - Datasets or test scenarios
   - Performance metrics
   - Results presentation (tables, graphs)
   - Analysis and interpretation

7. Discussion
   - Implications of results
   - Limitations and threats to validity
   - Lessons learned

8. Conclusion and Future Work
   - Summary of contributions
   - Impact and significance
   - Future research directions

9. References
   - Comprehensive bibliography in proper citation format
```

### 3. Academic Writing Style

Apply these writing conventions from scholarly research:

**Tone and Voice:**
- Formal, objective, and precise language
- Third-person perspective (avoid "I" or "we" unless describing specific contributions)
- Present tense for established facts, past tense for specific studies
- Clear, direct statements without unnecessary complexity

**Technical Precision:**
- Define all acronyms on first use: "Context-Aware Systems (C-AS)"
- Use domain-specific terminology correctly and consistently
- Quantify claims with specific metrics or evidence
- Avoid vague terms like "very", "many", "significant" without data

**Argumentation:**
- State claims clearly, then support with evidence
- Use logical progression: motivation → problem → solution → validation
- Compare and contrast with related work explicitly
- Address limitations and counterarguments

**Section-Specific Guidelines:**

*Abstract:*
- First sentence: broad context and motivation
- Second/third: specific problem and gap
- Middle: approach and methodology
- End: key results and contributions
- Self-contained (readable without the full paper)

*Introduction:*
- Start with real-world motivation or compelling problem
- Build from general to specific (inverted pyramid)
- End with clear contribution list and paper roadmap
- Use examples to illustrate the problem

*Related Work:*
- Group related work by theme or approach
- Compare explicitly: "Unlike [X] which focuses on Y, our approach..."
- Identify gaps: "However, these approaches do not address..."
- Position your work clearly

*Results:*
- Present data clearly in tables/figures
- Describe trends and patterns objectively
- Compare with baselines quantitatively
- Acknowledge unexpected or negative results

### 4. Formatting Guidelines

**IEEE Format (default):**
- Page size: A4 (210mm × 297mm)
- Margins: Top 19mm, Bottom 43mm, Left/Right 14.32mm
- Two-column layout with 4.22mm column separation
- Font: Times New Roman throughout
  - Title: 24pt bold
  - Author names: 11pt
  - Section headings: 10pt bold, numbered (1., 1.1, 1.1.1)
  - Body text: 10pt
  - Figure/Table captions: 8pt
- Line spacing: Single
- Paragraph: No indentation, 3pt spacing between paragraphs
- Figures: Centered, with captions below
- Tables: Centered, with captions above

**ACM Format (alternative):**
- Standard ACM conference proceedings format
- Single-column abstract, two-column body
- Include CCS Concepts and Keywords sections after abstract
- Use ACM reference format for citations

### 5. Citations and References

**In-text citations:**
- Use numbered citations: "Recent work [1, 2] has shown..."
- Multiple citations in chronological order: [3, 7, 12]
- Reference specific sections: "As demonstrated in [5, Section 3]..."

**Reference formatting (IEEE style):**
```
[1] A. Author, B. Author, and C. Author, "Title of paper," in Proc. Conference Name, Year, pp. 123-456.
[2] D. Author, "Title of journal article," Journal Name, vol. X, no. Y, pp. 123-456, Month Year.
[3] E. Author, Book Title, Edition. City: Publisher, Year.
```

**Reference list requirements:**
- Alphabetically ordered by first author's last name (or numbered by citation order)
- Include DOI or URL when available
- Minimum 15-20 references for a full paper
- Mix of recent (last 5 years) and foundational works

### 6. Content Generation Process

**Step-by-step approach:**

1. **Create outline**
   - Develop detailed section-by-section outline
   - Define key points for each section
   - Identify where figures/tables are needed

2. **Draft sections iteratively**
   - Start with methodology (core contribution)
   - Then introduction (now that contribution is clear)
   - Related work (to position the contribution)
   - Results and evaluation
   - Discussion and conclusion
   - Abstract last (summary of complete paper)

3. **Add citations**
   - Reference related work throughout
   - Support claims with evidence from literature
   - Create comprehensive reference list

4. **Review and refine**
   - Check logical flow between sections
   - Ensure consistency in terminology
   - Verify all figures/tables are referenced in text
   - Confirm abstract matches content
   - Validate citation completeness

## Examples

**Example 1: User asks for a survey paper**
```
User: "Write a research paper surveying recent advances in context-aware systems"

Response:
1. Clarify scope: "I'll create a survey paper on context-aware systems. A few questions:
   - Should I focus on specific aspects (e.g., requirements engineering, implementation techniques)?
   - What time period for 'recent' (last 5 years, 10 years)?
   - Target length: 10-15 pages, or 20-30 pages comprehensive survey?
   - IEEE or ACM format?"

2. After clarification, create outline showing:
   - Taxonomy of context-aware systems
   - Survey methodology
   - Classification scheme
   - Section-by-section coverage of different aspects
   - Trends and future directions

3. Draft paper following survey structure with extensive related work coverage
```

**Example 2: User asks for an experimental paper**
```
User: "Write a paper about my new algorithm for detecting hallucinations in vision-language models"

Response:
1. Gather details about:
   - Algorithm approach and novelty
   - Experimental setup and datasets used
   - Results and metrics
   - Comparison baselines

2. Structure as experimental paper:
   - Introduction: motivation for hallucination detection
   - Related work: existing detection methods
   - Proposed method: detailed algorithm description
   - Experiments: datasets, metrics, setup
   - Results: quantitative comparison with baselines
   - Analysis: ablation studies, error analysis
   - Conclusion: contributions and future work

3. Emphasize reproducibility and empirical validation
```

## Resources

### references/
- `writing_style_guide.md`: Detailed academic writing conventions extracted from example papers
- `ieee_formatting_specs.md`: Complete IEEE formatting specifications
- `acm_formatting_specs.md`: Complete ACM formatting specifications

### assets/
- `full_paper_template.pdf`: IEEE paper template with formatting examples
- `interim-layout.pdf`: ACM paper template
- Reference these templates when discussing formatting requirements with users

## Important Notes

- **Always ask for clarification** on topic scope before starting
- **Quality over speed**: Take time to structure properly and write clearly
- **Cite appropriately**: Academic integrity requires proper attribution
- **Be honest about limitations**: Acknowledge gaps or constraints in the research
- **Maintain consistency**: Terminology, notation, and style throughout
- **User provides the research content**: This skill structures and writes; the user provides the technical contributions and findings
