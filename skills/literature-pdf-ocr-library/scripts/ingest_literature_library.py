#!/usr/bin/env python3
"""Run search, download, OCR conversion, and index building in sequence."""

from __future__ import annotations

import argparse
import os
import subprocess
import sys
from pathlib import Path


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--query", required=True, help="Search query.")
    parser.add_argument("--out-dir", required=True, help="Output directory.")
    parser.add_argument("--limit", type=int, default=10, help="Final number of unique papers.")
    parser.add_argument(
        "--sources",
        nargs="+",
        default=["arxiv", "semanticscholar", "openalex"],
        choices=["arxiv", "semanticscholar", "openalex", "hf_daily"],
    )
    parser.add_argument("--openalex-mailto", default=os.environ.get("OPENALEX_MAILTO"))
    parser.add_argument("--sort", choices=["relevance", "recent"], default="recent")
    parser.add_argument("--min-year", type=int, default=None)
    parser.add_argument("--ocr", action="store_true", help="Run PaddleOCR after downloading PDFs.")
    parser.add_argument("--api-url", default=os.environ.get("PADDLEOCR_API_URL"))
    parser.add_argument("--token", default=os.environ.get("PADDLEOCR_TOKEN"))
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    script_dir = Path(__file__).resolve().parent
    out_dir = Path(args.out_dir).expanduser().resolve()

    search_cmd = [
        sys.executable,
        str(script_dir / "search_and_download_papers.py"),
        "--query",
        args.query,
        "--out-dir",
        str(out_dir),
        "--limit",
        str(args.limit),
        "--sources",
        *args.sources,
        "--download-pdfs",
        "--sort",
        args.sort,
    ]
    if args.min_year is not None:
        search_cmd += ["--min-year", str(args.min_year)]
    if args.openalex_mailto:
        search_cmd += ["--openalex-mailto", args.openalex_mailto]
    subprocess.run(search_cmd, check=True)

    if args.ocr:
        if not args.token:
            raise SystemExit("OCR requested but PADDLEOCR_TOKEN is missing.")
        pdf_inputs = sorted((out_dir / "papers").glob("*/paper.pdf"))
        if pdf_inputs:
            env = os.environ.copy()
            env["PADDLEOCR_TOKEN"] = args.token
            if args.api_url:
                env["PADDLEOCR_API_URL"] = args.api_url
            for pdf_path in pdf_inputs:
                paper_dir = pdf_path.parent
                subprocess.run(
                    [
                        sys.executable,
                        str(script_dir / "paddleocr_layout_to_markdown.py"),
                        str(pdf_path),
                        "--output-dir",
                        str(paper_dir / "ocr"),
                    ],
                    check=True,
                    env=env,
                )

    subprocess.run(
        [
            sys.executable,
            str(script_dir / "build_library_index.py"),
            "--library-root",
            str(out_dir),
        ],
        check=True,
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
