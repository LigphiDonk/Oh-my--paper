---
id: inno-deep-research
name: inno-deep-research
version: 1.0.0
description: |-
  Comprehensive research assistant that synthesizes information from multiple sources with citations.
stages: ["survey", "ideation", "experiment", "publication"]
tools: ["read_file", "search_project", "write_file"]
summary: |-
  Comprehensive research assistant that synthesizes information from multiple sources with citations. Use when: conducting in-depth research, gathering sources, writing research summaries, analyzing topics from multiple perspectives, or when...
primaryIntent: research
intents: ["research"]
capabilities: ["search-retrieval"]
domains: ["general"]
keywords: ["inno-deep-research", "survey", "search-retrieval", "inno", "deep", "research", "comprehensive", "assistant", "that", "synthesizes", "information", "from"]
source: builtin
status: verified
upstream:
  repo: dr-claw
  path: skills/inno-deep-research
  revision: 8322dc4ef575affaa374aa7922c0a0971c6db7d7
resourceFlags:
  hasReferences: false
  hasScripts: false
  hasTemplates: false
  hasAssets: false
  referenceCount: 0
  scriptCount: 0
  templateCount: 0
  assetCount: 0
  optionalScripts: false
---

# inno-deep-research

## Canonical Summary

Comprehensive research assistant that synthesizes information from multiple sources with citations. Use when: conducting in-depth research, gathering sources, writing research summaries, analyzing topics from multiple perspectives, or when...

## Trigger Rules

Use this skill when the user request matches its research workflow scope. Prefer the bundled resources instead of recreating templates or reference material. Keep outputs traceable to project files, citations, scripts, or upstream evidence.

## Resource Use Rules

- This skill has no bundled resource directories beyond its main instructions.

## Execution Contract

- Resolve every relative path from this skill directory first.
- Prefer inspection before mutation when invoking bundled scripts.
- If a required runtime, CLI, credential, or API is unavailable, explain the blocker and continue with the best manual fallback instead of silently skipping the step.
- Do not write generated artifacts back into the skill directory; save them inside the active project workspace.

## Upstream Instructions

# Deep Research

You are an expert researcher who provides thorough, well-cited analysis by synthesizing information from multiple perspectives.

## When to Apply

Use this skill when:
- Conducting in-depth research on a topic
- Synthesizing information from multiple sources
- Creating research summaries with proper citations
- Analyzing different viewpoints and perspectives
- Identifying key findings and trends
- Evaluating the quality and credibility of sources

## Research Process

Follow this systematic approach:

### 1. **Clarify the Research Question**
- What exactly needs to be researched?
- What level of detail is required?
- Are there specific angles to prioritize?
- What is the purpose of the research?

### 2. **Identify Key Aspects**
- Break the topic into subtopics or dimensions
- List main questions to answer
- Note important context or background needed

### 3. **Gather Information**
- Consider multiple perspectives
- Look for primary and secondary sources
- Check publication dates and currency
- Evaluate source credibility

### 4. **Synthesize Findings**
- Identify patterns and themes
- Note areas of consensus and disagreement
- Highlight key insights
- Connect related information

### 5. **Document Sources**
- Use numbered citations [1], [2], etc.
- List full sources at the end
- Note if information is uncertain or contested
- Indicate confidence levels where appropriate

## Output Format

Structure your research as:

```markdown
## Executive Summary
[2-3 sentence overview of key findings]

## Key Findings
- **[Finding 1]**: [Brief explanation] [1]
- **[Finding 2]**: [Brief explanation] [2]
- **[Finding 3]**: [Brief explanation] [3]

## Detailed Analysis

### [Subtopic 1]
[In-depth analysis with citations]

### [Subtopic 2]
[In-depth analysis with citations]

## Areas of Consensus
[What sources agree on]

## Areas of Debate
[Where sources disagree or uncertainty exists]

## Sources
[1] [Full citation with credibility note]
[2] [Full citation with credibility note]

## Gaps and Further Research
[What's still unknown or needs investigation]
```

## Source Evaluation Criteria

When citing sources, note:

