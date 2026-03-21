#!/usr/bin/env python3
"""
validate_citations.py - Check citation consistency in grant proposals.

Supports:
  - .tex files: extracts \\cite{} references and checks against .bib files
  - .md / .txt files: extracts [N] numbered references and validates sequencing

Usage:
    python3 scripts/validate_citations.py <file_or_dir> [--mode cn|us] [--json]
"""

import argparse
import json
import os
import re
import sys
from datetime import datetime
from pathlib import Path

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

CURRENT_YEAR = datetime.now().year
RECENCY_YEARS = 5          # references older than this count toward recency warning
RECENCY_THRESHOLD = 0.40   # warn if >40% are old

NSFC_REF_MIN = 20
NSFC_REF_MAX = 80

# Severity levels
P0 = "P0"  # Critical - will likely cause rejection
P1 = "P1"  # Warning  - should be fixed
P2 = "P2"  # Info     - nice to fix


# ---------------------------------------------------------------------------
# File reading helpers
# ---------------------------------------------------------------------------

def read_file(path: Path) -> str:
    try:
        return path.read_text(encoding="utf-8")
    except UnicodeDecodeError:
        return path.read_text(encoding="latin-1")


def collect_files(directory: Path, extensions: set) -> list:
    """Return matching files in directory (non-recursive)."""
    return sorted(
        p for p in directory.iterdir()
        if p.is_file() and p.suffix.lower() in extensions
    )


# ---------------------------------------------------------------------------
# LaTeX (.tex / .bib) analysis
# ---------------------------------------------------------------------------

def extract_cite_keys_tex(text: str) -> dict:
    """Extract all \\cite{key1,key2} occurrences.

    Returns {key: [list of line numbers where cited]}.
    """
    keys = {}
    for lineno, line in enumerate(text.splitlines(), start=1):
        for m in re.finditer(r"\\cite\{([^}]+)\}", line):
            for key in re.split(r"\s*,\s*", m.group(1)):
                key = key.strip()
                if key:
                    keys.setdefault(key, []).append(lineno)
    return keys


def extract_bib_keys(text: str) -> dict:
    """Extract @type{key, ...} entries from a .bib file.

    Returns {key: year_int_or_None}.
    """
    entries = {}
    # Match entry type and key
    for m in re.finditer(r"@\w+\s*\{\s*([^,\s]+)", text):
        key = m.group(1).strip()
        # Try to find year within the entry (rough heuristic)
        # Look ahead up to next @ or end of string
        start = m.end()
        next_entry = text.find("\n@", start)
        block = text[start:next_entry] if next_entry != -1 else text[start:]
        year_match = re.search(r"year\s*=\s*[{\"]?\s*(\d{4})", block, re.IGNORECASE)
        year = int(year_match.group(1)) if year_match else None
        entries[key] = year
    return entries


def analyse_tex(tex_files: list, bib_files: list, mode: str) -> dict:
    """Analyse LaTeX citations against bib entries."""
    all_cited = {}   # key -> [lines]
    all_bib = {}     # key -> year

    for f in tex_files:
        cited = extract_cite_keys_tex(read_file(f))
        for k, lines in cited.items():
            all_cited.setdefault(k, []).extend(
                [{"file": str(f), "line": ln} for ln in lines]
            )

    for f in bib_files:
        bib_entries = extract_bib_keys(read_file(f))
        all_bib.update(bib_entries)

    issues = []

    # Cited but not in bib
    missing = set(all_cited.keys()) - set(all_bib.keys())
    for key in sorted(missing):
        issues.append({
            "severity": P0,
            "type": "missing_bib_entry",
            "message": f"Cited key '{key}' not found in any .bib file.",
            "locations": all_cited[key],
        })

    # In bib but never cited (orphaned)
    orphaned = set(all_bib.keys()) - set(all_cited.keys())
    for key in sorted(orphaned):
        issues.append({
            "severity": P2,
            "type": "orphaned_reference",
            "message": f"Bib entry '{key}' is never cited.",
        })

    # Reference count
    total_refs = len(all_bib)
    if mode == "cn":
        if total_refs < NSFC_REF_MIN:
            issues.append({
                "severity": P1,
                "type": "too_few_references",
                "message": f"Only {total_refs} references (NSFC guideline: >= {NSFC_REF_MIN}).",
            })
        elif total_refs > NSFC_REF_MAX:
            issues.append({
                "severity": P1,
                "type": "too_many_references",
                "message": f"{total_refs} references (NSFC guideline: <= {NSFC_REF_MAX}).",
            })

    # Recency check
    years = [y for y in all_bib.values() if y is not None]
    if years:
        old_count = sum(1 for y in years if y < CURRENT_YEAR - RECENCY_YEARS)
        old_ratio = old_count / len(years)
        if old_ratio > RECENCY_THRESHOLD:
            issues.append({
                "severity": P1,
                "type": "references_not_recent",
                "message": (
                    f"{old_count}/{len(years)} ({old_ratio*100:.0f}%) references "
                    f"are older than {RECENCY_YEARS} years (threshold: "
                    f"{RECENCY_THRESHOLD*100:.0f}%)."
                ),
            })

    report = {
        "format": "tex",
        "mode": mode,
        "total_cited_keys": len(all_cited),
        "total_bib_entries": total_refs,
        "missing_bib_entries": len(missing),
        "orphaned_references": len(orphaned),
        "issues": issues,
        "pass": all(i["severity"] != P0 for i in issues),
    }
    return report


