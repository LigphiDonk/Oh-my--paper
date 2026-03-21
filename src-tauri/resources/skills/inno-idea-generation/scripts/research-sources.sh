#!/usr/bin/env bash
# Research Sources Reference
# Lists research source types and examples for different research objectives

set -euo pipefail

cat <<'EOF'
Research Sources Guide
======================

=============================================================================
MARKET RESEARCH SOURCES
=============================================================================

Industry Reports & Analysis:
- Gartner, Forrester, IDC (technology markets)
- IBISWorld (industry statistics)
- Statista (market data and statistics)
- CB Insights (venture and emerging markets)
- PitchBook (private markets and M&A)

Market Size & Growth:
- Grand View Research
- MarketsandMarkets
- Allied Market Research
- Fortune Business Insights

Government & Official Statistics:
- U.S. Census Bureau
- Bureau of Labor Statistics
- SEC EDGAR (public company filings)
- Patent databases (USPTO, WIPO)

Financial Data:
- Yahoo Finance / Google Finance
- Annual reports (investor relations pages)
- Quarterly earnings calls transcripts
- Form 10-K filings

=============================================================================
COMPETITIVE RESEARCH SOURCES
=============================================================================

Company Information:
- Company websites (About, Careers, Press pages)
- LinkedIn company pages
- Crunchbase (funding, team size, investors)
- Product Hunt (product launches)

Product Analysis:
- G2, Capterra, TrustRadius (user reviews)
- Product documentation and help centers
- YouTube product demos and tutorials
- GitHub repositories (for developer tools)

Social Media & Community:
- Twitter/X (company announcements)
- Reddit (user discussions and complaints)
- Quora (common questions and comparisons)
- Discord/Slack communities

News & Press:
- TechCrunch, VentureBeat (tech news)
- Industry-specific publications
- Company press releases
- Podcast interviews with founders

=============================================================================
TECHNICAL RESEARCH SOURCES
=============================================================================

Documentation & Guides:
- Official framework/library documentation
- MDN Web Docs (web technologies)
- Microsoft Learn, AWS Docs, Google Cloud Docs
- ReadTheDocs, GitBook

Code & Implementation:
- GitHub (repositories, discussions, issues)
- Stack Overflow (Q&A, common problems)
- npm/PyPI/Maven (package registries)
- CodePen, JSFiddle (code examples)

Technical Communities:
- Dev.to (articles and tutorials)
- Hacker News (discussions)
- Reddit (r/programming, language-specific subs)
- Discord servers for frameworks/languages

Benchmarks & Comparisons:
- TechEmpower Framework Benchmarks
- DB-Engines (database rankings)
- State of JS/CSS/etc. surveys
- ThoughtWorks Technology Radar

Academic & Research:
- Google Scholar
- arXiv.org (pre-prints)
- ACM Digital Library
- IEEE Xplore

=============================================================================
USER RESEARCH SOURCES
=============================================================================

User Behavior & Trends:
- Google Trends
- Pew Research Center
- Nielsen Norman Group
- Baymard Institute (e-commerce UX)

User Feedback:
- App Store / Google Play reviews
- Trustpilot, Yelp (service reviews)
- Support ticket analysis
- Social media mentions

Usability & Accessibility:
- W3C Web Accessibility Guidelines (WCAG)
- UsabilityHub (user testing)
- Hotjar, FullStory (session recordings)
- UserTesting.com

Demographics & Personas:
- Pew Research Center
- U.S. Census data
- Facebook Audience Insights
- SurveyMonkey Audience

=============================================================================
RESEARCH METHOD GUIDE
=============================================================================

PRIMARY RESEARCH (You conduct directly):
✓ User interviews
✓ Surveys and questionnaires
✓ Usability testing
✓ A/B testing
✓ Analytics analysis
✓ Customer support analysis
✓ Focus groups

SECONDARY RESEARCH (Existing information):
✓ Market reports
✓ Competitor analysis
✓ Academic papers
✓ News articles
✓ Government statistics
✓ Social media analysis
✓ Review mining

=============================================================================
RECOMMENDED TOOLS FOR RESEARCH
=============================================================================

Web Search & Discovery:
→ WebSearch tool - Market trends, competitor info, general research
→ WebFetch tool - Fetch specific URLs for documentation/articles
→ Google/Bing - Broad search across the internet

Code & Documentation Search:
→ Grep tool - Search codebase for patterns
→ Glob tool - Find files by name/pattern
→ Read tool - Read specific files

Data Organization:
→ Write tool - Save research findings
→ Edit tool - Update research documents
→ TodoWrite tool - Track research steps

=============================================================================
RESEARCH WORKFLOW EXAMPLE
=============================================================================

Example: Researching "AI-powered customer support tools"

Step 1: Define scope
→ What questions need answers?
→ What's the decision or output?

Step 2: Identify sources
→ Market size: Grand View Research, Statista
→ Competitors: G2, Capterra, company websites
→ Technical: GitHub, Stack Overflow, documentation
→ Users: Reddit, reviews, support forums

Step 3: Gather data
→ Use WebSearch for broad discovery
→ Use WebFetch for specific resources
→ Document findings as you go

Step 4: Analyze & synthesize
→ Look for patterns across sources
→ Identify gaps and opportunities
→ Quantify findings when possible

Step 5: Document & recommend
→ Create structured research report
→ Highlight key insights
→ Provide actionable recommendations

=============================================================================
BEST PRACTICES
=============================================================================

1. Start with secondary research before primary (faster, cheaper)
2. Triangulate - verify findings across multiple sources
3. Check publish dates - ensure information is current
4. Consider source bias - who published and why?
5. Quantify when possible - numbers are more actionable
6. Document sources - cite where data comes from
7. Look for gaps - what's not being said or shown?
8. Set time limits - research can be endless, time-box it
9. Focus on decisions - research should drive action
10. Update regularly - markets and tech change quickly

=============================================================================

For research methodology details, see:
/home/aj-geddes/dev/claude-projects/claude-code-bmad-skills/bmad-skills/creative-intelligence/resources/research-methods.md
EOF