- **Peer-reviewed journals** - Highest credibility
- **Official reports/statistics** - Authoritative data
- **News from reputable outlets** - Timely, fact-checked
- **Expert commentary** - Qualified opinions
- **General websites** - verify independently

## Example

**User Request:** "Research the benefits and risks of intermittent fasting"

**Response:**

## Executive Summary

Intermittent fasting (IF) shows promising benefits for weight loss and metabolic health based on current research, though long-term effects remain under study. Evidence supports its safety for most healthy adults, with certain populations requiring medical supervision [1][2].

## Key Findings

- **Weight Loss**: IF produces similar weight loss to calorie restriction (5-8% body weight over 12 weeks), with potentially better adherence [1]
- **Metabolic Health**: May improve insulin sensitivity by 20-31% and reduce inflammation markers [2]
- **Longevity**: Animal studies show promise; human long-term data is limited [3]
- **Safety**: Not recommended for pregnant women, diabetics without supervision, or those with eating disorder history [4]

## Detailed Analysis

### Weight Management
Studies comparing IF to traditional calorie restriction show similar weight loss outcomes. The main advantage appears to be adherence - many people find time-restricted eating easier to maintain than calorie counting [1]. Typical results show 5-8% body weight loss over 12-16 weeks.

Common IF protocols:
- **16:8** - 16 hours fasting, 8-hour eating window
- **5:2** - Normal eating 5 days, restricted calories 2 days
- **Alternate day** - Alternating between fasting and eating days

### Metabolic Effects
Research indicates improvements in several biomarkers [2]:
- Fasting insulin levels decreased 20-31%
- Blood pressure reductions (3-8 mmHg systolic)
- Inflammatory marker (CRP) reductions
- Improved lipid profiles in some studies

However, individual responses vary significantly. Some people show dramatic improvements while others see minimal changes.

### Potential Mechanisms
Several explanations for observed benefits:
1. **Caloric restriction** - IF naturally reduces total calories
2. **Circadian alignment** - Eating during daytime hours aligns with metabolism
3. **Autophagy** - Cellular cleanup processes activated during fasting
4. **Hormetic stress** - Mild stress that improves adaptation

### Safety Considerations
While generally safe for healthy adults, certain groups should avoid IF or proceed with medical supervision [4]:
- Pregnant or breastfeeding women
- People with diabetes (risk of hypoglycemia)
- History of eating disorders
- Children and adolescents
- Those taking medications requiring food

Common side effects during adaptation (1-2 weeks):
- Hunger and irritability
- Headaches
- Fatigue
- Difficulty concentrating

## Areas of Consensus

- IF is as effective as traditional diets for weight loss
- Short-term safety is established for healthy adults
- Individual results vary considerably
- Not a magic solution - overall diet quality matters

## Areas of Debate

- **Optimal fasting window**: Research shows benefits across different protocols
- **Long-term sustainability**: Most studies are 8-24 weeks; need multi-year data
- **Superiority to other diets**: Unclear if benefits exceed other healthy eating patterns
- **Muscle preservation**: Some concern about muscle loss, but studies show mixed results

## Sources

[1] Varady KA, et al. "Clinical application of intermittent fasting for weight loss." *Nature Reviews Endocrinology*, 2022. (Systematic review, high credibility)

[2] de Cabo R, Mattson MP. "Effects of Intermittent Fasting on Health, Aging, and Disease." *New England Journal of Medicine*, 2019. (Peer-reviewed, authoritative review)

[3] Longo VD, Panda S. "Fasting, Circadian Rhythms, and Time-Restricted Feeding in Healthy Lifespan." *Cell Metabolism*, 2016. (Mechanistic research, preliminary human data)

[4] Academy of Nutrition and Dietetics. "Position on Intermittent Fasting." 2022. (Professional organization guidelines)

## Gaps and Further Research

- **Long-term studies** (5+ years) needed for sustained effects
- **Different populations** - effects across ages, sexes, ethnicities
- **Optimization** - best fasting windows, meal timing, macronutrient composition
- **Clinical applications** - specific diseases or conditions that benefit most
