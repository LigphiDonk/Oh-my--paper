#!/bin/bash
# Sync a local file to Overleaf
# Usage: ./sync-to-overleaf.sh "Project Name/path/file.tex" /path/to/local/file.tex

set -e

if [ $# -lt 2 ]; then
    echo "Usage: $0 \"Project Name/path/file.tex\" /path/to/local/file.tex"
    exit 1
fi

OVERLEAF_PATH="$1"
LOCAL_FILE="$2"

if [ ! -f "$LOCAL_FILE" ]; then
    echo "Error: Local file not found: $LOCAL_FILE"
    exit 1
fi

echo "Syncing $LOCAL_FILE → $OVERLEAF_PATH"
cat "$LOCAL_FILE" | pyoverleaf write "$OVERLEAF_PATH"
echo "Done!"
