#!/usr/bin/env python3
"""
compliance_check.py - Format compliance checks for grant proposals.

Checks for:
  - Page/character count limits
  - Required section headings
  - Chinese punctuation consistency
  - AI-flavored writing patterns
  - Budget arithmetic
  - Paragraph length uniformity

Usage:
    python3 scripts/compliance_check.py <file> [--agency nsf|nih|nsfc] [--json]
"""

import argparse
import json
import math
import re
import sys
from pathlib import Path

# ---------------------------------------------------------------------------
# Severity levels
# ---------------------------------------------------------------------------

P0 = "P0"  # Critical
P1 = "P1"  # Warning
P2 = "P2"  # Info

# ---------------------------------------------------------------------------
# Agency-specific configuration
# ---------------------------------------------------------------------------

AGENCY_CONFIG = {
    "nsfc": {
        "name": "NSFC",
        "language": "cn",
        "char_limit": 15000,        # Chinese characters
        "required_headings": [
            r"立项依据",
            r"研究内容",
            r"研究目标",
            r"(拟解决[的]?)?关键[科学]?问题",
            r"研究方案",
            r"(技术路线|可行性分析)",
            r"(研究基础|工作条件)",
            r"(经费预算|预算说明)",
        ],
    },
    "nsf": {
        "name": "NSF",
        "language": "en",
        "page_limit": 15,            # Project Description
        "words_per_page": 250,
        "required_headings": [
            r"(?i)introduction",
            r"(?i)(intellectual\s+merit|significance)",
            r"(?i)broader\s+impacts",
            r"(?i)(approach|methodology|research\s+plan)",
            r"(?i)(timeline|schedule|milestones)",
        ],
    },
    "nih": {
        "name": "NIH",
        "language": "en",
        "page_limit": 12,            # R01 Research Strategy
        "words_per_page": 250,
        "required_headings": [
            r"(?i)significance",
            r"(?i)(innovation|innovative)",
            r"(?i)approach",
            r"(?i)(specific\s+aims|objectives)",
        ],
    },
}

# ---------------------------------------------------------------------------
# AI-flavored writing patterns
# ---------------------------------------------------------------------------

# Chinese AI patterns
CN_AI_PATTERNS = [
    (r"值得注意的是", "AI-style transition phrase"),
    (r"综上所述", "Overused summarization phrase"),
    (r"至关重要", "Overly emphatic phrasing"),
    (r"在此背景下", "Formulaic transition"),
    (r"本项目旨在", "Robotic purpose statement (repeated use)"),
    (r"不可或缺", "AI-typical emphasis"),
    (r"与此同时", "AI-style parallel connector"),
    (r"鉴于此", "Stiff transition"),
]

# English AI patterns
EN_AI_PATTERNS = [
    (r"\bFurthermore\b", "Overused transition word"),
    (r"\bMoreover\b", "Overused transition word"),
    (r"\bIt is worth noting that\b", "AI-style hedging phrase"),
    (r"\bIn this context\b", "Formulaic transition"),
    (r"\bplay(?:s)?\s+a\s+(?:crucial|pivotal|vital)\s+role\b", "AI-typical emphasis"),
    (r"\bdelve\b", "AI-favored verb"),
    (r"\btapestry\b", "AI-favored metaphor"),
    (r"\bparadigm\s+shift\b", "AI-typical buzzword"),
    (r"\bholistic\b", "AI-typical adjective"),
    (r"\bsynerg", "AI-typical buzzword (synergy/synergistic)"),
    (r"\bNotwithstanding\b", "Overly formal transition"),
    (r"\bIt is important to note\b", "AI-style hedging"),
]

# Hedging language (English)
EN_HEDGING = [
    r"\bmay\s+potentially\b",
    r"\bcould\s+possibly\b",
    r"\bit\s+is\s+(?:possible|plausible)\s+that\b",
    r"\bseems?\s+to\s+suggest\b",
    r"\bmight\s+be\s+(?:considered|argued)\b",
]

