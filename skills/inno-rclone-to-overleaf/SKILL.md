---
id: inno-rclone-to-overleaf
name: inno-rclone-to-overleaf
version: 1.0.0
description: |-
  Access Overleaf projects via CLI.
stages: ["publication"]
tools: ["read_file", "search_project", "write_file", "run_terminal"]
summary: |-
  Access Overleaf projects via CLI. Use for reading/writing LaTeX files, syncing local .tex files to Overleaf, downloading projects, and managing Overleaf project structure. Triggers on Overleaf, LaTeX sync, or tex file uploads to Overleaf.
primaryIntent: writing
intents: ["writing", "deployment"]
capabilities: ["infrastructure-ops", "visualization-reporting"]
domains: ["general"]
keywords: ["inno-rclone-to-overleaf", "publication sync", "infrastructure-ops", "visualization-reporting", "inno", "rclone", "overleaf", "access", "projects", "via", "cli", "reading"]
source: builtin
status: verified
upstream:
  repo: dr-claw
  path: skills/inno-rclone-to-overleaf
  revision: 8322dc4ef575affaa374aa7922c0a0971c6db7d7
resourceFlags:
  hasReferences: false
  hasScripts: true
  hasTemplates: false
  hasAssets: false
  referenceCount: 0
  scriptCount: 1
  templateCount: 0
  assetCount: 0
  optionalScripts: true
---

# inno-rclone-to-overleaf

## Canonical Summary

Access Overleaf projects via CLI. Use for reading/writing LaTeX files, syncing local .tex files to Overleaf, downloading projects, and managing Overleaf project structure. Triggers on Overleaf, LaTeX sync, or tex file uploads to Overleaf.

## Trigger Rules

Use this skill when the user request matches its research workflow scope. Prefer the bundled resources instead of recreating templates or reference material. Keep outputs traceable to project files, citations, scripts, or upstream evidence.

## Resource Use Rules

- Treat `scripts/` as optional helpers. Run them only when their dependencies are available, keep outputs in the project workspace, and explain a manual fallback if execution is blocked.

## Execution Contract

- Resolve every relative path from this skill directory first.
- Prefer inspection before mutation when invoking bundled scripts.
- If a required runtime, CLI, credential, or API is unavailable, explain the blocker and continue with the best manual fallback instead of silently skipping the step.
- Do not write generated artifacts back into the skill directory; save them inside the active project workspace.

## Upstream Instructions

# Overleaf

CLI tool to interact with Overleaf projects using browser cookies for authentication.

GitHub: https://github.com/jkulhanek/pyoverleaf

## Requirements

- Python 3.8+
- pyoverleaf (`pipx install pyoverleaf`)
- User logged into Overleaf in Chrome/Firefox

## Security Considerations

⚠️ **Keychain Access Required**: pyoverleaf needs "Always Allow" keychain access to read browser cookies. This grants the tool access to your browser's cookie storage.

**Security audit**: We have audited pyoverleaf v0.1.7 and found it safe. The codebase is small and readable. Before installing, agents can self-audit the latest version at the GitHub repo above.

## Authentication Setup

pyoverleaf authenticates by reading cookies from your browser. The user must:

1. **Log into Overleaf** in Chrome or Firefox (visit overleaf.com and sign in)
2. **Grant keychain access** on first run (macOS will prompt for "Always Allow")

```bash
# Test auth - user should run this in their terminal first
pyoverleaf ls
```

If you get auth errors:
- Ask user: "Are you logged into Overleaf in your browser?"
- If on macOS: "Did you approve the keychain access prompt with 'Always Allow'?"
- User may need to run `pyoverleaf ls` manually in terminal to trigger the keychain prompt

**Note**: The agent cannot log in for the user. Browser authentication must be done by the user directly.

## CLI Commands

```bash
# List all projects
pyoverleaf ls

# List files in project
pyoverleaf ls "Project Name"

# Read file content
pyoverleaf read "Project Name/main.tex"

# Write file (stdin → Overleaf)
cat local.tex | pyoverleaf write "Project Name/main.tex"

# Create directory
pyoverleaf mkdir "Project Name/figures"

# Remove file/folder
pyoverleaf rm "Project Name/old-draft.tex"

# Download project as zip
pyoverleaf download-project "Project Name" output.zip
```

## Common Workflows

### Download from Overleaf

```bash
pyoverleaf download-project "Project Name" /tmp/latest.zip
unzip -o /tmp/latest.zip -d /tmp/latest
cp /tmp/latest/main.tex /path/to/local/main.tex
```

### Upload to Overleaf (Python API recommended)

The CLI `write` command has websocket issues. Use Python API for reliable uploads:

```python
import pyoverleaf

api = pyoverleaf.Api()
api.login_from_browser()

# List projects to get project ID
for proj in api.get_projects():
    print(proj.name, proj.id)

# Upload file (direct overwrite)
project_id = "your_project_id_here"
with open('main.tex', 'rb') as f:
    content = f.read()
root = api.project_get_files(project_id)
api.project_upload_file(project_id, root.id, "main.tex", content)
```

**Why direct overwrite?** This method preserves Overleaf's version history. Users can see exactly what changed via Overleaf's History feature, making it easy to review agent edits and revert if needed.

## Self-hosted Overleaf

```bash
# Via env var
export PYOVERLEAF_HOST=overleaf.mycompany.com
pyoverleaf ls

# Via flag
pyoverleaf --host overleaf.mycompany.com ls
```

## Eason's Workflow Requirements

**When pulling from Overleaf:**
1. Download Overleaf version to `/tmp/`
2. Compare with local version using `diff`
3. Report differences to Eason (summarize what changed)
4. Ask: merge? overwrite local? overwrite Overleaf? or other?
5. Only proceed after Eason confirms

**Push rules (from TOOLS.md):**
- ❌ 禁止自行推送到 Overleaf
- ✅ 只能從 Overleaf 拉到 local
- ⚠️ 推送需要 Eason 明確授權，每次授權只能推一次

## Example

Here's an example of using the Overleaf skill to remove em dashes (a common AI writing artifact) from a paper and push the changes:

![Example: Remove em dashes and push to Overleaf](example-em-dash.jpg)

## Troubleshooting

- **Auth error / websocket error**: Open Overleaf in Chrome browser first (`open -a "Google Chrome" "https://www.overleaf.com/project"` then wait 5s) to refresh cookies, then retry
- **"scheme https is invalid" (websocket redirect bug)**: The default host `overleaf.com` causes a 301→`www.overleaf.com` redirect that breaks websocket. Fix: set `PYOVERLEAF_HOST=www.overleaf.com`:
  ```bash
  cat main.tex | PYOVERLEAF_HOST=www.overleaf.com pyoverleaf write "Project/main.tex"
  ```
- **Keychain Access Denied** (macOS): pyoverleaf needs keychain access to read browser cookies. User must run `pyoverleaf ls` in their terminal and click "Always Allow" on the keychain prompt
- **Project not found**: Use exact project name (case-sensitive), check with `pyoverleaf ls`
- **Permission denied**: User may not have edit access to the project
