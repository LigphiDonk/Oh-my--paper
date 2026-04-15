#!/usr/bin/env python3
"""Shared helpers for the literature PDF OCR library skill."""

from __future__ import annotations

import json
import re
import sys
import xml.etree.ElementTree as ET
from pathlib import Path
from typing import Dict, Iterable, List, Optional

import requests

USER_AGENT = "Codex literature-pdf-ocr-library/1.0"
TIMEOUT = 45
ARXIV_ATOM_NS = {
    "atom": "http://www.w3.org/2005/Atom",
    "arxiv": "http://arxiv.org/schemas/atom",
}
PDF_EXTENSIONS = {".pdf"}
IMAGE_EXTENSIONS = {".png", ".jpg", ".jpeg", ".bmp", ".tif", ".tiff", ".webp"}


def slugify(text: str, limit: int = 80) -> str:
    text = text.lower().strip()
    text = re.sub(r"[^a-z0-9]+", "-", text)
    text = re.sub(r"-{2,}", "-", text).strip("-")
    return text[:limit] or "paper"


def normalize_title(text: str) -> str:
    return re.sub(r"\s+", " ", text or "").strip().lower()


def ensure_dir(path: Path) -> None:
    path.mkdir(parents=True, exist_ok=True)


def write_json(path: Path, data: object) -> None:
    ensure_dir(path.parent)
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def write_jsonl(path: Path, rows: Iterable[Dict]) -> None:
    ensure_dir(path.parent)
    with path.open("w", encoding="utf-8") as fh:
        for row in rows:
            fh.write(json.dumps(row, ensure_ascii=False) + "\n")


def safe_request(
    url: str,
    *,
    params: Optional[Dict] = None,
    headers: Optional[Dict] = None,
    timeout: int = TIMEOUT,
) -> requests.Response:
    merged_headers = {"User-Agent": USER_AGENT}
    if headers:
        merged_headers.update(headers)
    response = requests.get(url, params=params, headers=merged_headers, timeout=timeout)
    response.raise_for_status()
    return response


def choose_best_pdf_url(record: Dict) -> Optional[str]:
    candidates = [
        record.get("pdf_url"),
        record.get("open_access_pdf_url"),
        record.get("oa_url"),
        record.get("primary_pdf_url"),
    ]
    for url in candidates:
        if isinstance(url, str) and url.strip():
            return url.strip()
    return None


def dedupe_records(records: List[Dict], limit: Optional[int] = None) -> List[Dict]:
    source_priority = {"arxiv": 0, "semanticscholar": 1, "openalex": 2, "hf_daily": 3}
    chosen: Dict[str, Dict] = {}

    def key_for(record: Dict) -> str:
        for field in ("doi", "arxiv_id"):
            value = record.get(field)
            if value:
                return f"{field}:{str(value).lower()}"
        return f"title:{normalize_title(record.get('title', ''))}"

    ordered = sorted(records, key=lambda row: source_priority.get(row.get("source", ""), 99))
    for record in ordered:
        key = key_for(record)
        if key not in chosen:
            chosen[key] = dict(record)
            continue
        existing = chosen[key]
        for field in (
            "abstract",
            "pdf_url",
            "landing_page",
            "open_access_pdf_url",
            "oa_url",
            "primary_pdf_url",
            "doi",
            "arxiv_id",
            "venue",
            "year",
        ):
            if not existing.get(field) and record.get(field):
                existing[field] = record[field]
        merged_sources = list(dict.fromkeys(existing.get("merged_sources", [existing.get("source")]) + [record.get("source")]))
        existing["merged_sources"] = [item for item in merged_sources if item]
        existing["pdf_url"] = choose_best_pdf_url(existing)

    results = list(chosen.values())
    if limit is not None:
        return results[:limit]
    return results


def _text(node: Optional[ET.Element]) -> str:
    return node.text.strip() if node is not None and node.text else ""


def _parse_arxiv_id(entry_id: str) -> str:
    value = entry_id.rsplit("/", 1)[-1]
    return value.replace("v", "v") if value else ""


def _arxiv_pdf_url(entry_id: str) -> str:
    arxiv_id = entry_id.rsplit("/", 1)[-1]
    if arxiv_id.endswith(".pdf"):
        return f"https://arxiv.org/pdf/{arxiv_id}"
    return f"https://arxiv.org/pdf/{arxiv_id}.pdf"