# ---------------------------------------------------------------------------
# Markdown / plain text analysis  ([N] numbered references)
# ---------------------------------------------------------------------------

def extract_inline_citations_md(text: str) -> dict:
    """Extract [N] style citations from body text.

    Returns {number: [line_numbers]}.
    """
    cited = {}
    for lineno, line in enumerate(text.splitlines(), start=1):
        # Match [1], [2,3], [1-3], etc.
        for m in re.finditer(r"\[(\d[\d,\s\-\u2013]*)\]", line):
            inner = m.group(1)
            # Expand ranges like 1-3
            for part in re.split(r"[,\s]+", inner):
                part = part.strip()
                if not part:
                    continue
                range_match = re.match(r"(\d+)\s*[-\u2013]\s*(\d+)", part)
                if range_match:
                    lo, hi = int(range_match.group(1)), int(range_match.group(2))
                    for n in range(lo, hi + 1):
                        cited.setdefault(n, []).append(lineno)
                elif part.isdigit():
                    cited.setdefault(int(part), []).append(lineno)
    return cited


def extract_reference_list_md(text: str) -> dict:
    """Extract numbered reference list entries like '[1] Author ...' or '1. Author'.

    Returns {number: {"line": lineno, "text": str, "year": int|None}}.
    """
    refs = {}
    for lineno, line in enumerate(text.splitlines(), start=1):
        m = re.match(r"\s*\[(\d+)\]\s*(.*)", line)
        if not m:
            m = re.match(r"\s*(\d+)\.\s+(.*)", line)
        if m:
            num = int(m.group(1))
            ref_text = m.group(2)
            # Try to extract year
            year_match = re.search(r"((?:19|20)\d{2})", ref_text)
            year = int(year_match.group(1)) if year_match else None
            refs[num] = {"line": lineno, "text": ref_text[:120], "year": year}
    return refs


def analyse_md(text: str, filepath: str, mode: str) -> dict:
    """Analyse markdown/plain-text citations."""
    cited = extract_inline_citations_md(text)
    refs = extract_reference_list_md(text)
    issues = []

    cited_nums = set(cited.keys())
    ref_nums = set(refs.keys())

    # Missing reference entries for cited numbers
    missing = cited_nums - ref_nums
    for n in sorted(missing):
        issues.append({
            "severity": P0,
            "type": "missing_reference_entry",
            "message": f"Citation [{n}] used but no reference entry found.",
            "lines_cited": cited[n],
        })

    # Orphaned references (listed but never cited)
    orphaned = ref_nums - cited_nums
    for n in sorted(orphaned):
        issues.append({
            "severity": P2,
            "type": "orphaned_reference",
            "message": f"Reference [{n}] listed (line {refs[n]['line']}) but never cited.",
        })

    # Sequential numbering check
    if ref_nums:
        expected = set(range(1, max(ref_nums) + 1))
        gaps = expected - ref_nums
        if gaps:
            issues.append({
                "severity": P1,
                "type": "numbering_gaps",
                "message": f"Reference numbering has gaps: missing {sorted(gaps)}.",
            })

    # Reference count
    total_refs = len(ref_nums)
    if mode == "cn":
        if total_refs < NSFC_REF_MIN:
            issues.append({
                "severity": P1,
                "type": "too_few_references",
                "message": f"Only {total_refs} references (NSFC guideline: >= {NSFC_REF_MIN}).",
            })
        elif total_refs > NSFC_REF_MAX:
            issues.append({
                "severity": P1,
                "type": "too_many_references",
                "message": f"{total_refs} references (NSFC guideline: <= {NSFC_REF_MAX}).",
            })

    # Recency
    years = [r["year"] for r in refs.values() if r["year"] is not None]
    if years:
        old_count = sum(1 for y in years if y < CURRENT_YEAR - RECENCY_YEARS)
        old_ratio = old_count / len(years)
        if old_ratio > RECENCY_THRESHOLD:
            issues.append({
                "severity": P1,
                "type": "references_not_recent",
                "message": (
                    f"{old_count}/{len(years)} ({old_ratio*100:.0f}%) references "
                    f"are older than {RECENCY_YEARS} years (threshold: "
                    f"{RECENCY_THRESHOLD*100:.0f}%)."
                ),
            })

    report = {
        "format": "md",
        "mode": mode,
        "file": filepath,
        "total_inline_citations": len(cited_nums),
        "total_reference_entries": total_refs,
        "missing_entries": len(missing),
        "orphaned_references": len(orphaned),
        "issues": issues,
        "pass": all(i["severity"] != P0 for i in issues),
    }
    return report


