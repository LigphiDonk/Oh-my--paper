---
id: inno-idea-generation
name: inno-idea-generation
version: 1.0.0
description: |-
  Facilitates structured brainstorming sessions, conducts comprehensive research, and generates creative solutions using proven frameworks.
stages: ["ideation"]
tools: ["read_file", "search_project", "write_file", "run_terminal"]
summary: |-
  Facilitates structured brainstorming sessions, conducts comprehensive research, and generates creative solutions using proven frameworks. Trigger keywords - brainstorm, ideate, research, SCAMPER, SWOT, mind map, creative, explore ideas, ma...
primaryIntent: ideation
intents: ["ideation", "research"]
capabilities: ["research-planning"]
domains: ["general"]
keywords: ["inno-idea-generation", "idea generation", "research-planning", "inno", "idea", "generation", "facilitates", "structured", "brainstorming", "sessions", "conducts", "comprehensive"]
source: builtin
status: verified
upstream:
  repo: dr-claw
  path: skills/inno-idea-generation
  revision: 8322dc4ef575affaa374aa7922c0a0971c6db7d7
resourceFlags:
  hasReferences: false
  hasScripts: true
  hasTemplates: true
  hasAssets: false
  referenceCount: 0
  scriptCount: 3
  templateCount: 2
  assetCount: 0
  optionalScripts: true
---

# inno-idea-generation

## Canonical Summary

Facilitates structured brainstorming sessions, conducts comprehensive research, and generates creative solutions using proven frameworks. Trigger keywords - brainstorm, ideate, research, SCAMPER, SWOT, mind map, creative, explore ideas, ma...

## Trigger Rules

Use this skill when the user request matches its research workflow scope. Prefer the bundled resources instead of recreating templates or reference material. Keep outputs traceable to project files, citations, scripts, or upstream evidence.

## Resource Use Rules

- Treat `scripts/` as optional helpers. Run them only when their dependencies are available, keep outputs in the project workspace, and explain a manual fallback if execution is blocked.
- Reuse files under `templates/` instead of recreating equivalent structure from scratch when the user asks for the matching deliverable.

## Execution Contract

- Resolve every relative path from this skill directory first.
- Prefer inspection before mutation when invoking bundled scripts.
- If a required runtime, CLI, credential, or API is unavailable, explain the blocker and continue with the best manual fallback instead of silently skipping the step.
- Do not write generated artifacts back into the skill directory; save them inside the active project workspace.

## Upstream Instructions

# Creative Intelligence

**Role:** Creative Intelligence System specialist for structured brainstorming and research

**Function:** Facilitate creative problem-solving, conduct research, generate innovative solutions using proven frameworks

## Core Responsibilities

- Lead structured brainstorming sessions using proven techniques
- Conduct market, competitive, technical, and user research
- Generate creative solutions to complex problems
- Facilitate idea generation and refinement across all project phases
- Document research findings and actionable insights
- Support innovation throughout the development lifecycle

## Core Principles

1. **Structured Creativity** - Use proven frameworks, not random ideation
2. **Research-Driven** - Base decisions on evidence and data
3. **Diverge Then Converge** - Generate many options, then refine to best ideas
4. **Document Everything** - Capture all insights for future reference
5. **Cross-Pollination** - Apply ideas from other domains and industries

## Quick Start

### Brainstorming Session

```bash
# Generate SCAMPER prompts for a feature
bash scripts/scamper-prompts.sh "mobile payment system"

# Create SWOT analysis template
bash scripts/swot-template.sh > swot-analysis.md
```

### Research Session

```bash
# List research source types
bash scripts/research-sources.sh
```

## Brainstorming Techniques

For detailed descriptions, see [resources/brainstorming-techniques.md](resources/brainstorming-techniques.md).

### Technique Quick Reference

| Technique | Best For | Time | Output |
|-----------|----------|------|--------|
| **5 Whys** | Root cause analysis | 10-15 min | Cause chain |
| **SCAMPER** | Feature ideation | 20-30 min | Creative variations |
| **Mind Mapping** | Idea organization | 15-20 min | Visual hierarchy |
| **Reverse Brainstorming** | Risk identification | 15-20 min | Failure scenarios |
| **Six Thinking Hats** | Multi-perspective analysis | 30-45 min | Balanced view |
| **Starbursting** | Question exploration | 20-30 min | Question tree |
| **SWOT Analysis** | Strategic planning | 30-45 min | SWOT matrix |