def search_arxiv(query: str, limit: int, sort: str = "relevance") -> List[Dict]:
    sort_by = "submittedDate" if sort == "recent" else "relevance"
    response = safe_request(
        "https://export.arxiv.org/api/query",
        params={
            "search_query": f"all:{query}",
            "start": 0,
            "max_results": limit,
            "sortBy": sort_by,
            "sortOrder": "descending",
        },
    )
    root = ET.fromstring(response.text)
    rows: List[Dict] = []
    for entry in root.findall("atom:entry", ARXIV_ATOM_NS):
        entry_id = _text(entry.find("atom:id", ARXIV_ATOM_NS))
        doi = _text(entry.find("arxiv:doi", ARXIV_ATOM_NS))
        published = _text(entry.find("atom:published", ARXIV_ATOM_NS))
        rows.append(
            {
                "source": "arxiv",
                "title": _text(entry.find("atom:title", ARXIV_ATOM_NS)),
                "authors": [_text(author.find("atom:name", ARXIV_ATOM_NS)) for author in entry.findall("atom:author", ARXIV_ATOM_NS)],
                "abstract": _text(entry.find("atom:summary", ARXIV_ATOM_NS)),
                "year": int(published[:4]) if published[:4].isdigit() else None,
                "published": published,
                "landing_page": entry_id.replace("http://", "https://"),
                "pdf_url": _arxiv_pdf_url(entry_id),
                "doi": doi or None,
                "arxiv_id": _parse_arxiv_id(entry_id),
                "venue": "arXiv",
            }
        )
    return rows


def fetch_arxiv_by_ids(arxiv_ids: List[str]) -> List[Dict]:
    """Fetch paper metadata from arXiv API for a specific list of arXiv IDs.

    Uses the arXiv export API with id_list to retrieve confirmed metadata (title,
    authors, abstract, year) before downloading.  IDs may be bare (``2502.13817``)
    or versioned (``2502.13817v2``).
    """
    id_list = ",".join(arxiv_ids)
    response = safe_request(
        "https://export.arxiv.org/api/query",
        params={"id_list": id_list, "max_results": len(arxiv_ids)},
    )
    root = ET.fromstring(response.text)
    rows: List[Dict] = []
    for entry in root.findall("atom:entry", ARXIV_ATOM_NS):
        entry_id = _text(entry.find("atom:id", ARXIV_ATOM_NS))
        doi = _text(entry.find("arxiv:doi", ARXIV_ATOM_NS))
        published = _text(entry.find("atom:published", ARXIV_ATOM_NS))
        rows.append(
            {
                "source": "arxiv",
                "title": _text(entry.find("atom:title", ARXIV_ATOM_NS)),
                "authors": [
                    _text(author.find("atom:name", ARXIV_ATOM_NS))
                    for author in entry.findall("atom:author", ARXIV_ATOM_NS)
                ],
                "abstract": _text(entry.find("atom:summary", ARXIV_ATOM_NS)),
                "year": int(published[:4]) if (published or "")[:4].isdigit() else None,
                "published": published,
                "landing_page": entry_id.replace("http://", "https://"),
                "pdf_url": _arxiv_pdf_url(entry_id),
                "doi": doi or None,
                "arxiv_id": _parse_arxiv_id(entry_id),
                "venue": "arXiv",
            }
        )
    return rows


def search_semanticscholar(query: str, limit: int, sort: str = "relevance") -> List[Dict]:
    del sort
    response = safe_request(
        "https://api.semanticscholar.org/graph/v1/paper/search",
        params={
            "query": query,
            "limit": limit,
            "fields": "title,year,authors,abstract,url,openAccessPdf,isOpenAccess,externalIds,venue",
        },
    )
    body = response.json()
    rows: List[Dict] = []
    for item in body.get("data", []):
        external_ids = item.get("externalIds") or {}
        open_pdf = item.get("openAccessPdf") or {}
        rows.append(
            {
                "source": "semanticscholar",
                "title": item.get("title"),
                "authors": [author.get("name") for author in item.get("authors", []) if author.get("name")],
                "abstract": item.get("abstract"),
                "year": item.get("year"),
                "landing_page": item.get("url"),
                "pdf_url": open_pdf.get("url"),
                "open_access_pdf_url": open_pdf.get("url"),
                "doi": external_ids.get("DOI"),
                "arxiv_id": external_ids.get("ArXiv"),
                "venue": item.get("venue"),
                "is_open_access": item.get("isOpenAccess"),
            }
        )
    return rows


