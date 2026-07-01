#!/usr/bin/env bash
# PostToolUse formatter for StoneSuite. Best-effort, never blocks (always exit 0).
# Keeps Go files gofmt-clean so the model doesn't spend tokens on formatting churn.
set -uo pipefail

payload="$(cat)"
file_path="$(printf '%s' "$payload" | python3 -c 'import json,sys; print((json.load(sys.stdin).get("tool_input",{}) or {}).get("file_path",""))' 2>/dev/null || true)"

[ -z "$file_path" ] && exit 0
[ -f "$file_path" ] || exit 0

case "$file_path" in
  *.go)
    command -v gofmt >/dev/null 2>&1 && gofmt -w "$file_path" >/dev/null 2>&1 || true ;;
esac

exit 0