### Technique Selection Guide

**Problem exploration:**
- Use **5 Whys** to uncover root causes
- Use **Starbursting** to explore all angles with questions

**Solution generation:**
- Use **SCAMPER** for creative feature variations
- Use **Mind Mapping** to organize and connect ideas

**Risk and validation:**
- Use **Reverse Brainstorming** to identify failure modes
- Use **Six Thinking Hats** (Black Hat) for critical analysis

**Strategic planning:**
- Use **SWOT Analysis** for competitive positioning
- Use **Six Thinking Hats** (full cycle) for comprehensive evaluation

**Feature ideation:**
- Use **SCAMPER** for creative modifications
- Use **Mind Mapping** to organize feature hierarchies

## Research Methods

For detailed methodology, see [resources/research-methods.md](resources/research-methods.md).

### Research Types

1. **Market Research**
   - Market size and trends
   - Customer segments and personas
   - Industry analysis and dynamics
   - Growth opportunities and threats

2. **Competitive Research**
   - Competitor identification and profiling
   - Feature comparison matrices
   - Positioning and differentiation analysis
   - Gap identification and opportunities

3. **Technical Research**
   - Technology stack evaluation
   - Framework and library comparison
   - Best practices and patterns
   - Implementation approaches

4. **User Research**
   - User needs and pain points
   - Behavior patterns and workflows
   - User journey mapping
   - Accessibility and usability requirements

### Research Tools

- **WebSearch** - Market trends, competitive intelligence, industry data
- **WebFetch** - Documentation, articles, specific resources
- **Grep/Glob** - Codebase patterns, internal documentation
- **Read** - Existing project documentation and configurations

## Workflow Patterns

### Brainstorming Workflow

1. **Define Objective** - What are we trying to discover or solve?
2. **Select Techniques** - Choose 1-3 complementary techniques
3. **Execute Sessions** - Apply each technique systematically
4. **Organize Ideas** - Categorize and structure all generated ideas
5. **Extract Insights** - Identify top 3-5 actionable insights
6. **Document Results** - Save using `templates/brainstorm-session.template.md`
7. **Recommend Next Steps** - Suggest logical follow-up actions

### Research Workflow

1. **Define Scope** - What questions need answers?
2. **Plan Approach** - Select research methods and sources
3. **Gather Data** - Use appropriate tools (WebSearch, WebFetch, etc.)
4. **Analyze Findings** - Look for patterns, gaps, opportunities
5. **Synthesize Insights** - Extract key takeaways
6. **Document Report** - Save using `templates/research-report.template.md`
7. **Make Recommendations** - Provide actionable next steps

## Cross-Phase Applicability

### Phase 1: Analysis
- Market research for product discovery
- Competitive landscape analysis
- Problem exploration using 5 Whys
- User research and needs analysis

### Phase 2: Planning
- Feature brainstorming with SCAMPER
- SWOT analysis for strategic planning
- Risk identification with Reverse Brainstorming
- Prioritization insights from research

### Phase 3: Solutioning
- Architecture alternatives exploration
- Design pattern research
- Mind Mapping for system organization
- Technical research for implementation approaches

### Phase 4: Implementation
- Technical solution research
- Best practices investigation
- Problem-solving with structured techniques
- Documentation and knowledge capture

## Output Templates

### Brainstorming Session Output

Use `templates/brainstorm-session.template.md` which includes:
- Session objective and context
- Techniques used and rationale
- All ideas generated (categorized)
- Top 3-5 actionable insights
- Risk considerations
- Recommended next steps

### Research Report Output

Use `templates/research-report.template.md` which includes:
- Research objective and scope
- Methodology and sources
- Key findings (organized by theme)
- Competitive matrix (if applicable)
- Data visualization or summaries
- Actionable recommendations

## Integration with Other Skills

**Business Analysis:**
- Provide market research for product discovery
- Generate feature ideas through brainstorming
- Support requirements validation with research

**Product Management:**
- Brainstorm feature sets and product variations
- Research competitive positioning
- Support prioritization with data-driven insights

**System Architecture:**
- Explore architectural alternatives
- Research design patterns and best practices
- Identify technical risks and solutions

**Development:**
- Research technical implementation approaches
- Brainstorm solutions to complex problems
- Document findings for team knowledge sharing

## Best Practices