def search_openalex(query: str, limit: int, mailto: Optional[str] = None, sort: str = "relevance") -> List[Dict]:
    params = {"search": query, "per-page": limit}
    if sort == "recent":
        params["sort"] = "publication_date:desc"
    headers: Dict[str, str] = {}
    if mailto:
        params["mailto"] = mailto
        headers["User-Agent"] = f"{USER_AGENT} ({mailto})"
    response = safe_request("https://api.openalex.org/works", params=params, headers=headers)
    body = response.json()
    rows: List[Dict] = []
    for item in body.get("results", []):
        primary_location = item.get("primary_location") or {}
        open_access = item.get("open_access") or {}
        ids = item.get("ids") or {}
        doi = item.get("doi") or ids.get("doi")
        if doi and doi.startswith("https://doi.org/"):
            doi = doi[len("https://doi.org/") :]
        rows.append(
            {
                "source": "openalex",
                "title": item.get("display_name") or item.get("title"),
                "authors": [author.get("author", {}).get("display_name") for author in item.get("authorships", []) if author.get("author", {}).get("display_name")],
                "abstract": None,
                "year": item.get("publication_year"),
                "landing_page": primary_location.get("landing_page_url") or item.get("id"),
                "pdf_url": primary_location.get("pdf_url") or open_access.get("oa_url"),
                "primary_pdf_url": primary_location.get("pdf_url"),
                "oa_url": open_access.get("oa_url"),
                "doi": doi,
                "arxiv_id": None,
                "venue": (primary_location.get("source") or {}).get("display_name"),
                "is_open_access": open_access.get("is_oa"),
            }
        )
    return rows


def search_hf_daily_papers(query: str, limit: int, sort: str = "relevance") -> List[Dict]:
    del sort
    response = safe_request("https://huggingface.co/api/daily_papers")
    body = response.json()
    items = body if isinstance(body, list) else [body]
    terms = [term.lower() for term in re.findall(r"[a-zA-Z0-9_-]+", query) if term.strip()]
    rows: List[Dict] = []
    for item in items:
        paper = item.get("paper") or {}
        haystack = f"{paper.get('title', '')} {paper.get('summary', '')}".lower()
        if terms and not all(term in haystack for term in terms[:3]):
            continue
        paper_id = str(paper.get("id") or "").strip()
        pdf_url = f"https://arxiv.org/pdf/{paper_id}.pdf" if re.fullmatch(r"\d{4}\.\d{4,5}", paper_id) else None
        rows.append(
            {
                "source": "hf_daily",
                "title": paper.get("title"),
                "authors": [author.get("name") for author in paper.get("authors", []) if author.get("name")],
                "abstract": paper.get("summary"),
                "year": int(str(paper.get("publishedAt", ""))[:4]) if str(paper.get("publishedAt", ""))[:4].isdigit() else None,
                "landing_page": f"https://huggingface.co/papers/{paper_id}" if paper_id else None,
                "pdf_url": pdf_url,
                "doi": None,
                "arxiv_id": paper_id if pdf_url else None,
                "venue": "Hugging Face daily papers",
            }
        )
        if len(rows) >= limit:
            break
    return rows


def discover_records(
    query: str,
    limit: int,
    sources: List[str],
    openalex_mailto: Optional[str] = None,
    sort: str = "relevance",
    min_year: Optional[int] = None,
) -> tuple[List[Dict], Dict[str, str]]:
    rows: List[Dict] = []
    errors: Dict[str, str] = {}
    for source in sources:
        try:
            if source == "arxiv":
                rows.extend(search_arxiv(query, limit, sort=sort))
            elif source == "semanticscholar":
                rows.extend(search_semanticscholar(query, limit, sort=sort))
            elif source == "openalex":
                rows.extend(search_openalex(query, limit, mailto=openalex_mailto, sort=sort))
            elif source == "hf_daily":
                rows.extend(search_hf_daily_papers(query, limit, sort=sort))
            else:
                raise ValueError(f"Unsupported source: {source}")
        except Exception as exc:  # noqa: BLE001
            errors[source] = str(exc)
            print(f"[warn] source failed: {source}: {exc}", file=sys.stderr)

    if min_year is not None:
        rows = [row for row in rows if row.get("year") is None or int(row["year"]) >= min_year]
    deduped = dedupe_records(rows, limit=limit)
    for record in deduped:
        record["pdf_url"] = choose_best_pdf_url(record)
    return deduped, errors


def download_pdf(url: str, destination: Path) -> None:
    ensure_dir(destination.parent)
    with requests.get(url, headers={"User-Agent": USER_AGENT}, timeout=TIMEOUT, stream=True) as response:
        response.raise_for_status()
        with destination.open("wb") as fh:
            for chunk in response.iter_content(chunk_size=1024 * 64):
                if chunk:
                    fh.write(chunk)


def discover_input_files(paths: Iterable[Path], recursive: bool = False) -> List[Path]:
    discovered: List[Path] = []
    for path in paths:
        if path.is_file():
            discovered.append(path)
            continue
        pattern = "**/*" if recursive else "*"
        for candidate in sorted(path.glob(pattern)):
            if not candidate.is_file():
                continue
            if candidate.suffix.lower() in PDF_EXTENSIONS | IMAGE_EXTENSIONS:
                discovered.append(candidate)
    return discovered
