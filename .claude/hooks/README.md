# Claude Code hooks (Tier 0 — deterministic, $0 AI tokens)

Wired in `.claude/settings.json`. They run as plain shell on every `Edit`/`Write`/`MultiEdit`
and cost no model tokens. They enforce the inviolable rules from `CLAUDE.md`.

## `guard.sh` — PreToolUse (blocks on violation, exit 2)
Blocks edits that would:
- create a `*.down.sql` migration (recovery is via Neon PITR)
- write a non-idempotent `ADD COLUMN` / `CREATE TABLE` in any `migrations/` file —
  the schema is a single canonical `schema.sql` re-applied on any DB state, so both
  must use `IF NOT EXISTS`
- add a `WHERE tenant_id` filter in a tenant-DB store (`lead/`, `prospect/`, `workflow/`,
  `crmstore/`) — tenant scope is the DB connection, not a filter. Control-plane code is exempt.
- introduce `panic(` in a backend handler (non-test, non-`main.go`)
- introduce `: any` in TS/TSX, or inline `style={{` in TSX

## `format.sh` — PostToolUse (best-effort, never blocks)
Runs `gofmt -w` on saved `.go` files so formatting never costs model tokens.

## Notes
- Edit the rule set by editing `guard.sh`; self-test with the cases in the commit that added it.
- A hook blocking a legit change is a signal the rule needs narrowing — adjust `guard.sh`, don't
  bypass. To temporarily disable, comment out the relevant `hooks` block in `settings.json`.
