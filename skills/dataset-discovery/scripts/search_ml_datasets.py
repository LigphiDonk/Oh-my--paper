#!/usr/bin/env python3
"""Multi-source ML dataset discovery tool.

Search HuggingFace Hub, OpenML, GitHub, and Semantic Scholar for datasets
relevant to a research task. Results are ranked, deduplicated, and output
as a markdown table or JSON.

Dependencies: requests + stdlib only.
"""

import argparse
import json
import os
import re
import subprocess
import sys
import textwrap
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import quote

try:
    import requests
except ImportError:
    print("Error: 'requests' package is required. Install with: pip install requests", file=sys.stderr)
    sys.exit(1)

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

REQUEST_TIMEOUT = 15  # seconds

KNOWN_ALIASES = {
    "imagenet": ["ilsvrc", "imagenet1k", "imagenet-1k"],
    "cifar10": ["cifar-10"],
    "cifar100": ["cifar-100"],
    "mnist": ["handwritten digits"],
    "imdb": ["imdb reviews", "imdb movie reviews"],
    "squad": ["stanford question answering"],
    "coco": ["ms coco", "mscoco", "common objects in context"],
    "glue": ["general language understanding"],
    "superglue": ["super glue"],
    "wikitext": ["wikitext-2", "wikitext-103"],
}


def fetch_json(url, params=None, headers=None):
    """GET JSON from *url*, returning parsed dict/list or None on failure."""
    try:
        resp = requests.get(url, params=params, headers=headers, timeout=REQUEST_TIMEOUT)
        if resp.status_code == 200:
            return resp.json()
        print(f"  [warn] {url} returned HTTP {resp.status_code}", file=sys.stderr)
    except requests.RequestException as exc:
        print(f"  [warn] {url}: {exc}", file=sys.stderr)
    return None


def normalize_name(name):
    """Lowercase, strip punctuation/whitespace for dedup comparison."""
    name = name.lower()
    name = re.sub(r"[^a-z0-9 ]", " ", name)
    name = re.sub(r"\s+", " ", name).strip()
    return name


def canonical_key(name):
    """Return a canonical key accounting for known aliases."""
    norm = normalize_name(name)
    for canon, aliases in KNOWN_ALIASES.items():
        if norm == canon or norm in [normalize_name(a) for a in aliases]:
            return canon
    return norm


def ensure_dir(path):
    Path(path).mkdir(parents=True, exist_ok=True)


def safe_slug(text):
    """Turn arbitrary text into a filesystem-safe slug."""
    return re.sub(r"[^a-z0-9]+", "_", text.lower()).strip("_")[:80]


# ---------------------------------------------------------------------------
# Source handlers — each returns list[dict] with the normalized schema
# ---------------------------------------------------------------------------

EMPTY_RESULT = dict(
    name="", source="", source_id="", url="", description="",
    size_category="", license="", modality="", task_categories=[],
    tags=[], downloads=0, stars=0, relevance_score=0,
)


def _parse_hf_tags(tag_list):
    """Extract modality, tasks, license, size from HF tag list."""
    modality = ""
    tasks = []
    license_ = ""
    size = ""
    for t in (tag_list or []):
        tl = t.lower()
        if tl.startswith("task_categories:"):
            tasks.append(t.split(":", 1)[1])
        elif tl.startswith("license:"):
            license_ = t.split(":", 1)[1]
        elif tl.startswith("size_categories:"):
            size = t.split(":", 1)[1]
        elif tl in ("image", "text", "audio", "tabular", "video"):
            modality = tl
        # modality from task prefix
        if not modality:
            if any(k in tl for k in ("image", "vision", "visual")):
                modality = "image"
            elif any(k in tl for k in ("text", "nlp", "language", "translation", "summarization")):
                modality = "text"
            elif "audio" in tl or "speech" in tl:
                modality = "audio"
            elif "tabular" in tl:
                modality = "tabular"
    return modality, tasks, license_, size