# Chinese punctuation issues: straight quotes/brackets that should be curved
CN_PUNCT_ISSUES = [
    (r'"[^"]*"', "Straight double quotes (should use \u201c\u201d)"),
    (r"'[^']*'", "Straight single quotes (should use \u2018\u2019)"),
    # Detect ASCII comma/period in otherwise Chinese text
    (r"[\u4e00-\u9fff]\s*,\s*[\u4e00-\u9fff]",
     "ASCII comma between Chinese characters (should use \uff0c)"),
    (r"[\u4e00-\u9fff]\s*\.\s*[\u4e00-\u9fff]",
     "ASCII period between Chinese characters (should use \u3002)"),
]


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def read_file(path: Path) -> str:
    try:
        return path.read_text(encoding="utf-8")
    except UnicodeDecodeError:
        return path.read_text(encoding="latin-1")


def count_chinese_chars(text: str) -> int:
    return sum(1 for ch in text if "\u4e00" <= ch <= "\u9fff")


def count_words(text: str) -> int:
    return len(re.findall(r"[A-Za-z]+(?:['\u2019-][A-Za-z]+)*", text))


# ---------------------------------------------------------------------------
# Check: page / character limits
# ---------------------------------------------------------------------------

def check_limits(text: str, config: dict) -> list:
    issues = []
    if config["language"] == "cn":
        chars = count_chinese_chars(text)
        limit = config.get("char_limit", 0)
        if limit and chars > limit:
            issues.append({
                "severity": P0,
                "type": "over_char_limit",
                "message": f"Character count {chars} exceeds limit of {limit}.",
            })
        elif limit and chars < limit * 0.5:
            issues.append({
                "severity": P1,
                "type": "under_char_target",
                "message": (
                    f"Character count {chars} is less than 50% of the "
                    f"{limit} limit -- proposal may be too short."
                ),
            })
    else:
        words = count_words(text)
        wpp = config.get("words_per_page", 250)
        pages = words / wpp if wpp else 0
        limit = config.get("page_limit", 0)
        if limit and pages > limit:
            issues.append({
                "severity": P0,
                "type": "over_page_limit",
                "message": (
                    f"Estimated {pages:.1f} pages ({words} words at "
                    f"{wpp} words/page) exceeds {limit}-page limit."
                ),
            })
    return issues


# ---------------------------------------------------------------------------
# Check: required section headings
# ---------------------------------------------------------------------------

def check_headings(text: str, config: dict) -> list:
    issues = []
    for pattern in config.get("required_headings", []):
        if not re.search(pattern, text):
            issues.append({
                "severity": P1,
                "type": "missing_heading",
                "message": f"Required heading pattern not found: {pattern}",
            })
    return issues


# ---------------------------------------------------------------------------
# Check: Chinese punctuation consistency
# ---------------------------------------------------------------------------

def check_cn_punctuation(text: str) -> list:
    issues = []
    # Only check if text is substantially Chinese
    if count_chinese_chars(text) < 100:
        return issues

    for pattern, description in CN_PUNCT_ISSUES:
        matches = list(re.finditer(pattern, text))
        if matches:
            # Find line numbers for first few occurrences
            line_numbers = []
            for m in matches[:5]:
                lineno = text[:m.start()].count("\n") + 1
                line_numbers.append(lineno)
            issues.append({
                "severity": P1,
                "type": "punctuation_inconsistency",
                "message": f"{description} ({len(matches)} occurrence(s))",
                "lines": line_numbers,
            })
    return issues


# ---------------------------------------------------------------------------
# Check: AI-flavored patterns
# ---------------------------------------------------------------------------

