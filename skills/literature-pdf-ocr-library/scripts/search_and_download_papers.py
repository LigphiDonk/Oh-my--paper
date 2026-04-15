#!/usr/bin/env python3
"""Search traceable papers and optionally download open PDFs.

Two modes:
  --query     Full-text search across configured sources (arXiv, Semantic Scholar, …)
  --arxiv-ids Resolve specific arXiv IDs via the arXiv API, confirm metadata, then download.
              Useful when you already know the IDs (e.g. from a web search) and want
              verified metadata before fetching the PDF.
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path

from literature_lib import discover_records, download_pdf, ensure_dir, fetch_arxiv_by_ids, slugify, write_json


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    mode = parser.add_mutually_exclusive_group(required=True)
    mode.add_argument("--query", help="Free-text search query.")
    mode.add_argument(
        "--arxiv-ids",
        nargs="+",
        metavar="ID",
        help="One or more arXiv IDs (e.g. 2502.13817) to resolve via arXiv API and download.",
    )
    parser.add_argument("--out-dir", required=True, help="Output directory.")
    parser.add_argument("--limit", type=int, default=10, help="Final number of unique records (query mode only).")
    parser.add_argument(
        "--sources",
        nargs="+",
        default=["arxiv", "semanticscholar", "openalex"],
        choices=["arxiv", "semanticscholar", "openalex", "hf_daily"],
        help="Sources to query (query mode only).",
    )
    parser.add_argument("--download-pdfs", action="store_true", help="Download open-access PDFs when available.")
    parser.add_argument("--openalex-mailto", default=None, help="Optional mailto value for OpenAlex.")
    parser.add_argument("--sort", choices=["relevance", "recent"], default="relevance", help="Sort strategy.")
    parser.add_argument("--min-year", type=int, default=None, help="Keep only records with year >= min-year.")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    out_dir = Path(args.out_dir).expanduser().resolve()
    papers_dir = out_dir / "papers"
    ensure_dir(papers_dir)

    if args.arxiv_ids:
        # --arxiv-ids mode: resolve via arXiv API, confirm metadata, then optionally download
        records = fetch_arxiv_by_ids(args.arxiv_ids)
        source_errors: dict = {}
    else:
        # --query mode: search across configured sources
        records, source_errors = discover_records(
            query=args.query,
            limit=args.limit,
            sources=args.sources,
            openalex_mailto=args.openalex_mailto,
            sort=args.sort,
            min_year=args.min_year,
        )

    saved = []
    for index, record in enumerate(records, start=1):
        arxiv_id = record.get("arxiv_id") or ""
        title_slug = slugify(f"{record.get('year') or 'na'}-{record.get('title') or index}")
        paper_slug = slugify(f"{arxiv_id}-{title_slug}") if arxiv_id else title_slug
        paper_dir = papers_dir / paper_slug
        ensure_dir(paper_dir)
        local_pdf_path = None
        pdf_status = "not_requested"

        pdf_url = record.get("pdf_url")
        if args.download_pdfs:
            if pdf_url:
                local_pdf_path = paper_dir / "paper.pdf"
                try:
                    download_pdf(pdf_url, local_pdf_path)
                    pdf_status = "downloaded"
                except Exception as exc:  # noqa: BLE001
                    pdf_status = f"failed: {exc}"
                    local_pdf_path = None
            else:
                pdf_status = "unavailable"

        paper_record = {
            **record,
            "rank": index,
            "paper_slug": paper_slug,
            "local_pdf_path": str(local_pdf_path) if local_pdf_path else None,
            "pdf_status": pdf_status,
        }
        write_json(paper_dir / "metadata.json", paper_record)
        saved.append(paper_record)

    write_json(
        out_dir / "search_results.json",
        {
            "mode": "arxiv_ids" if args.arxiv_ids else "query",
            "query": args.query,
            "arxiv_ids": args.arxiv_ids,
            "limit": args.limit,
            "sources": args.sources if not args.arxiv_ids else ["arxiv"],
            "sort": args.sort,
            "min_year": args.min_year,
            "source_errors": source_errors,
            "records": saved,
        },
    )
    print(json.dumps({"saved_records": len(saved), "out_dir": str(out_dir)}, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