def search_huggingface(query, max_results=30):
    """Search HuggingFace Hub datasets API."""
    print("  Searching HuggingFace Hub...", file=sys.stderr)
    data = fetch_json(
        "https://huggingface.co/api/datasets",
        params={"search": query, "sort": "downloads", "direction": "-1", "limit": max_results},
    )
    if not data:
        return []
    results = []
    for item in data:
        modality, tasks, license_, size = _parse_hf_tags(item.get("tags", []))
        results.append({
            **EMPTY_RESULT,
            "name": item.get("id", ""),
            "source": "huggingface",
            "source_id": item.get("id", ""),
            "url": f"https://huggingface.co/datasets/{item.get('id', '')}",
            "description": item.get("description", "")[:200] if item.get("description") else "",
            "size_category": size,
            "license": license_,
            "modality": modality,
            "task_categories": tasks,
            "tags": item.get("tags", []),
            "downloads": item.get("downloads", 0),
            "stars": item.get("likes", 0),
        })
    return results


def search_openml(query, max_results=30):
    """Search OpenML datasets."""
    print("  Searching OpenML...", file=sys.stderr)
    # Try the newer search endpoint first, fall back to name-based list
    data = fetch_json(
        "https://www.openml.org/api/v1/json/data/list",
        params={"data_name": query, "limit": max_results, "output_format": "json"},
    )
    if not data or "data" not in data or "dataset" not in data.get("data", {}):
        # Try keyword-based: split query and match first word
        first_word = query.split()[0] if query.split() else query
        url = f"https://www.openml.org/api/v1/json/data/list/data_name/{quote(first_word)}/limit/{max_results}"
        data = fetch_json(url)
    if not data or "data" not in data or "dataset" not in data["data"]:
        return []
    results = []
    for item in data["data"]["dataset"]:
        n_instances = item.get("NumberOfInstances") or item.get("number_of_instances") or 0
        try:
            n_instances = int(float(n_instances))
        except (ValueError, TypeError):
            n_instances = 0
        size = ""
        if n_instances > 1_000_000:
            size = "large (>1M)"
        elif n_instances > 10_000:
            size = "medium (10K-1M)"
        elif n_instances > 0:
            size = f"small ({n_instances})"
        results.append({
            **EMPTY_RESULT,
            "name": item.get("name", ""),
            "source": "openml",
            "source_id": str(item.get("did", "")),
            "url": f"https://www.openml.org/d/{item.get('did', '')}",
            "description": item.get("description", "")[:200] if item.get("description") else "",
            "size_category": size,
            "license": item.get("licence", ""),
            "modality": "tabular",
            "task_categories": [],
            "tags": [],
            "downloads": 0,
            "stars": 0,
        })
    return results


def search_github(query, max_results=30):
    """Search GitHub repos via `gh` CLI."""
    print("  Searching GitHub...", file=sys.stderr)
    cmd = [
        "gh", "search", "repos", f"{query} dataset",
        "--json", "name,description,url,stargazersCount,license",
        "--sort", "stars",
        "--limit", str(max_results),
    ]
    try:
        proc = subprocess.run(cmd, capture_output=True, text=True, timeout=20)
        if proc.returncode != 0:
            print(f"  [warn] gh search failed: {proc.stderr.strip()}", file=sys.stderr)
            return []
        items = json.loads(proc.stdout)
    except (subprocess.TimeoutExpired, json.JSONDecodeError, FileNotFoundError) as exc:
        print(f"  [warn] gh: {exc}", file=sys.stderr)
        return []
    results = []
    for item in items:
        lic = ""
        lic_data = item.get("license")
        if isinstance(lic_data, dict):
            lic = lic_data.get("key", "") or lic_data.get("name", "")
        elif isinstance(lic_data, str):
            lic = lic_data
        results.append({
            **EMPTY_RESULT,
            "name": item.get("name", ""),
            "source": "github",
            "source_id": item.get("url", ""),
            "url": item.get("url", ""),
            "description": (item.get("description") or "")[:200],
            "license": lic,
            "stars": item.get("stargazersCount", 0),
        })
    return results


