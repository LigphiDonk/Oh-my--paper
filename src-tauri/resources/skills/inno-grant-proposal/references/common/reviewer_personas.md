# Reviewer Personas for Simulated Grant Review

## Purpose

Simulated review using realistic reviewer personas helps applicants anticipate criticisms before submission. This file defines personas for both US and CN funding tracks, along with guidance on applying them.

---

## US Track: 3-Pass Simulation

US federal grant review (NIH study sections, NSF panels) follows a pattern where reviewers read proposals under significant time pressure. The 3-pass simulation mirrors real reviewer behavior.

### Pass 1: The 2-Minute Triage

**Simulates:** A tired reviewer scanning the proposal at the end of a long day, deciding whether it deserves serious attention.

**What they look at (in order):**
1. Title - Is it clear and compelling? Does it signal innovation?
2. Specific Aims page - The single most important page in any NIH proposal
3. Abstract / Project Summary - Does it convey significance and approach?
4. Figures and tables - Are they self-explanatory? Professional quality?
5. PI credentials - Quick glance at biosketch highlights

**Key questions:**
- "Do I understand what this project is about within 30 seconds?"
- "Is this important? Will it move the field forward?"
- "Does this person have the expertise to pull this off?"
- "Is this fundable or is it going in the bottom half?"

**Common triage failures:**
- Title is too long, too vague, or too clever
- Aims page buries the hypothesis in paragraph 3
- Abstract reads like a methods section instead of a story
- Figures are blurry, unlabeled, or irrelevant
- No clear gap statement

**Scoring impact:** Proposals that fail triage often receive scores in the bottom 50% without detailed reading. At NIH, roughly 50% of proposals are "not discussed" (triaged out).

---

### Pass 2: The 15-Minute Deep Read

**Simulates:** A reviewer reading a proposal they found promising in triage, now scrutinizing methodology, innovation, and feasibility.

**Focus areas:**

| Area | Weight (NIH) | Weight (NSF) | Key Scrutiny Points |
|------|-------------|-------------|---------------------|
| Significance | 25% | 50% (Intellectual Merit) | Gap in knowledge, public health/societal relevance |
| Innovation | 20% | ↑ (part of IM) | What is genuinely new vs. incremental |
| Approach | 25% | ↑ (part of IM) | Rigor, controls, statistics, alternatives |
| Investigators | 20% | 50% (Broader Impacts) | Track record, team synergy |
| Environment | 10% | ↑ (part of BI) | Resources, institutional support |

> **Note:** NIH weights match the scoring rubric (see `../rubrics/nih_rubric.json`). NSF uses two equally-weighted categories (Intellectual Merit 50%, Broader Impacts 50%) rather than five separate criteria — the mapping above is approximate.

**Key questions:**
- "Is the hypothesis testable and falsifiable?"
- "Are the methods appropriate for these questions?"
- "What happens if Aim 1 fails - can Aim 2 still proceed?"
- "Are the statistical plans adequate for the proposed sample sizes?"
- "Where are the contingency plans?"
- "Is the timeline realistic for the budget and personnel?"
- "What's actually innovative here vs. what's just claimed as innovative?"

**Common deep-read criticisms:**
- Insufficient power analysis or sample size justification
- No rigor considerations (sex as biological variable, authentication of key resources)
- Methods described at too high a level ("standard techniques will be used")
- Aims are too interdependent - failure of one collapses the project
- Innovation is stated but not demonstrated
- Preliminary data is weak or missing for key claims
- Alternative approaches are listed but not actually developed

---

### Pass 3: Criteria-by-Criteria Scoring

**Simulates:** The reviewer assigning a formal score using the agency's rubric.

**NIH Scoring (1-9 scale, 1 = exceptional):**

| Score Range | Descriptor | Meaning |
|-------------|-----------|---------|
| 1 | Exceptional | Top 1-2%, virtually no weaknesses |
| 2 | Outstanding | Top 5%, minor weaknesses only |
| 3 | Excellent | Top 10-15%, some weaknesses but strong overall |
| 4 | Very Good | Solid but notable weaknesses |
| 5 | Good | Roughly equal strengths and weaknesses |
| 6 | Satisfactory | Some strengths but significant weaknesses |
| 7 | Fair | Few strengths, numerous weaknesses |
| 8-9 | Poor/Marginal | Fundamental problems |

