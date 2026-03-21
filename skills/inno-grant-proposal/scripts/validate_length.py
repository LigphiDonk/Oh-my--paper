#!/usr/bin/env python3
"""
validate_length.py - Check proposal section lengths against target ratios.

Supports Chinese (NSFC) and US (NSF/NIH) grant proposals.
Detects file types (.tex, .md, .txt) and counts characters (Chinese) or words (English).

Usage:
    python3 scripts/validate_length.py <proposal_dir> [--mode cn|us] [--json]
"""

import argparse
import json
import os
import re
import sys
from pathlib import Path

# ---------------------------------------------------------------------------
# Configurable targets
# ---------------------------------------------------------------------------

# NSFC golden ratio: justification 30%, content 50%, foundation 20%
NSFC_RATIOS = {
    "justification": 0.30,  # 立项依据 / 项目意义
    "content": 0.50,        # 研究内容 / 方案
    "foundation": 0.20,     # 研究基础 / 工作条件
}
NSFC_TOTAL_MIN = 12000  # Chinese characters
NSFC_TOTAL_MAX = 15000

# US proposals: page-based estimates
US_WORDS_PER_PAGE = 250
US_CHARS_PER_PAGE = 500  # for Chinese text in US proposals (rare but supported)

# Deviation threshold (fraction, not percentage)
DEVIATION_THRESHOLD = 0.05

# ---------------------------------------------------------------------------
# Section heading patterns
# ---------------------------------------------------------------------------

# Chinese headings commonly seen in NSFC proposals
CN_SECTION_PATTERNS = {
    "justification": re.compile(
        r"(立项依据|项目[的]?意义|研究意义|研究背景|国内外研究现状)", re.UNICODE
    ),
    "content": re.compile(
        r"(研究内容|研究方案|技术路线|研究目标|拟解决[的]?关键[科学]?问题)", re.UNICODE
    ),
    "foundation": re.compile(
        r"(研究基础|工作基础|工作条件|已有基础|研究团队)", re.UNICODE
    ),
}

# English headings for US proposals (not ratio-checked, just page estimates)
US_SECTION_PATTERNS = {
    "introduction": re.compile(r"(?i)(introduction|background|significance)"),
    "approach": re.compile(r"(?i)(approach|methods|methodology|research\s+plan)"),
    "preliminary": re.compile(r"(?i)(preliminary|prior\s+work|previous\s+results)"),
}


# ---------------------------------------------------------------------------
# Counting helpers
# ---------------------------------------------------------------------------

def count_chinese_chars(text: str) -> int:
    """Count CJK Unified Ideographs (the core Chinese character range)."""
    return sum(1 for ch in text if "\u4e00" <= ch <= "\u9fff")


def count_words(text: str) -> int:
    """Count whitespace-delimited English words."""
    return len(re.findall(r"[A-Za-z]+(?:['\u2019-][A-Za-z]+)*", text))


def is_chinese_dominant(text: str) -> bool:
    """Heuristic: if Chinese chars > English words, treat as Chinese text."""
    return count_chinese_chars(text) > count_words(text)


# ---------------------------------------------------------------------------
# File reading
# ---------------------------------------------------------------------------

SUPPORTED_EXTENSIONS = {".tex", ".md", ".txt"}


def read_file(path: Path) -> str:
    """Read a file with UTF-8 encoding, falling back to latin-1."""
    try:
        return path.read_text(encoding="utf-8")
    except UnicodeDecodeError:
        return path.read_text(encoding="latin-1")


def collect_files(directory: Path) -> list:
    """Return all supported files in *directory* (non-recursive)."""
    files = []
    for p in sorted(directory.iterdir()):
        if p.is_file() and p.suffix.lower() in SUPPORTED_EXTENSIONS:
            files.append(p)
    return files


# ---------------------------------------------------------------------------
# Section splitting
# ---------------------------------------------------------------------------

def split_sections_cn(text: str) -> dict:
    """Split Chinese proposal text into sections using heading patterns."""
    sections = {}
    # Build list of (position, section_name) from all pattern matches
    markers = []
    for name, pat in CN_SECTION_PATTERNS.items():
        for m in pat.finditer(text):
            markers.append((m.start(), name))
    markers.sort(key=lambda x: x[0])

    if not markers:
        # No recognisable headings; treat entire text as "content"
        return {"content": text}

    for i, (pos, name) in enumerate(markers):
        end = markers[i + 1][0] if i + 1 < len(markers) else len(text)
        chunk = text[pos:end]
        # If same name appears multiple times, concatenate
        sections[name] = sections.get(name, "") + chunk

    return sections


def split_sections_us(text: str) -> dict:
    """Split English proposal text into sections using heading patterns."""
    sections = {}
    markers = []
    for name, pat in US_SECTION_PATTERNS.items():
        for m in pat.finditer(text):
            markers.append((m.start(), name))
    markers.sort(key=lambda x: x[0])

    if not markers:
        return {"body": text}

    for i, (pos, name) in enumerate(markers):
        end = markers[i + 1][0] if i + 1 < len(markers) else len(text)
        chunk = text[pos:end]
        sections[name] = sections.get(name, "") + chunk

    return sections


# ---------------------------------------------------------------------------
# Analysis
# ---------------------------------------------------------------------------

