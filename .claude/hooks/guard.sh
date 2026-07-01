#!/usr/bin/env bash
# PreToolUse guard for StoneSuite. Blocks edits/writes that violate the
# inviolable rules in CLAUDE.md (multi-tenancy, migrations, banned patterns).
# Deterministic: no AI tokens. Exit 2 => block (reason printed to stderr).
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

# ---- Rule: no tenant down-migrations (recovery is via Neon PITR) ------------
case "$file_path" in
  */migrations/*.down.sql)
    block "down-migrations are forbidden (CLAUDE.md). Recover via Neon point-in-time restore, not down SQL." ;;
esac

# ---- Rule: migration schema must be idempotent -----------------------------
#  The schema is a single canonical schema.sql re-applied on any DB state, so
#  ADD COLUMN and CREATE TABLE MUST be guarded with IF NOT EXISTS.
if [[ "$file_path" == */migrations/* ]]; then
  while IFS= read -r line; do
    low="$(printf '%s' "$line" | tr 'A-Z' 'a-z')"
    case "$low" in
      *"add column"*)
        printf '%s' "$low" | grep -q 'if not exists' || \
          block "migration 'ADD COLUMN' must use 'ADD COLUMN IF NOT EXISTS' (idempotent schema): $line" ;;
      *"create table"*)
        printf '%s' "$low" | grep -q 'if not exists' || \
          block "migration 'CREATE TABLE' must use 'CREATE TABLE IF NOT EXISTS' (idempotent schema): $line" ;;
    esac
  done <<< "$new_text"
fi

# ---- Rule: tenant-DB stores are scoped by the DB connection, never by a -----
#           WHERE tenant_id filter. (Control-plane code is intentionally excluded.)
case "$file_path" in
  */backend/lead/*|*/backend/prospect/*|*/backend/workflow/*|*/backend/crmstore/*)
    if printf '%s' "$new_text" | grep -iqE 'where[[:space:]].*tenant_id'; then
      block "tenant-DB queries are scoped by the database connection, not 'WHERE tenant_id' (CLAUDE.md multi-tenancy rule #1)."
    fi ;;
esac

# ---- Rule: no panic() in backend request paths (return errors instead) ------
if [[ "$base" == *.go && "$base" != *_test.go && "$base" != main.go ]]; then
  # ignore commented lines; flag a real panic( call
  if printf '%s' "$new_text" | grep -nE '^[[:space:]]*panic\(' >/dev/null; then
    block "panic() is forbidden in production paths (CLAUDE.md Go rules). Return a wrapped error up the stack."
  fi
fi

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