**Score each criterion independently:**
- Significance: ___
- Investigator(s): ___
- Innovation: ___
- Approach: ___
- Environment: ___
- Overall Impact: ___ (not an average; reflects holistic assessment)

**NSF Scoring (narrative-based):**
Rate on Intellectual Merit and Broader Impacts using:
- Excellent / Very Good / Good / Fair / Poor

**Scoring tips for simulation:**
- The overall impact score is NOT an average of criterion scores
- A fatal flaw in Approach can sink a proposal even with outstanding Significance
- Reviewers anchor on weaknesses more than strengths
- The written critique matters more than the number

---

## CN Track: 7 Expert Personas

NSFC (National Natural Science Foundation of China) review panels typically include 3-5 experts per proposal. The following 7 personas represent the range of reviewer perspectives encountered. Simulating all 7 provides comprehensive coverage.

### Persona 1: Innovation Expert (创新性专家)

**Focus area:** Novelty of scientific concepts, originality of approach, departure from existing paradigms.

**Scoring weight:** ~20% of overall evaluation

**Key questions:**
- "What is genuinely new here that has not been done before?"
- "Does this challenge existing paradigms or merely extend them?"
- "Is the innovation in the concept, the method, or both?"
- "How does this compare to international frontier research?"
- "Is this '跟踪研究' (follow-up research) or '原创研究' (original research)?"

**Common criticisms:**
- "The proposed approach is essentially [Author X]'s method applied to a different system - this is incremental, not innovative."
- "The innovation is claimed but not substantiated. Similar work has been published by [group] in [year]."
- "The project lacks a clear theoretical breakthrough; it is primarily a technology application."
- "创新性不足，主要是对已有方法的改进和应用" (Insufficient innovation; mainly improvement and application of existing methods)

**What satisfies this reviewer:**
- Clear articulation of what is new and why it matters
- Comparison table showing how the approach differs from state-of-the-art
- Evidence that the concept has not been explored elsewhere
- A compelling "why now?" argument

---

### Persona 2: Methodology Expert (方法学专家)

**Focus area:** Technical rigor, experimental design, statistical validity, reproducibility.

**Scoring weight:** ~25% of overall evaluation

**Key questions:**
- "Are the methods appropriate for answering the stated questions?"
- "Is the experimental design rigorous with proper controls?"
- "Are sample sizes justified with power calculations?"
- "Is the analytical pipeline validated?"
- "Can these results be reproduced by another lab?"

**Common criticisms:**
- "The proposed characterization relies solely on [technique] without orthogonal validation."
- "No power analysis is provided. The sample size of N=3 is insufficient for the claimed statistical comparisons."
- "The computational pipeline lacks benchmarking against established methods."
- "技术路线不够清晰，缺乏关键实验的详细方案" (Technical roadmap is unclear; detailed plans for key experiments are missing)
- "缺少必要的对照实验设计" (Missing necessary control experiment design)

**What satisfies this reviewer:**
- Detailed protocols with specific parameters (not "standard methods")
- Power calculations with effect size justification
- Validation strategy using orthogonal methods
- Clear decision trees for interpreting ambiguous results
- Contingency plans for technical failures

---

### Persona 3: Foundation Expert (研究基础专家)

**Focus area:** PI track record, team composition, institutional resources, preliminary data quality.

**Scoring weight:** ~20% of overall evaluation

**Key questions:**
- "Does the PI have relevant publications in this specific area?"
- "Is the team composition adequate for all proposed methods?"
- "Are the preliminary data convincing and directly relevant?"
- "Does the institution provide necessary infrastructure?"
- "Has the PI successfully completed previous funded projects?"

