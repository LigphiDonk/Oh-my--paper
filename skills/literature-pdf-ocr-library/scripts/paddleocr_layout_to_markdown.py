#!/usr/bin/env python3
"""Convert local PDFs or images to Markdown via a PaddleOCR layout-parsing API.

Falls back to pdfminer-based text extraction when --fallback-pdfminer is set
and the API is unavailable or returns an error (e.g. quota exhausted).
"""

from __future__ import annotations

import argparse
import base64
import json
import os
from pathlib import Path
from typing import Dict, List

import requests

from literature_lib import discover_input_files, ensure_dir, slugify, write_json

DEFAULT_API_URL = "https://ndf9hcz2u2w8ucab.aistudio-app.com/layout-parsing"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("inputs", nargs="+", help="Input files or directories.")
    parser.add_argument("--output-dir", required=True, help="Output directory for Markdown and images.")
    parser.add_argument("--recursive", action="store_true", help="Recurse into input directories.")
    parser.add_argument("--api-url", default=os.environ.get("PADDLEOCR_API_URL", DEFAULT_API_URL))
    parser.add_argument("--token", default=os.environ.get("PADDLEOCR_TOKEN"))
    parser.add_argument("--skip-existing", action="store_true", help="Skip files whose manifest already exists.")
    parser.add_argument(
        "--fallback-pdfminer",
        action="store_true",
        help="Fall back to pdfminer text extraction when the API call fails or no token is set.",
    )
    return parser.parse_args()


def infer_file_type(path: Path) -> int:
    return 0 if path.suffix.lower() == ".pdf" else 1


def convert_pdf_pdfminer(path: Path, output_dir: Path) -> Dict:
    """Extract text from a PDF with pdfminer and write a single doc_0.md."""
    try:
        from pdfminer.high_level import extract_text  # type: ignore
    except ImportError as exc:
        raise RuntimeError("pdfminer not installed; run: pip install pdfminer.six") from exc

    text = extract_text(str(path))
    md_path = output_dir / "doc_0.md"
    md_path.write_text(text or "", encoding="utf-8")
    manifest = {
        "input_path": str(path),
        "output_dir": str(output_dir),
        "backend": "pdfminer",
        "documents": [{"markdown_path": str(md_path), "markdown_image_paths": [], "output_image_paths": []}],
    }
    write_json(output_dir / "manifest.json", manifest)
    return manifest


def convert_one(path: Path, output_dir: Path, api_url: str, token: str) -> Dict:
    file_bytes = path.read_bytes()
    payload = {
        "file": base64.b64encode(file_bytes).decode("ascii"),
        "fileType": infer_file_type(path),
        "useDocOrientationClassify": False,
        "useDocUnwarping": False,
        "useChartRecognition": False,
    }
    headers = {
        "Authorization": f"token {token}",
        "Content-Type": "application/json",
    }
    response = requests.post(api_url, json=payload, headers=headers, timeout=180)
    response.raise_for_status()
    body = response.json()
    result = body["result"]

    doc_rows: List[Dict] = []
    for index, parsed in enumerate(result.get("layoutParsingResults", [])):
        md_path = output_dir / f"doc_{index}.md"
        md_path.write_text(parsed["markdown"]["text"], encoding="utf-8")

        downloaded_images = []
        for image_rel_path, image_url in (parsed["markdown"].get("images") or {}).items():
            local_image_path = output_dir / image_rel_path
            ensure_dir(local_image_path.parent)
            image_bytes = requests.get(image_url, timeout=60).content
            local_image_path.write_bytes(image_bytes)
            downloaded_images.append(str(local_image_path))

        output_images = []
        for image_name, image_url in (parsed.get("outputImages") or {}).items():
            local_image_path = output_dir / f"{image_name}_{index}.jpg"
            ensure_dir(local_image_path.parent)
            image_response = requests.get(image_url, timeout=60)
            image_response.raise_for_status()
            local_image_path.write_bytes(image_response.content)
            output_images.append(str(local_image_path))

        doc_rows.append(
            {
                "markdown_path": str(md_path),
                "markdown_image_paths": downloaded_images,
                "output_image_paths": output_images,
            }
        )

    manifest = {
        "input_path": str(path),
        "output_dir": str(output_dir),
        "documents": doc_rows,
    }
    write_json(output_dir / "manifest.json", manifest)
    return manifest


def main() -> int:
    args = parse_args()
    use_api = bool(args.token)
    if not use_api and not args.fallback_pdfminer:
        raise SystemExit(
            "PADDLEOCR_TOKEN is required via --token or environment variable. "
            "Pass --fallback-pdfminer to use local pdfminer extraction instead."
        )

    inputs = [Path(item).expanduser().resolve() for item in args.inputs]
    files = discover_input_files(inputs, recursive=args.recursive)
    output_root = Path(args.output_dir).expanduser().resolve()
    ensure_dir(output_root)

    manifests = []
    for path in files:
        file_output_dir = output_root / slugify(path.stem)
        manifest_path = file_output_dir / "manifest.json"
        if args.skip_existing and manifest_path.exists():
            manifests.append(json.loads(manifest_path.read_text(encoding="utf-8")))
            continue
        ensure_dir(file_output_dir)

        if use_api:
            try:
                manifests.append(convert_one(path, file_output_dir, args.api_url, args.token))
                continue
            except Exception as exc:  # noqa: BLE001
                if args.fallback_pdfminer:
                    print(json.dumps({"warning": f"API failed for {path.name}: {exc}; falling back to pdfminer"}))
                else:
                    raise

        # pdfminer fallback
        if path.suffix.lower() == ".pdf":
            manifests.append(convert_pdf_pdfminer(path, file_output_dir))
        else:
            print(json.dumps({"warning": f"Skipping non-PDF {path.name} (pdfminer only supports PDFs)"}))

    write_json(output_root / "batch_manifest.json", {"converted_files": len(manifests), "items": manifests})
    print(json.dumps({"converted_files": len(manifests), "output_dir": str(output_root)}, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
