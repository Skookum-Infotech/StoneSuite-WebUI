#!/usr/bin/env bash
# PostToolUse lint for StoneSuite-WebUI. Runs `eslint --fix` on the single file
# just edited so violations surface immediately instead of at `npm run lint`/CI
# time. The edit already happened by the time this runs, so this never blocks
# it — exit 2 just feeds any issues --fix couldn't resolve back to Claude as
# something to address, same as running `eslint --fix` yourself would report.
#
# Wired in .claude/settings.json on Edit|Write|MultiEdit. Reads the tool call
# as JSON on stdin: { tool_name, tool_input: { file_path } }.
set -euo pipefail

payload="$(cat)"

read -r -d '' PYEXTRACT <<'PY' || true
import json, sys
d = json.load(sys.stdin)
ti = d.get("tool_input", {}) or {}
print(ti.get("file_path", "") or "")
PY

file_path="$(printf '%s' "$payload" | python3 -c "$PYEXTRACT" 2>/dev/null || true)"

[ -z "$file_path" ] && exit 0
[ -f "$file_path" ] || exit 0

case "$file_path" in
  *.ts|*.tsx) ;;
  *) exit 0 ;;
esac

project_dir="${CLAUDE_PROJECT_DIR:-}"
[ -z "$project_dir" ] && project_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$project_dir"

eslint_bin="$project_dir/node_modules/.bin/eslint"
[ -x "$eslint_bin" ] || exit 0

output="$("$eslint_bin" --fix "$file_path" 2>&1)" && exit 0

echo "ESLint found issues in $file_path that --fix couldn't resolve:" >&2
echo "$output" >&2
exit 2
