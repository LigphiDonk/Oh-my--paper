#!/usr/bin/env python3
"""
GitHub repository search and optional clone helper.

Standalone script that replaces the custom `search_github_repos_wrapper` and
`tracked_execute_command` tools from the reference pipeline. Designed to be
invoked by Claude Code or any shell environment.

Usage:
    python github_search_clone.py --query "sinkhorn attention pytorch" --limit 5
    python github_search_clone.py --query "entmax sparse" --limit 3 --clone-to /workplace

Environment:
    GITHUB_TOKEN  — optional; increases rate limit from 10 to 30 req/min.
"""

import argparse
import json
import os
import re
import subprocess
import sys
import time
from urllib.parse import quote

try:
    import requests
except ImportError:
    print("[ERROR] 'requests' library not found. Install with: pip install requests", file=sys.stderr)
    sys.exit(1)


# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------
GITHUB_API = "https://api.github.com/search/repositories"
MAX_QUERY_LENGTH = 256
SAFE_QUERY_LENGTH = 200
EXCLUDE_USERS = ["lucidrains"]
RATE_LIMIT_DELAY = 2  # seconds between API calls


def _build_query(raw_query: str, date_limit: str | None) -> str:
    """Build a GitHub search query with filters, truncating if necessary."""
    exclude = " ".join(f"-user:{u}" for u in EXCLUDE_USERS) if EXCLUDE_USERS else ""
    suffix_parts = []
    if exclude:
        suffix_parts.append(exclude)
    if date_limit:
        suffix_parts.append(f"created:<{date_limit}")
    suffix = (" " + " ".join(suffix_parts)) if suffix_parts else ""
    suffix_len = len(suffix)

    query = re.sub(r"\s+", " ", raw_query).strip()
    max_q_len = SAFE_QUERY_LENGTH - suffix_len
    if max_q_len <= 0:
        raise ValueError(f"Filter suffix too long ({suffix_len} chars)")

    if len(query) > max_q_len:
        truncated = query[:max_q_len]
        last_sp = truncated.rfind(" ")
        if last_sp > int(max_q_len * 0.8):
            query = truncated[:last_sp]
        else:
            query = truncated

    full = f"{query}{suffix}"
    encoded = quote(full)

    attempts = 0
    while len(encoded) > MAX_QUERY_LENGTH and attempts < 10:
        attempts += 1
        reduction = max(10, int(len(query) * 0.1))
        target = len(query) - reduction
        if target <= 10:
            break
        truncated = query[:target]
        last_sp = truncated.rfind(" ")
        if last_sp > int(target * 0.8):
            query = truncated[:last_sp]
        else:
            query = truncated
        full = f"{query}{suffix}"
        encoded = quote(full)

    return encoded


def search_repos(query: str, limit: int = 5, date_limit: str | None = None) -> list[dict]:
    """Search GitHub repositories and return structured results."""
    encoded_q = _build_query(query, date_limit)
    token = os.environ.get("GITHUB_TOKEN", "")
    headers = {"Accept": "application/vnd.github.v3+json"}
    if token:
        headers["Authorization"] = f"token {token}"

    repos: list[dict] = []
    page = 1
    per_page = 10

    while len(repos) < limit:
        url = f"{GITHUB_API}?q={encoded_q}&per_page={per_page}&page={page}"
        if page > 1:
            time.sleep(RATE_LIMIT_DELAY)

        resp = requests.get(url, headers=headers, timeout=30)

        if resp.status_code == 403:
            retry_after = int(resp.headers.get("Retry-After", 60))
            print(f"[rate-limit] Waiting {retry_after}s ...", file=sys.stderr)
            time.sleep(retry_after)
            continue  # retry same page

        if resp.status_code != 200:
            print(f"[error] GitHub API {resp.status_code}: {resp.text[:200]}", file=sys.stderr)
            break

        items = resp.json().get("items", [])
        for item in items:
            desc = item.get("description") or ""
            lang = item.get("language")
            # Filter: skip overly long descriptions, HTML-only, or language-less repos
            if len(desc) > 500:
                continue
            if lang is None or str(lang).lower() in {"none", "html"}:
                continue

            repos.append({
                "name": f"{item['owner']['login']}/{item['name']}",
                "description": desc,
                "url": item["html_url"],
                "clone_url": item["clone_url"],
                "stars": item["stargazers_count"],
                "language": lang,
                "created_at": item["created_at"],
            })
            if len(repos) >= limit:
                break

        if len(items) < per_page:
            break
        page += 1

    return repos


def clone_repo(clone_url: str, target_dir: str, depth: int = 1) -> dict:
    """Clone a repository and return status info."""
    os.makedirs(os.path.dirname(target_dir) or ".", exist_ok=True)
    cmd = ["git", "clone", "--depth", str(depth), clone_url, target_dir]
    env = {**os.environ, "GIT_TERMINAL_PROMPT": "0"}
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=120, env=env)
        success = result.returncode == 0
        return {
            "success": success,
            "path": target_dir,
            "message": result.stderr.strip() if not success else "ok",
        }
    except subprocess.TimeoutExpired:
        return {"success": False, "path": target_dir, "message": "clone timed out (120s)"}
    except Exception as e:
        return {"success": False, "path": target_dir, "message": str(e)}


def main():
    parser = argparse.ArgumentParser(description="Search GitHub repos and optionally clone them.")
    parser.add_argument("--query", required=True, help="Search query keywords")
    parser.add_argument("--limit", type=int, default=5, help="Max results to return (default: 5)")
    parser.add_argument("--date-limit", default=None, help="Only repos created before this date (YYYY-MM-DD)")
    parser.add_argument("--clone-to", default=None, help="Directory to clone top results into")
    parser.add_argument("--clone-top", type=int, default=0, help="Clone top N results (0 = search only)")
    parser.add_argument("--depth", type=int, default=1, help="Git clone depth (default: 1)")
    args = parser.parse_args()

    results = search_repos(args.query, limit=args.limit, date_limit=args.date_limit)

    # Optionally clone top N
    if args.clone_to and args.clone_top > 0:
        for repo in results[: args.clone_top]:
            repo_name = repo["name"].split("/")[-1]
            target = os.path.join(args.clone_to, repo_name)
            if os.path.exists(target):
                repo["clone_status"] = {"success": True, "path": target, "message": "already exists"}
            else:
                repo["clone_status"] = clone_repo(repo["clone_url"], target, depth=args.depth)

    # Output JSON to stdout
    print(json.dumps(results, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
