#!/usr/bin/env bash
# PreToolUse hook (Bash): rewrites a plain test/build command so its output is
# piped through filter-npm-output.sh, dropping passing-test and emitted-asset
# lines. Exit status is preserved via pipefail. Only commands matching a strict
# allowlist are rewritten; everything else is left alone.
set -uo pipefail

payload="$(cat)"
cmd="$(printf '%s' "$payload" | python3 -c 'import json,sys; print((json.load(sys.stdin).get("tool_input") or {}).get("command") or "")' 2>/dev/null || true)"

# Strict allowlist: `npm test`, `npm run test|build|ci`, or `npx vitest run`
# followed only by plain paths and known-safe flags. Anything with shell
# metacharacters, quotes or newlines is left alone.
arg='--?[A-Za-z][A-Za-z0-9-]*(=[A-Za-z0-9_.,:/-]+)?|[A-Za-z0-9_./][A-Za-z0-9_./-]*'
re="^(npm test|npm run (test|build|ci)|npx vitest run)( ($arg))*$"
[[ "$cmd" =~ $re ]] || exit 0

filter="$CLAUDE_PROJECT_DIR/.claude/hooks/filter-npm-output.sh"
[ -f "$filter" ] || exit 0

new="set -o pipefail; { $cmd ; } 2>&1 | bash \"$filter\""
python3 -c 'import json,sys; print(json.dumps({"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"allow","updatedInput":{"command":sys.argv[1]}}}))' "$new"
