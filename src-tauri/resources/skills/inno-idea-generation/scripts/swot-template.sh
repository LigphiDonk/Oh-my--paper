#!/usr/bin/env bash
# SWOT Analysis Template Generator
# Outputs a formatted SWOT analysis template

set -euo pipefail

SUBJECT="${1:-your project/product/initiative}"

cat <<EOF
SWOT Analysis: $SUBJECT
Date: $(date +%Y-%m-%d)

=============================================================================
INTERNAL FACTORS (What you control)
=============================================================================

STRENGTHS                                 | WEAKNESSES
What advantages do you have?              | What could be improved?
What do you do well?                      | Where are resources lacking?
What unique resources exist?              | What do competitors do better?
What do others see as strengths?          | What factors cause lost sales?
------------------------------------------|----------------------------------
                                         |
1.                                        | 1.
                                         |
2.                                        | 2.
                                         |
3.                                        | 3.
                                         |
4.                                        | 4.
                                         |
5.                                        | 5.
                                         |

=============================================================================
EXTERNAL FACTORS (What you don't control)
=============================================================================

OPPORTUNITIES                             | THREATS
What good opportunities are available?    | What threats could harm you?
What trends could you take advantage of?  | What is your competition doing?
How can you turn strengths into opps?    | What obstacles do you face?
What changes in market/tech/policy exist? | Are quality standards changing?
------------------------------------------|----------------------------------
                                         |
1.                                        | 1.
                                         |
2.                                        | 2.
                                         |
3.                                        | 3.
                                         |
4.                                        | 4.
                                         |
5.                                        | 5.
                                         |

=============================================================================
STRATEGIC ACTIONS
=============================================================================

SO Strategies (Strength + Opportunity)
Use strengths to capitalize on opportunities:
→
→
→

ST Strategies (Strength + Threat)
Use strengths to avoid or mitigate threats:
→
→
→

WO Strategies (Weakness + Opportunity)
Overcome weaknesses by taking advantage of opportunities:
→
→
→

WT Strategies (Weakness + Threat)
Minimize weaknesses and avoid threats:
→
→
→

=============================================================================
PRIORITY ACTIONS
=============================================================================

Top 3 actions to take based on this analysis:

1.

2.

3.

=============================================================================
COMPLETION GUIDE
=============================================================================

How to complete your SWOT:

STRENGTHS - Ask yourself:
- What do we do better than anyone else?
- What unique resources or assets do we have?
- What do customers love about us?
- What awards, recognition, or certifications do we have?

WEAKNESSES - Ask yourself:
- What do competitors do better?
- Where are we lacking resources (people, budget, tech)?
- What complaints do customers have?
- What processes could be more efficient?

OPPORTUNITIES - Look for:
- Emerging market trends we can capitalize on
- Customer needs not being met by competitors
- New technologies that could help us
- Regulatory changes that favor our approach
- Partnerships or collaborations possible

THREATS - Consider:
- Strong competitors entering the market
- Changing customer preferences
- Economic conditions affecting demand
- New regulations or compliance requirements
- Technology disruptions

Remember: Be honest! The value of SWOT is in revealing truth, not wishful thinking.
EOF
