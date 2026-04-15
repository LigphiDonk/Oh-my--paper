#!/usr/bin/env python3
"""Build a machine-readable index for a literature library."""

from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Dict, List

from literature_lib import write_json, write_jsonl


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--library-root", required=True, help="Root directory produced by the skill.")
    return parser.parse_args()


def collect_markdown_paths(paper_dir: Path) -> List[str]:
    return sorted(str(path) for path in paper_dir.glob("ocr/**/*.md"))


def collect_image_paths(paper_dir: Path) -> List[str]:
    exts = {".png", ".jpg", ".jpeg", ".webp", ".bmp", ".tif", ".tiff"}
    rows = []
    for path in paper_dir.glob("ocr/**/*"):
        if path.is_file() and path.suffix.lower() in exts:
            rows.append(str(path))
    return sorted(rows)


def main() -> int:
    args = parse_args()
    root = Path(args.library_root).expanduser().resolve()
    papers_dir = root / "papers"
    rows: List[Dict] = []

    for metadata_path in sorted(papers_dir.glob("*/metadata.json")):
        paper_dir = metadata_path.parent
        metadata = json.loads(metadata_path.read_text(encoding="utf-8"))
        rows.append(
            {
                "paper_slug": metadata.get("paper_slug") or paper_dir.name,
                "title": metadata.get("title"),
                "authors": metadata.get("authors", []),
                "year": metadata.get("year"),
                "source": metadata.get("source"),
                "merged_sources": metadata.get("merged_sources", []),
                "doi": metadata.get("doi"),
                "arxiv_id": metadata.get("arxiv_id"),
                "landing_page": metadata.get("landing_page"),
                "pdf_url": metadata.get("pdf_url"),
                "local_pdf_path": metadata.get("local_pdf_path"),
                "markdown_paths": collect_markdown_paths(paper_dir),
                "image_paths": collect_image_paths(paper_dir),
                "pdf_status": metadata.get("pdf_status"),
                "metadata_path": str(metadata_path),
            }
        )

    write_json(root / "library_index.json", {"papers": rows})
    write_jsonl(root / "library_index.jsonl", rows)
    print(json.dumps({"indexed_papers": len(rows), "library_root": str(root)}, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