def check_ai_patterns(text: str, language: str) -> list:
    issues = []
    patterns = CN_AI_PATTERNS if language == "cn" else EN_AI_PATTERNS

    total_hits = 0
    details = []
    for pattern, description in patterns:
        matches = list(re.finditer(pattern, text))
        if matches:
            total_hits += len(matches)
            line_numbers = []
            for m in matches[:3]:
                lineno = text[:m.start()].count("\n") + 1
                line_numbers.append(lineno)
            details.append({
                "pattern": description,
                "count": len(matches),
                "sample_lines": line_numbers,
            })

    if total_hits > 0:
        severity = P1 if total_hits >= 5 else P2
        issues.append({
            "severity": severity,
            "type": "ai_writing_patterns",
            "message": (
                f"Detected {total_hits} potential AI-flavored phrase(s) "
                f"across {len(details)} pattern(s)."
            ),
            "details": details,
        })

    # Hedging language (English only)
    if language == "en":
        hedge_count = 0
        for pat in EN_HEDGING:
            hedge_count += len(re.findall(pat, text, re.IGNORECASE))
        if hedge_count >= 3:
            issues.append({
                "severity": P2,
                "type": "excessive_hedging",
                "message": f"Found {hedge_count} hedging phrase(s) -- may weaken the proposal.",
            })

    return issues


# ---------------------------------------------------------------------------
# Check: paragraph length uniformity (unnaturally balanced = AI signal)
# ---------------------------------------------------------------------------

def check_paragraph_uniformity(text: str) -> list:
    issues = []
    # Split into paragraphs (blank-line separated)
    paragraphs = [p.strip() for p in re.split(r"\n\s*\n", text) if p.strip()]
    if len(paragraphs) < 4:
        return issues  # too few to assess

    lengths = [len(p) for p in paragraphs]
    mean_len = sum(lengths) / len(lengths)
    if mean_len == 0:
        return issues

    variance = sum((l - mean_len) ** 2 for l in lengths) / len(lengths)
    stddev = math.sqrt(variance)
    cv = stddev / mean_len  # coefficient of variation

    # Suspiciously uniform if CV < 0.15 with enough paragraphs
    if cv < 0.15 and len(paragraphs) >= 6:
        issues.append({
            "severity": P2,
            "type": "uniform_paragraph_lengths",
            "message": (
                f"Paragraph lengths are unusually uniform (CV={cv:.2f}, "
                f"{len(paragraphs)} paragraphs, mean {mean_len:.0f} chars). "
                "This can be a signal of AI-generated text."
            ),
        })
    return issues


# ---------------------------------------------------------------------------
# Check: budget arithmetic
# ---------------------------------------------------------------------------

def check_budget(text: str) -> list:
    """Look for a budget section and verify that line items sum to stated total."""
    issues = []

    # Try to find a budget section
    budget_match = re.search(
        r"(?:经费预算|预算说明|[Bb]udget|[Cc]ost\s+[Ee]stimate)[^\n]*\n([\s\S]{0,3000})",
        text,
    )
    if not budget_match:
        return issues

    block = budget_match.group(1)
    # Extract numbers that look like monetary amounts (integers or with commas)
    amounts = []
    for m in re.finditer(r"(?:[\$\uffe5]?\s*)([\d,]+(?:\.\d{1,2})?)\s*(?:万|元|dollars?|USD|RMB)?", block):
        raw = m.group(1).replace(",", "")
        try:
            amounts.append(float(raw))
        except ValueError:
            continue

    if len(amounts) < 3:
        return issues  # not enough data

    # Heuristic: the largest number might be a total; check if others sum to it
    amounts_sorted = sorted(amounts)
    largest = amounts_sorted[-1]
    rest = amounts_sorted[:-1]
    rest_sum = sum(rest)

    # Check if the rest approximately sums to the largest
    if rest_sum > 0 and largest > 0:
        diff = abs(rest_sum - largest)
        if diff > 0 and diff / largest > 0.01:
            # Only flag if it's close-ish (within 20%) -- otherwise it's likely
            # not a total at all
            if diff / largest < 0.20:
                lineno = text[:budget_match.start()].count("\n") + 1
                issues.append({
                    "severity": P1,
                    "type": "budget_arithmetic",
                    "message": (
                        f"Budget line items sum to {rest_sum:,.2f} but "
                        f"apparent total is {largest:,.2f} "
                        f"(difference: {diff:,.2f})."
                    ),
                    "line": lineno,
                })

    return issues


