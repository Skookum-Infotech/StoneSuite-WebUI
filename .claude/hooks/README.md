# Claude Code hooks (Tier 0 — deterministic, $0 AI tokens)

Wired in `.claude/settings.json`. They run as plain shell on every `Edit`/`Write`/`MultiEdit`
and cost no model tokens. They enforce the inviolable rules from `CLAUDE.md`.

## `guard.sh` — PreToolUse (blocks on violation, exit 2)
Blocks edits that would:
- introduce `: any` in TS/TSX, or inline `style={{` in TSX

## Notes
- Edit the rule set by editing `guard.sh`; self-test with the cases in the commit that added it.
- A hook blocking a legit change is a signal the rule needs narrowing — adjust `guard.sh`, don't
  bypass. To temporarily disable, comment out the relevant `hooks` block in `settings.json`.