def search_papers(query, max_results=30):
    """Search Semantic Scholar for papers mentioning datasets."""
    print("  Searching Semantic Scholar for dataset papers...", file=sys.stderr)
    data = fetch_json(
        "https://api.semanticscholar.org/graph/v1/paper/search",
        params={
            "query": f"{query} dataset benchmark",
            "limit": min(max_results, 50),
            "fields": "title,url,year,abstract",
        },
    )
    if not data or "data" not in data:
        return []
    results = []
    seen = set()
    dataset_pattern = re.compile(
        r'\b([A-Z][A-Za-z0-9]*(?:[-_][A-Za-z0-9]+)*)\b(?:\s+dataset|\s+benchmark|\s+corpus)',
        re.IGNORECASE,
    )
    for paper in data["data"]:
        title = paper.get("title", "")
        abstract = paper.get("abstract", "") or ""
        year = paper.get("year") or ""
        paper_url = paper.get("url", "")
        # Extract dataset names from title and abstract
        matches = dataset_pattern.findall(title + " " + abstract)
        for m in matches:
            norm = normalize_name(m)
            if norm in seen or len(norm) < 3:
                continue
            seen.add(norm)
            results.append({
                **EMPTY_RESULT,
                "name": m,
                "source": "papers",
                "source_id": paper_url,
                "url": paper_url,
                "description": f"Mentioned in: {title}" + (f" ({year})" if year else ""),
                "tags": [f"year:{year}"] if year else [],
            })
    return results[:max_results]


SOURCE_HANDLERS = {
    "huggingface": search_huggingface,
    "openml": search_openml,
    "github": search_github,
    "papers": search_papers,
}


# ---------------------------------------------------------------------------
# Ranking
# ---------------------------------------------------------------------------

def rank_results(results, query, modality_filter=""):
    """Score each result 0-100 and sort descending."""
    query_terms = set(normalize_name(query).split())

    for r in results:
        score = 0
        name_norm = normalize_name(r["name"])
        desc_norm = normalize_name(r.get("description", ""))
        combined = name_norm + " " + desc_norm

        # Term overlap (up to 30)
        overlap = sum(1 for t in query_terms if t in combined)
        score += min(30, int(30 * overlap / max(len(query_terms), 1)))

        # Popularity (up to 25)
        pop = max(r.get("downloads", 0), r.get("stars", 0))
        if pop > 100_000:
            score += 25
        elif pop > 10_000:
            score += 20
        elif pop > 1_000:
            score += 15
        elif pop > 100:
            score += 10
        elif pop > 0:
            score += 5

        # Modality match (15)
        if modality_filter and r.get("modality"):
            if modality_filter.lower() == r["modality"].lower():
                score += 15

        # Recency proxy via tags (10)
        for tag in r.get("tags", []):
            if tag.startswith("year:"):
                try:
                    y = int(tag.split(":")[1])
                    if y >= 2023:
                        score += 10
                    elif y >= 2020:
                        score += 5
                except ValueError:
                    pass
                break

        # Task match (10)
        for task in r.get("task_categories", []):
            if any(t in normalize_name(task) for t in query_terms):
                score += 10
                break

        # License bonus (5)
        lic = (r.get("license") or "").lower()
        if any(k in lic for k in ("mit", "apache", "cc-by", "cc0", "bsd")):
            score += 5

        # Multi-source bonus: applied during dedup
        r["relevance_score"] = min(100, score)

    results.sort(key=lambda r: r["relevance_score"], reverse=True)
    return results


# ---------------------------------------------------------------------------
# Dedup
# ---------------------------------------------------------------------------