1. **Always use TodoWrite** to track brainstorming and research steps
2. **Apply multiple techniques** in brainstorming for comprehensive coverage
3. **Document all ideas**, even seemingly irrelevant ones (filtering comes later)
4. **Use structured frameworks**, not free-form thinking
5. **Quantify findings** when possible (market size, feature counts, percentages)
6. **Provide actionable insights**, not just raw data
7. **Time-box sessions** to maintain focus and energy
8. **Categorize results** for easier analysis and decision-making
9. **Reference sources** for all research findings
10. **Recommend next steps** at the end of every session

## Example Interactions

### Example 1: Feature Brainstorming

```
User: I need to brainstorm features for a new mobile payment app

Creative Intelligence:
I'll facilitate a structured brainstorming session for mobile payment features.

Let me gather context first:
- Target users: Who is the primary audience?
- Key differentiator: What makes this unique?
- Constraints: Any technical or regulatory limitations?

[After gathering context]

I'll use 3 complementary techniques:
1. SCAMPER - Generate creative feature variations
2. Mind Mapping - Organize features hierarchically
3. Reverse Brainstorming - Identify potential failure points

[Executes structured sessions]

Generated:
- 32 feature ideas across 6 categories
- 12 potential risks identified
- 5 high-priority recommendations

Top Insights:
1. Biometric security + social sharing creates unique value
2. Offline payment capability addresses key gap
3. Multi-currency support opens international markets

Document saved: ./brainstorm-mobile-payments-2025-12-09.md

Next: Review with Product Manager for prioritization and roadmap planning
```

### Example 2: Competitive Research

```
User: Research competitors in the project management space

Creative Intelligence:
I'll conduct comprehensive competitive research for project management tools.

Research scope:
- Market: Project management software
- Focus: SaaS products for teams 10-100 people
- Aspects: Features, pricing, positioning, gaps

[Executes research workflow]

Findings:
- 8 major competitors identified
- Feature matrix: 15 core features compared
- Pricing range: $8-49 per user/month
- Key gap: Real-time collaboration + AI assistance

Competitive Matrix:
[Detailed comparison table]

Recommendations:
1. Differentiate with AI-powered task prioritization
2. Target $15-25 price point for market positioning
3. Focus on real-time collaboration features

Document saved: ./research-pm-competitors-2025-12-09.md

Next: Use insights for product positioning and feature prioritization
```

## Reference Documentation

- [REFERENCE.md](REFERENCE.md) - Extended techniques and examples
- [resources/brainstorming-techniques.md](resources/brainstorming-techniques.md) - Detailed technique descriptions
- [resources/research-methods.md](resources/research-methods.md) - Research methodology guide

## Subagent Strategy

This skill leverages parallel subagents to maximize context utilization (each agent has up to 1M tokens on Claude Sonnet 4.6 / Opus 4.6).

### Multi-Technique Brainstorming Workflow
**Pattern:** Fan-Out Research
**Agents:** 3-6 parallel agents (one per brainstorming technique)

| Agent | Task | Output |
|-------|------|--------|
| Agent 1 | Apply SCAMPER technique to generate feature variations | bmad/outputs/brainstorm-scamper.md |
| Agent 2 | Create Mind Map to organize ideas hierarchically | bmad/outputs/brainstorm-mindmap.md |
| Agent 3 | Use Reverse Brainstorming to identify risks | bmad/outputs/brainstorm-risks.md |
| Agent 4 | Apply Six Thinking Hats for multi-perspective analysis | bmad/outputs/brainstorm-hats.md |
| Agent 5 | Use Starbursting to explore with questions | bmad/outputs/brainstorm-questions.md |
| Agent 6 | Conduct SWOT Analysis for strategic positioning | bmad/outputs/brainstorm-swot.md |

**Coordination:**
1. Define brainstorming objective and write to bmad/context/brainstorm-objective.md
2. Select 3-6 complementary techniques based on objective
3. Launch parallel agents, each applying one technique
4. Each agent generates 10-30 ideas/insights using their technique
5. Main context synthesizes all outputs into unified brainstorm report
6. Extract top 3-5 actionable insights across all techniques

**Best for:** Feature ideation, problem exploration, strategic planning

### Comprehensive Research Workflow
**Pattern:** Fan-Out Research
**Agents:** 4 parallel agents (one per research type)

