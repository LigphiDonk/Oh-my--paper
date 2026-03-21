# Overleaf Skill for OpenClaw

AI-powered Overleaf integration for [OpenClaw](https://github.com/openclaw/openclaw).

## Features

- 📄 Read/write LaTeX files directly from Overleaf
- 🔄 Sync local .tex files with Overleaf projects
- 📦 Download entire projects as zip
- 🔐 Authenticate via browser cookies (no API key needed)

## Installation

```bash
# Install the skill
clawhub install overleaf

# Install pyoverleaf CLI
pipx install pyoverleaf
```

## Requirements

- Python 3.8+
- Logged into Overleaf in Chrome/Firefox
- macOS: Grant keychain access on first run

## Example

Here's an example of using the skill to remove em dashes (a common AI writing artifact) from a paper and push the changes to Overleaf:

![Example: Remove em dashes and push to Overleaf](example-em-dash.jpg)

## Usage

See [SKILL.md](SKILL.md) for detailed usage instructions.

## Links

- [ClawHub: overleaf](https://clawhub.ai/skills/overleaf)
- [pyoverleaf GitHub](https://github.com/jkulhanek/pyoverleaf)
- [OpenClaw](https://github.com/openclaw/openclaw)