def dedup_results(results):
    """Merge duplicates across sources; boost multi-source entries."""
    seen = {}  # canonical_key -> {result, sources_seen}
    for r in results:
        key = canonical_key(r["name"])
        if key in seen:
            existing = seen[key]["result"]
            existing_sources = seen[key]["sources"]
            # Only boost score for cross-source duplicates (not same-source versions)
            if r["source"] not in existing_sources:
                existing["relevance_score"] = min(100, existing["relevance_score"] + 5)
                existing["description"] += f" (also on {r['source']})"
                existing_sources.add(r["source"])
            # Keep the richer record (more downloads/stars)
            if (r.get("downloads", 0) + r.get("stars", 0)) > (existing.get("downloads", 0) + existing.get("stars", 0)):
                url_backup = existing["url"]
                desc_backup = existing["description"]
                score_backup = existing["relevance_score"]
                existing.update(r)
                existing["description"] = desc_backup
                existing["relevance_score"] = score_backup
                existing["url"] = existing["url"] or url_backup
        else:
            seen[key] = {"result": r, "sources": {r["source"]}}
    return [v["result"] for v in seen.values()]


# ---------------------------------------------------------------------------
# Output formatting
# ---------------------------------------------------------------------------

def truncate(s, n):
    s = str(s)
    return (s[:n-1] + "…") if len(s) > n else s


def results_to_markdown(results):
    """Return a markdown table string."""
    lines = ["| # | Name | Source | Downloads | Size | License | Tags | URL |",
             "|---|------|--------|-----------|------|---------|------|-----|"]
    for i, r in enumerate(results, 1):
        tags = ", ".join(r.get("task_categories", [])[:3]) or ", ".join(r.get("tags", [])[:3])
        dl = r.get("downloads") or r.get("stars") or ""
        lines.append(
            f"| {i} "
            f"| {truncate(r['name'], 40)} "
            f"| {r['source']} "
            f"| {dl} "
            f"| {truncate(r.get('size_category', ''), 15)} "
            f"| {truncate(r.get('license', ''), 15)} "
            f"| {truncate(tags, 30)} "
            f"| {r['url']} |"
        )
    return "\n".join(lines)


# ---------------------------------------------------------------------------
# Subcommands
# ---------------------------------------------------------------------------

def cmd_search(args):
    """Search across sources, dedup, rank, output."""
    sources = [s.strip() for s in args.sources.split(",")]
    all_results = []
    for src in sources:
        handler = SOURCE_HANDLERS.get(src)
        if not handler:
            print(f"  [warn] Unknown source: {src}", file=sys.stderr)
            continue
        all_results.extend(handler(args.query, max_results=args.max))

    if not all_results:
        print("No results found.", file=sys.stderr)
        return

    # Rank, dedup, re-sort
    ranked = rank_results(all_results, args.query, modality_filter=args.modality or "")
    deduped = dedup_results(ranked)
    deduped.sort(key=lambda r: r["relevance_score"], reverse=True)
    deduped = deduped[:args.max]

    # Output markdown table
    print(results_to_markdown(deduped))

    # Save JSON
    workspace = Path(args.workspace)
    ensure_dir(workspace)
    out_path = workspace / f"search-{datetime.now(timezone.utc).strftime('%Y-%m-%d')}.json"
    with open(out_path, "w") as f:
        json.dump(deduped, f, indent=2, default=str)
    print(f"\nResults saved to {out_path}", file=sys.stderr)