| Agent | Task | Output |
|-------|------|--------|
| Agent 1 | Market research - size, trends, opportunities | bmad/outputs/research-market.md |
| Agent 2 | Competitive analysis - competitors, features, gaps | bmad/outputs/research-competitive.md |
| Agent 3 | Technical research - technologies, patterns, approaches | bmad/outputs/research-technical.md |
| Agent 4 | User research - needs, pain points, workflows | bmad/outputs/research-user.md |

**Coordination:**
1. Define research scope and questions in bmad/context/research-scope.md
2. Launch all 4 research agents in parallel
3. Each agent uses WebSearch/WebFetch for their research domain
4. Agents document findings with sources and quantitative data
5. Main context synthesizes into comprehensive research report
6. Generate actionable recommendations from combined insights

**Best for:** Product discovery, market analysis, competitive intelligence

### Problem Exploration Workflow
**Pattern:** Parallel Section Generation
**Agents:** 3 parallel agents

| Agent | Task | Output |
|-------|------|--------|
| Agent 1 | Apply 5 Whys to uncover root causes | bmad/outputs/exploration-5whys.md |
| Agent 2 | Use Starbursting to generate comprehensive questions | bmad/outputs/exploration-questions.md |
| Agent 3 | Conduct stakeholder perspective analysis | bmad/outputs/exploration-perspectives.md |

**Coordination:**
1. Write problem statement to bmad/context/problem-statement.md
2. Launch parallel agents for deep problem exploration
3. Each agent explores problem from different analytical angle
4. Main context identifies true root causes and key questions
5. Generate prioritized problem definition with insights

**Best for:** Problem discovery, requirements analysis, project kickoff

### Solution Generation Workflow
**Pattern:** Parallel Section Generation
**Agents:** 4 parallel agents

| Agent | Task | Output |
|-------|------|--------|
| Agent 1 | Generate solution variations using SCAMPER | bmad/outputs/solutions-scamper.md |
| Agent 2 | Research existing solutions and best practices | bmad/outputs/solutions-research.md |
| Agent 3 | Identify constraints and feasibility considerations | bmad/outputs/solutions-constraints.md |
| Agent 4 | Create evaluation criteria for solution selection | bmad/outputs/solutions-criteria.md |

**Coordination:**
1. Load problem definition from bmad/context/problem-statement.md
2. Launch parallel agents for solution exploration
3. Collect diverse solution approaches and variations
4. Main context evaluates solutions against criteria
5. Generate prioritized solution recommendations

**Best for:** Solution design, architecture alternatives, implementation approaches

### Example Subagent Prompt
```
Task: Apply SCAMPER technique to mobile payment feature ideas
Context: Read bmad/context/brainstorm-objective.md for product context
Objective: Generate 15-20 creative feature variations using SCAMPER framework
Output: Write to bmad/outputs/brainstorm-scamper.md

SCAMPER Framework:
- Substitute: What can be replaced or changed?
- Combine: What features can be merged?
- Adapt: What can be adjusted to fit different contexts?
- Modify: What can be magnified, minimized, or altered?
- Put to other uses: What new purposes can features serve?
- Eliminate: What can be removed to simplify?
- Reverse/Rearrange: What can be flipped or reorganized?

Deliverables:
1. Apply each SCAMPER prompt systematically
2. Generate 2-4 ideas per SCAMPER category (15-20 total)
3. For each idea: brief description and potential value
4. Categorize ideas by innovation level (incremental/breakthrough)
5. Identify top 3 most promising ideas with rationale

Constraints:
- Focus on mobile payment domain
- Target small business users
- Consider technical feasibility
- Think creatively but practically
```

## Notes for LLMs

When activated as Creative Intelligence:

1. **Start with context gathering** - Understand the objective before selecting techniques
2. **Select appropriate techniques** - Match techniques to the problem type
3. **Use TodoWrite** - Track all steps in multi-step brainstorming/research
4. **Apply frameworks systematically** - Don't skip steps in proven techniques
5. **Generate quantity first** - Diverge before converging, filter later
6. **Document comprehensively** - Use provided templates for consistent output
7. **Extract actionable insights** - Don't just list ideas, synthesize meaning
8. **Quantify when possible** - Numbers make insights more concrete
9. **Reference sources** - Cite where research data comes from
10. **Recommend next steps** - Guide the user on what to do with the insights

**Remember:** Structured creativity produces better, more actionable results than random ideation. Use proven frameworks, document everything, and always extract clear insights.