**Common criticisms:**
- "The PI's publication record is primarily in [field A], but the proposal is in [field B] - the transition rationale is unclear."
- "Preliminary data are from a different system and may not translate."
- "The team lacks expertise in [specific method] which is central to Aim 2."
- "申请人前期研究基础与本项目关联性不强" (The applicant's prior research foundation is not strongly connected to this project)
- "缺乏直接相关的前期工作积累" (Lacking directly relevant preliminary work)

**What satisfies this reviewer:**
- Publications in high-quality journals directly related to the proposal
- Preliminary data that directly supports feasibility of key experiments
- Named collaborators with complementary expertise and letters of support
- Evidence of institutional commitment (startup funds, core facilities)
- Track record of completing funded projects on time

---

### Persona 4: Strict Reviewer (严格审稿人)

**Focus area:** Finding every possible flaw, gap, inconsistency, and overstatement.

**Scoring weight:** N/A - this persona represents the worst-case reviewer.

**Key questions:**
- "What could go wrong with this project?"
- "Where are the logical gaps?"
- "What claims are unsupported by evidence?"
- "What has been omitted or glossed over?"
- "Is the budget justified for what is proposed?"

**Common criticisms:**
- "The timeline is unrealistic. Aim 1 alone would take 2 years, leaving insufficient time for Aims 2-3."
- "The budget allocates 60% to personnel but the key experiments require expensive reagents/equipment not budgeted."
- "The proposal claims X will be achieved but provides no mechanism for how."
- "Pages 8-12 are largely literature review with minimal original contribution."
- "研究内容过于庞大，难以在资助期限内完成" (Research scope is too ambitious; difficult to complete within the funding period)
- "经费预算与研究内容不匹配" (Budget does not match research content)

**What satisfies this reviewer:**
- Honest acknowledgment of limitations and risks
- Specific contingency plans for each major risk
- Tight alignment between aims, methods, timeline, and budget
- Conservative claims supported by data
- No hand-waving or vague promises

---

### Persona 5: Constructive Reviewer (建设性审稿人)

**Focus area:** Balanced assessment, identifying both strengths and actionable improvements.

**Scoring weight:** N/A - this persona represents a favorable but fair reviewer.

**Key questions:**
- "What is the strongest aspect of this proposal?"
- "What would make this proposal significantly stronger?"
- "Are there missed opportunities the applicant should consider?"
- "How could the scope be refined for maximum impact?"
- "What additional preliminary data would be most convincing?"

**Common feedback patterns:**
- "The core idea is strong but would benefit from [specific suggestion]."
- "Consider adding [method/analysis] to strengthen the validation of Aim 2."
- "The proposal would be strengthened by narrowing from 4 aims to 3 and deepening the methodology for each."
- "建议申请人补充[具体实验]的前期数据以增强可行性论证" (Suggest the applicant supplement preliminary data for [specific experiment] to strengthen feasibility argument)
- "建议适当缩小研究范围，聚焦于最核心的科学问题" (Suggest appropriately narrowing the research scope to focus on the core scientific question)

**Value in simulation:**
- Helps identify which weaknesses are fixable before submission
- Provides concrete improvement suggestions
- Models the "friendly reviewer" who might advocate for your proposal in panel discussion

---

### Persona 6: Significance Expert (价值评估专家)

**Focus area:** Academic significance, societal impact, potential for field advancement, translational value.

**Scoring weight:** ~20% of overall evaluation

**Key questions:**
- "Will this research advance fundamental understanding?"
- "What is the potential for translational impact?"
- "Does this address a national strategic need?"
- "Will this open new research directions?"
- "How does this compare to international priorities in the field?"
- "Does this align with NSFC's current priority areas (优先资助领域)?"

**Common criticisms:**
- "The scientific question, while technically interesting, has limited broader impact."
- "The translational pathway from basic findings to application is not articulated."
- "The proposal does not address how findings will benefit the broader scientific community."
- "研究意义论述不够充分，未能清楚阐明该研究的学术价值" (Research significance is insufficiently discussed; academic value is not clearly articulated)
- "与国家重大需求的关联性不明确" (Connection to major national needs is unclear)

**What satisfies this reviewer:**
- Clear statement of the knowledge gap and why filling it matters
- Explicit connection to broader scientific or societal goals
- Realistic translational pathway (if applicable)
- Alignment with national strategic priorities (for NSFC: "双一流", "卡脖子" technologies, etc.)

---

### Persona 7: Clarity Expert (表达清晰度专家)

**Focus area:** Writing quality, logical flow, figure quality, overall readability.

**Scoring weight:** ~15% of overall evaluation (implicit - poor clarity hurts all other scores)

**Key questions:**
- "Can I understand the main idea within the first two paragraphs?"
- "Does each section logically flow into the next?"
- "Are figures clear, well-labeled, and necessary?"
- "Is the writing concise without sacrificing precision?"
- "Are key terms defined and used consistently?"

**Common criticisms:**
- "The proposal is difficult to follow. The logical connection between the problem statement and the proposed approach is unclear."
- "Figure 3 is low resolution and the axis labels are unreadable."
- "The proposal switches between multiple frameworks without clearly connecting them."
- "行文逻辑不够清晰，各部分之间缺乏有效衔接" (Writing logic is unclear; sections lack effective transitions)
- "图表质量较低，部分标注不清" (Figure quality is low; some labels are unclear)
- "专业术语使用不规范" (Professional terminology is used inconsistently)

**What satisfies this reviewer:**
- Clear topic sentences at the start of every paragraph
- Logical progression: gap -> hypothesis -> approach -> expected outcomes
- High-quality, self-explanatory figures with complete legends
- Consistent terminology throughout
- Appropriate use of formatting (bold, headers, numbering) for scanability

---

## Funding Constraint Awareness

### The Critical Distinction: Design Error vs. Budget-Constrained Compromise

When simulating review, it is essential to distinguish between two fundamentally different types of weaknesses:

**Design Errors** - Flaws that reflect poor scientific thinking:
- Using an inappropriate statistical test
- Missing a critical control group
- Ignoring a confounding variable
- Proposing methods that cannot answer the stated question
- These should ALWAYS be flagged and corrected

**Budget-Constrained Compromises** - Deliberate trade-offs due to limited resources:
- Using N=5 instead of N=20 per group (because the funding level only supports a pilot)
- Using a proxy measure instead of the gold standard (because the gold standard costs 10x more)
- Proposing 2 cell lines instead of 10 (because reagent costs are limiting)
- Omitting a validation cohort (because a second clinical site is beyond scope)
- These should be ACKNOWLEDGED honestly but not treated as fatal flaws

### How to Handle Budget-Constrained Compromises in Review Simulation

1. **Identify the constraint explicitly:** "Given the [funding mechanism] budget of [amount], the proposed sample size represents a reasonable pilot study."

2. **Explain the trade-off:** "The applicant chose [approach A] over [approach B] because [cost/resource reason]. This is a reasonable compromise that still addresses the core question."

3. **Suggest mitigation language:** "Acknowledge this limitation and describe how results will inform a larger follow-up study."

4. **Flag when a compromise becomes a design error:** If a budget constraint makes the entire aim unfeasible (e.g., sample size too small to detect any meaningful effect), it crosses from compromise to design error. The aim should be restructured, not just acknowledged.

### Examples by Funding Level

| Mechanism | Typical Budget | Acceptable Compromises | Unacceptable Compromises |
|-----------|---------------|----------------------|------------------------|
| NIH R21 | $275K/2yr | Pilot sample sizes, single model system, limited validation | No preliminary data at all, no statistical plan |
| NIH R01 | $250K/yr direct | Focused on 2-3 models, single site | No replication, no power analysis |
| NSF Standard | $200-500K/3yr | Computational-only validation, limited field sites | No broader impacts plan |
| NSFC Youth (青年基金) | 30万/3yr | Single technical approach, focused scope | Overly ambitious multi-aim proposal |
| NSFC General (面上项目) | 50-80万/4yr | Limited clinical samples, focused cohort | No preliminary data for key methods |
| NSFC Key (重点项目) | 250-350万/5yr | Few compromises expected at this level | Shortcuts in methodology or validation |

---

## How to Use These Personas in Practice

### For US Proposals:
1. Run Pass 1 on the Specific Aims page and abstract. If it fails triage, stop and fix before proceeding.
2. Run Pass 2 on the full Research Strategy. Document every criticism.
3. Run Pass 3 to generate a mock score. If overall impact > 3, significant revision is needed.

### For CN Proposals:
1. Run all 7 personas sequentially on the full proposal.
2. Compile criticisms into a master list.
3. Prioritize: criticisms from Persona 4 (Strict) that overlap with other personas are highest priority.
4. Use Persona 5 (Constructive) feedback for improvement direction.
5. Rewrite sections that receive criticism from 3+ personas.

### For Both Tracks:
- Always apply Funding Constraint Awareness before finalizing the simulated review.
- Flag items as [DESIGN ERROR] or [BUDGET COMPROMISE] explicitly.
- Provide a "Reviewer Confidence" estimate (how confident the simulated reviewer is in each criticism).