def analyse_cn(sections: dict, total_text: str) -> dict:
    """Analyse Chinese proposal against NSFC targets."""
    total_chars = count_chinese_chars(total_text)
    report = {
        "mode": "cn",
        "total_chinese_chars": total_chars,
        "total_target_range": [NSFC_TOTAL_MIN, NSFC_TOTAL_MAX],
        "total_in_range": NSFC_TOTAL_MIN <= total_chars <= NSFC_TOTAL_MAX,
        "sections": {},
        "pass": True,
        "issues": [],
    }

    if total_chars == 0:
        report["pass"] = False
        report["issues"].append("No Chinese characters found in proposal.")
        return report

    for name, target_ratio in NSFC_RATIOS.items():
        sec_text = sections.get(name, "")
        sec_chars = count_chinese_chars(sec_text)
        actual_ratio = sec_chars / total_chars if total_chars else 0
        deviation = actual_ratio - target_ratio
        ok = abs(deviation) <= DEVIATION_THRESHOLD

        report["sections"][name] = {
            "chars": sec_chars,
            "actual_ratio": round(actual_ratio, 4),
            "target_ratio": target_ratio,
            "deviation": round(deviation, 4),
            "within_threshold": ok,
        }
        if not ok:
            report["pass"] = False
            direction = "over" if deviation > 0 else "under"
            report["issues"].append(
                f"Section '{name}' is {direction} target by "
                f"{abs(deviation)*100:.1f}% (actual {actual_ratio*100:.1f}%, "
                f"target {target_ratio*100:.1f}%)"
            )

    if not report["total_in_range"]:
        report["pass"] = False
        report["issues"].append(
            f"Total length {total_chars} chars is outside target range "
            f"[{NSFC_TOTAL_MIN}, {NSFC_TOTAL_MAX}]."
        )

    return report


def analyse_us(sections: dict, total_text: str) -> dict:
    """Analyse US proposal with page-count estimates."""
    is_cn = is_chinese_dominant(total_text)
    if is_cn:
        total_count = count_chinese_chars(total_text)
        unit = "chars"
        per_page = US_CHARS_PER_PAGE
    else:
        total_count = count_words(total_text)
        unit = "words"
        per_page = US_WORDS_PER_PAGE

    estimated_pages = total_count / per_page if per_page else 0

    report = {
        "mode": "us",
        "total_count": total_count,
        "unit": unit,
        "estimated_pages": round(estimated_pages, 1),
        "per_page_assumption": per_page,
        "sections": {},
        "pass": True,
        "issues": [],
    }

    for name, sec_text in sections.items():
        if is_cn:
            sec_count = count_chinese_chars(sec_text)
        else:
            sec_count = count_words(sec_text)
        sec_pages = sec_count / per_page if per_page else 0
        report["sections"][name] = {
            unit: sec_count,
            "estimated_pages": round(sec_pages, 1),
        }

    return report


# ---------------------------------------------------------------------------
# Human-readable formatting
# ---------------------------------------------------------------------------

def format_report(report: dict) -> str:
    lines = []
    lines.append(f"=== Length Validation Report (mode: {report['mode']}) ===\n")

    if report["mode"] == "cn":
        lines.append(
            f"Total Chinese characters: {report['total_chinese_chars']}  "
            f"(target: {report['total_target_range'][0]}-{report['total_target_range'][1]})"
        )
        lines.append(f"Total in range: {'YES' if report['total_in_range'] else 'NO'}\n")
        lines.append("Sections:")
        for name, info in report["sections"].items():
            flag = "OK" if info["within_threshold"] else "WARN"
            lines.append(
                f"  [{flag}] {name}: {info['chars']} chars, "
                f"ratio {info['actual_ratio']*100:.1f}% "
                f"(target {info['target_ratio']*100:.1f}%, "
                f"deviation {info['deviation']*100:+.1f}%)"
            )
    else:
        lines.append(
            f"Total {report['unit']}: {report['total_count']}  "
            f"(~{report['estimated_pages']} pages at "
            f"{report['per_page_assumption']} {report['unit']}/page)"
        )
        lines.append("\nSections:")
        for name, info in report["sections"].items():
            unit = report["unit"]
            lines.append(
                f"  {name}: {info[unit]} {unit}, "
                f"~{info['estimated_pages']} pages"
            )

    if report.get("issues"):
        lines.append("\nIssues:")
        for issue in report["issues"]:
            lines.append(f"  - {issue}")

    status = "PASS" if report["pass"] else "FAIL"
    lines.append(f"\nOverall: {status}")
    return "\n".join(lines)


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(
        description="Check proposal section lengths against target ratios."
    )
    parser.add_argument(
        "proposal_dir",
        help="Path to the directory containing proposal files (.tex, .md, .txt)",
    )
    parser.add_argument(
        "--mode",
        choices=["cn", "us"],
        default="cn",
        help="Validation mode: 'cn' for NSFC, 'us' for NSF/NIH (default: cn)",
    )
    parser.add_argument(
        "--json",
        action="store_true",
        dest="output_json",
        help="Output machine-readable JSON instead of human-readable text",
    )
    args = parser.parse_args()

    proposal_dir = Path(args.proposal_dir)
    if not proposal_dir.is_dir():
        print(f"Error: '{proposal_dir}' is not a directory.", file=sys.stderr)
        sys.exit(1)

    files = collect_files(proposal_dir)
    if not files:
        print(
            f"Error: No supported files ({', '.join(SUPPORTED_EXTENSIONS)}) "
            f"found in '{proposal_dir}'.",
            file=sys.stderr,
        )
        sys.exit(1)

    # Concatenate all file contents
    total_text = ""
    for f in files:
        total_text += read_file(f) + "\n"

    # Split into sections and analyse
    if args.mode == "cn":
        sections = split_sections_cn(total_text)
        report = analyse_cn(sections, total_text)
    else:
        sections = split_sections_us(total_text)
        report = analyse_us(sections, total_text)

    report["files_checked"] = [str(f) for f in files]

    if args.output_json:
        print(json.dumps(report, ensure_ascii=False, indent=2))
    else:
        print(format_report(report))

    sys.exit(0 if report["pass"] else 1)


if __name__ == "__main__":
    main()