# ---------------------------------------------------------------------------
# Human-readable formatting
# ---------------------------------------------------------------------------

def format_report(report: dict) -> str:
    lines = []
    lines.append(f"=== Citation Validation Report (format: {report['format']}, mode: {report['mode']}) ===\n")

    if report["format"] == "tex":
        lines.append(f"Cited keys:       {report['total_cited_keys']}")
        lines.append(f"Bib entries:      {report['total_bib_entries']}")
        lines.append(f"Missing in bib:   {report['missing_bib_entries']}")
        lines.append(f"Orphaned entries: {report['orphaned_references']}")
    else:
        lines.append(f"File: {report.get('file', 'N/A')}")
        lines.append(f"Inline citations: {report['total_inline_citations']}")
        lines.append(f"Reference entries: {report['total_reference_entries']}")
        lines.append(f"Missing entries:   {report['missing_entries']}")
        lines.append(f"Orphaned entries:  {report['orphaned_references']}")

    if report["issues"]:
        lines.append("\nIssues:")
        for issue in report["issues"]:
            lines.append(f"  [{issue['severity']}] {issue['message']}")
            if "locations" in issue:
                for loc in issue["locations"][:5]:
                    lines.append(f"        at {loc['file']}:{loc['line']}")
                if len(issue.get("locations", [])) > 5:
                    lines.append(f"        ... and {len(issue['locations'])-5} more")
            if "lines_cited" in issue:
                cited_lines = issue["lines_cited"][:5]
                lines.append(f"        cited on lines: {cited_lines}")
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
        description="Check citation consistency in grant proposals."
    )
    parser.add_argument(
        "path",
        help="Path to a proposal file or directory containing proposal files.",
    )
    parser.add_argument(
        "--mode",
        choices=["cn", "us"],
        default="cn",
        help="Validation mode: 'cn' for NSFC, 'us' for US agencies (default: cn)",
    )
    parser.add_argument(
        "--json",
        action="store_true",
        dest="output_json",
        help="Output machine-readable JSON instead of human-readable text",
    )
    args = parser.parse_args()

    target = Path(args.path)

    if not target.exists():
        print(f"Error: '{target}' does not exist.", file=sys.stderr)
        sys.exit(1)

    # Determine if we're dealing with a directory or a single file
    if target.is_dir():
        tex_files = collect_files(target, {".tex"})
        bib_files = collect_files(target, {".bib"})
        md_files = collect_files(target, {".md", ".txt"})

        if tex_files:
            report = analyse_tex(tex_files, bib_files, args.mode)
        elif md_files:
            # Concatenate all md/txt files
            combined = ""
            for f in md_files:
                combined += read_file(f) + "\n"
            report = analyse_md(combined, str(target), args.mode)
        else:
            print(
                "Error: No .tex, .md, or .txt files found in the directory.",
                file=sys.stderr,
            )
            sys.exit(1)
    else:
        # Single file
        text = read_file(target)
        ext = target.suffix.lower()
        if ext == ".tex":
            # Look for .bib files in the same directory
            bib_files = collect_files(target.parent, {".bib"})
            report = analyse_tex([target], bib_files, args.mode)
        elif ext in (".md", ".txt"):
            report = analyse_md(text, str(target), args.mode)
        elif ext == ".bib":
            print(
                "Error: Please point to a .tex or .md file, not a .bib file directly.",
                file=sys.stderr,
            )
            sys.exit(1)
        else:
            print(
                f"Error: Unsupported file type '{ext}'. "
                "Supported: .tex, .md, .txt",
                file=sys.stderr,
            )
            sys.exit(1)

    if args.output_json:
        print(json.dumps(report, ensure_ascii=False, indent=2))
    else:
        print(format_report(report))

    sys.exit(0 if report["pass"] else 1)


if __name__ == "__main__":
    main()