def cmd_detail(args):
    """Fetch detailed metadata for a single dataset."""
    source, _, dataset_id = args.dataset_id.partition(":")
    if not dataset_id:
        print("Error: --dataset-id must be 'source:id' (e.g. 'huggingface:stanfordnlp/imdb')", file=sys.stderr)
        sys.exit(1)

    workspace = Path(args.workspace) / "datasets" / f"{source}_{safe_slug(dataset_id)}"
    ensure_dir(workspace)

    metadata = None

    if source == "huggingface":
        print(f"  Fetching HuggingFace dataset info for {dataset_id}...", file=sys.stderr)
        # Try datasets-server info endpoint
        metadata = fetch_json(
            "https://datasets-server.huggingface.co/info",
            params={"dataset": dataset_id},
        )
        if not metadata:
            # Fallback to API
            metadata = fetch_json(f"https://huggingface.co/api/datasets/{dataset_id}")

    elif source == "openml":
        print(f"  Fetching OpenML dataset info for {dataset_id}...", file=sys.stderr)
        metadata = fetch_json(f"https://www.openml.org/api/v1/json/data/{dataset_id}")

    elif source == "github":
        print(f"  Fetching GitHub repo info for {dataset_id}...", file=sys.stderr)
        # dataset_id is the full URL or owner/repo
        repo = dataset_id.replace("https://github.com/", "")
        try:
            proc = subprocess.run(
                ["gh", "repo", "view", repo, "--json", "name,description,url,stargazersCount,licenseInfo,readme"],
                capture_output=True, text=True, timeout=15,
            )
            if proc.returncode == 0:
                metadata = json.loads(proc.stdout)
        except (subprocess.TimeoutExpired, json.JSONDecodeError, FileNotFoundError):
            pass
    else:
        print(f"Error: Unknown source '{source}'", file=sys.stderr)
        sys.exit(1)

    if not metadata:
        print(f"Could not retrieve metadata for {args.dataset_id}", file=sys.stderr)
        sys.exit(1)

    # Write metadata.json
    meta_path = workspace / "metadata.json"
    with open(meta_path, "w") as f:
        json.dump(metadata, f, indent=2, default=str)
    print(f"  Wrote {meta_path}", file=sys.stderr)

    # Write README.md
    readme_path = workspace / "README.md"
    with open(readme_path, "w") as f:
        f.write(f"# {dataset_id}\n\n")
        f.write(f"**Source**: {source}\n\n")
        if source == "huggingface":
            f.write(f"**URL**: https://huggingface.co/datasets/{dataset_id}\n\n")
            # Extract config/split info from metadata
            if isinstance(metadata, dict) and "dataset_info" in metadata:
                info = metadata["dataset_info"]
                if isinstance(info, dict):
                    for config_name, config_data in info.items():
                        f.write(f"## Config: {config_name}\n\n")
                        if isinstance(config_data, dict):
                            splits = config_data.get("splits", {})
                            if splits:
                                f.write("| Split | Rows |\n|-------|------|\n")
                                for split_name, split_info in splits.items():
                                    rows = split_info.get("num_examples", "?") if isinstance(split_info, dict) else "?"
                                    f.write(f"| {split_name} | {rows} |\n")
                                f.write("\n")
        elif source == "openml":
            f.write(f"**URL**: https://www.openml.org/d/{dataset_id}\n\n")
        elif source == "github":
            readme_content = metadata.get("readme", "")
            if readme_content:
                f.write(f"## Original README\n\n{readme_content[:2000]}\n")
        f.write(f"\n---\n*Metadata saved to metadata.json*\n")
    print(f"  Wrote {readme_path}", file=sys.stderr)
    print(f"\nDetail saved to {workspace}/", file=sys.stderr)


