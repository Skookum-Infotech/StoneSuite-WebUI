#!/usr/bin/env bash
# PreToolUse guard for StoneSuite-WebUI. Blocks edits/writes that violate the
# inviolable rules in CLAUDE.md. Deterministic: no AI tokens. Exit 2 => block
# (reason printed to stderr).
#
# Wired in .claude/settings.json on Edit|Write|MultiEdit. Reads the tool call
# as JSON on stdin: { tool_name, tool_input: { file_path, content?, new_string? } }.
set -euo pipefail

payload="$(cat)"

# Pull file_path and the text being introduced (Write=content, Edit=new_string,
# MultiEdit=all edits' new_string joined) out of the JSON via python3.
read -r -d '' PYEXTRACT <<'PY' || true
import json, sys
d = json.load(sys.stdin)
ti = d.get("tool_input", {}) or {}
path = ti.get("file_path", "") or ""
parts = []
if ti.get("content"):     parts.append(ti["content"])
if ti.get("new_string"):  parts.append(ti["new_string"])
for e in (ti.get("edits") or []):
    if e.get("new_string"): parts.append(e["new_string"])
print(path)
print("\x00".join(parts))
PY

extracted="$(printf '%s' "$payload" | python3 -c "$PYEXTRACT" 2>/dev/null || true)"
file_path="$(printf '%s' "$extracted" | sed -n '1p')"
new_text="$(printf '%s' "$extracted" | sed -n '2,$p')"

# Nothing to inspect -> allow.
[ -z "$file_path" ] && exit 0

block() { echo "BLOCKED by StoneSuite guard: $1" >&2; exit 2; }

base="$(basename "$file_path")"

# ---- Frontend: no 'any', no inline style={{ }} -----------------------------
if [[ "$base" == *.ts || "$base" == *.tsx ]]; then
  if printf '%s' "$new_text" | grep -nE ':[[:space:]]*any\b' >/dev/null; then
    block "'any' is banned (@typescript-eslint/no-explicit-any is an error). Type it properly."
  fi
  if [[ "$base" == *.tsx ]] && printf '%s' "$new_text" | grep -nE 'style=\{\{' >/dev/null; then
    block "inline style={{ }} is banned (CLAUDE.md React rules). Use Tailwind className= instead."
  fi
fi

exit 0