# ---------------------------------------------------------------------------
# Main orchestration
# ---------------------------------------------------------------------------

def run_checks(text: str, agency: str) -> dict:
    config = AGENCY_CONFIG[agency]
    language = config["language"]

    all_issues = []
    all_issues.extend(check_limits(text, config))
    all_issues.extend(check_headings(text, config))
    all_issues.extend(check_ai_patterns(text, language))
    all_issues.extend(check_paragraph_uniformity(text))
    all_issues.extend(check_budget(text))

    if language == "cn":
        all_issues.extend(check_cn_punctuation(text))

    report = {
        "agency": config["name"],
        "language": language,
        "total_issues": len(all_issues),
        "p0_count": sum(1 for i in all_issues if i["severity"] == P0),
        "p1_count": sum(1 for i in all_issues if i["severity"] == P1),
        "p2_count": sum(1 for i in all_issues if i["severity"] == P2),
        "issues": all_issues,
        "pass": all(i["severity"] != P0 for i in all_issues),
    }
    return report


# ---------------------------------------------------------------------------
# Human-readable formatting
# ---------------------------------------------------------------------------

def format_report(report: dict) -> str:
    lines = []
    lines.append(
        f"=== Compliance Check Report (agency: {report['agency']}) ===\n"
    )
    lines.append(
        f"Issues found: {report['total_issues']} "
        f"(P0: {report['p0_count']}, P1: {report['p1_count']}, "
        f"P2: {report['p2_count']})"
    )

    if report["issues"]:
        lines.append("")
        for issue in report["issues"]:
            sev = issue["severity"]
            lines.append(f"  [{sev}] {issue['message']}")
            if "lines" in issue:
                lines.append(f"        Lines: {issue['lines']}")
            if "line" in issue:
                lines.append(f"        Near line: {issue['line']}")
            if "details" in issue:
                for d in issue["details"]:
                    lines.append(
                        f"        - {d['pattern']}: {d['count']}x "
                        f"(e.g. lines {d['sample_lines']})"
                    )
    else:
        lines.append("\nNo issues found.")

    status = "PASS" if report["pass"] else "FAIL"
    lines.append(f"\nOverall: {status}")
    return "\n".join(lines)


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(
        description="Perform format compliance checks on a grant proposal."
    )
    parser.add_argument(
        "file",
        help="Path to the proposal file (.tex, .md, .txt)",
    )
    parser.add_argument(
        "--agency",
        choices=["nsf", "nih", "nsfc"],
        default="nsfc",
        help="Funding agency for agency-specific checks (default: nsfc)",
    )
    parser.add_argument(
        "--json",
        action="store_true",
        dest="output_json",
        help="Output machine-readable JSON instead of human-readable text",
    )
    args = parser.parse_args()

    filepath = Path(args.file)
    if not filepath.is_file():
        print(f"Error: '{filepath}' is not a file.", file=sys.stderr)
        sys.exit(1)

    if filepath.suffix.lower() not in (".tex", ".md", ".txt"):
        print(
            f"Error: Unsupported file type '{filepath.suffix}'. "
            "Supported: .tex, .md, .txt",
            file=sys.stderr,
        )
        sys.exit(1)

    text = read_file(filepath)
    report = run_checks(text, args.agency)
    report["file"] = str(filepath)

    if args.output_json:
        print(json.dumps(report, ensure_ascii=False, indent=2))
    else:
        print(format_report(report))

    sys.exit(0 if report["pass"] else 1)


if __name__ == "__main__":
    main()