def cmd_pull(args):
    """Pull sample rows for a dataset."""
    source, _, dataset_id = args.dataset_id.partition(":")
    if not dataset_id:
        print("Error: --dataset-id must be 'source:id' (e.g. 'huggingface:stanfordnlp/imdb')", file=sys.stderr)
        sys.exit(1)

    workspace = Path(args.workspace) / "datasets" / f"{source}_{safe_slug(dataset_id)}"
    ensure_dir(workspace)

    sample_rows = args.sample_rows

    if source == "huggingface":
        print(f"  Pulling sample from HuggingFace: {dataset_id}...", file=sys.stderr)

        # First, get available configs/splits
        info = fetch_json(
            "https://datasets-server.huggingface.co/info",
            params={"dataset": dataset_id},
        )
        config = "default"
        split = "train"
        if info and "dataset_info" in info:
            di = info["dataset_info"]
            if isinstance(di, dict):
                configs = list(di.keys())
                if configs:
                    config = configs[0]
                    config_info = di[config]
                    if isinstance(config_info, dict) and "splits" in config_info:
                        splits = list(config_info["splits"].keys())
                        if splits:
                            split = splits[0]

        data = fetch_json(
            "https://datasets-server.huggingface.co/first-rows",
            params={"dataset": dataset_id, "config": config, "split": split},
        )
        if not data or "rows" not in data:
            print(f"  Could not fetch sample rows. Try a different config/split.", file=sys.stderr)
            sys.exit(1)

        rows = data["rows"][:sample_rows]
        sample_path = workspace / "sample.jsonl"
        with open(sample_path, "w") as f:
            for row in rows:
                row_data = row.get("row", row)
                f.write(json.dumps(row_data, default=str) + "\n")
        print(f"  Wrote {len(rows)} rows to {sample_path}", file=sys.stderr)
        print(f"\nSample saved to {sample_path}", file=sys.stderr)

    elif source == "openml":
        print("  OpenML pull: use the OpenML Python API or download CSV directly.", file=sys.stderr)
        print(f"  URL: https://www.openml.org/d/{dataset_id}", file=sys.stderr)

    elif source == "github":
        print("  GitHub pull: clone the repo to get dataset files.", file=sys.stderr)
        print(f"  git clone {dataset_id}", file=sys.stderr)

    else:
        print(f"  Pull not supported for source '{source}'.", file=sys.stderr)


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(
        description="Multi-source ML dataset discovery",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=textwrap.dedent("""\
            Examples:
              %(prog)s search --query "image classification" --sources huggingface --max 10
              %(prog)s search --query "sentiment analysis" --sources huggingface,openml,github,papers
              %(prog)s detail --dataset-id "huggingface:stanfordnlp/imdb"
              %(prog)s pull --dataset-id "huggingface:stanfordnlp/imdb" --sample-rows 5
        """),
    )
    sub = parser.add_subparsers(dest="command", required=True)

    # search
    p_search = sub.add_parser("search", help="Search for datasets across sources")
    p_search.add_argument("--query", "-q", required=True, help="Search query")
    p_search.add_argument("--sources", "-s", default="huggingface,openml,github,papers",
                          help="Comma-separated sources (default: all)")
    p_search.add_argument("--max", "-m", type=int, default=30, help="Max results (default: 30)")
    p_search.add_argument("--modality", default="", help="Filter: image, text, tabular, audio")
    p_search.add_argument("--workspace", "-w", default="./datasets/discovery/", help="Output directory")

    # detail
    p_detail = sub.add_parser("detail", help="Fetch detailed metadata for a dataset")
    p_detail.add_argument("--dataset-id", required=True, help="source:id (e.g. huggingface:stanfordnlp/imdb)")
    p_detail.add_argument("--workspace", "-w", default="./datasets/discovery/", help="Output directory")

    # pull
    p_pull = sub.add_parser("pull", help="Pull sample rows from a dataset")
    p_pull.add_argument("--dataset-id", required=True, help="source:id (e.g. huggingface:stanfordnlp/imdb)")
    p_pull.add_argument("--sample-rows", type=int, default=20, help="Number of sample rows (default: 20)")
    p_pull.add_argument("--workspace", "-w", default="./datasets/discovery/", help="Output directory")

    args = parser.parse_args()
    if args.command == "search":
        cmd_search(args)
    elif args.command == "detail":
        cmd_detail(args)
    elif args.command == "pull":
        cmd_pull(args)


if __name__ == "__main__":
    main()
