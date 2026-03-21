#!/usr/bin/env bash
# SCAMPER Prompts Generator
# Outputs SCAMPER framework questions for a given topic

set -euo pipefail

TOPIC="${1:-}"

if [ -z "$TOPIC" ]; then
    echo "Usage: $0 <topic>"
    echo "Example: $0 'mobile payment system'"
    exit 1
fi

cat <<EOF
SCAMPER Framework for: $TOPIC

===========================================
S - SUBSTITUTE
===========================================
What can you substitute or replace?
- What materials, processes, or components can be swapped?
- What other ingredients, resources, or people could be used?
- What would happen if we used X instead of Y?
- Can we replace any part with something cheaper, faster, or better?

Questions for "$TOPIC":
→ What elements can be substituted?
→ What alternative approaches exist?
→ What can we replace to improve quality or reduce cost?

===========================================
C - COMBINE
===========================================
What can you combine or bring together?
- What features, functions, or services can merge?
- Can we combine with another product or service?
- What complementary elements could work together?
- Can we blend processes, materials, or ideas?

Questions for "$TOPIC":
→ What features can be combined?
→ What partnerships or integrations make sense?
→ What related products/services could merge with this?

===========================================
A - ADAPT
===========================================
What can you adapt or adjust?
- What else is like this? What can we copy or learn from?
- What other contexts, industries, or products have similar challenges?
- How have others solved this problem?
- What could we adjust to fit a new context or audience?

Questions for "$TOPIC":
→ What similar solutions exist in other industries?
→ What best practices can we adapt from competitors?
→ How could we adjust this for different user segments?

===========================================
M - MODIFY / MAGNIFY / MINIFY
===========================================
What can you change, exaggerate, or reduce?
- Can we change the color, shape, size, form, or motion?
- What can we magnify, amplify, or make bigger/more frequent?
- What can we minimize, streamline, or make smaller/simpler?
- Can we alter the meaning, purpose, or function?

Questions for "$TOPIC":
→ What if we made it 10x larger? 10x smaller?
→ What features can be amplified for more impact?
→ What can we simplify or minimize to improve UX?

===========================================
P - PUT TO OTHER USES
===========================================
What else can this be used for?
- Can we use this in a different way?
- What new markets or audiences could benefit?
- What byproducts or side effects could be valuable?
- Can we repurpose waste or unused capacity?

Questions for "$TOPIC":
→ What other use cases or markets exist?
→ What unexpected applications could this serve?
→ How could adjacent industries use this?

===========================================
E - ELIMINATE
===========================================
What can you remove or simplify?
- What features, steps, or components are unnecessary?
- What would happen if we removed this entirely?
- What rules or assumptions can we eliminate?
- Can we streamline by removing complexity?

Questions for "$TOPIC":
→ What features add little value and can be removed?
→ What steps in the process are unnecessary?
→ What would a minimal viable version look like?

===========================================
R - REVERSE / REARRANGE
===========================================
What can you reverse, flip, or rearrange?
- Can we reverse the order, sequence, or process?
- What if we did this backward or inside-out?
- Can we rearrange components, schedule, or layout?
- What if the user and provider roles were swapped?

Questions for "$TOPIC":
→ What if we reversed the typical user flow?
→ How could we rearrange the feature set?
→ What if users controlled what we typically control?

===========================================
SCAMPER SESSION GUIDE
===========================================

1. Set a timer for 3-5 minutes per letter
2. Generate 3-5 ideas for each prompt
3. Don't filter or judge during ideation
4. Write down every idea, even "bad" ones
5. After completing all 7, review and select promising concepts
6. Combine multiple SCAMPER ideas for novel solutions

Wild ideas often lead to breakthrough innovations!
EOF
