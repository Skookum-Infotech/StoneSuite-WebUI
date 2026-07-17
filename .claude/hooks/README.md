# Claude Code hooks (Tier 0 — deterministic, $0 AI tokens)

Wired in `.claude/settings.json`. They run as plain shell on every `Edit`/`Write`/`MultiEdit`
and cost no model tokens. They enforce the inviolable rules from `CLAUDE.md`.

## `guard.sh` — PreToolUse (blocks on violation, exit 2)
Blocks edits that would:
- introduce `: any` in TS/TSX, or inline `style={{` in TSX
- write to a real `.env*`/`*.key`/`*credentials*.json` file (`.env.example`/`.env.sample`/
  `.env.template` are exempt — they hold no real values)

## `lint.sh` — PostToolUse (advisory, exit 2 feeds remaining issues back to Claude)
Runs `eslint --fix` on the single `.ts`/`.tsx` file just edited. The edit already
happened by the time this runs, so it never blocks — it silently accepts anything
`--fix` resolves and reports only what's left, same as running `eslint --fix` yourself.
No-ops if `node_modules/.bin/eslint` isn't installed yet.

## Notes
- Edit the rule set by editing `guard.sh`/`lint.sh`; self-test with the cases in the
  commit that added them (pipe sample `{"tool_name":...,"tool_input":{"file_path":...}}`
  JSON on stdin — see git history for worked examples).
- A hook blocking a legit change is a signal the rule needs narrowing — adjust the
  script, don't bypass. To temporarily disable, comment out the relevant `hooks` block
  in `settings.json`.
- **Hooks load at session start.** Editing `guard.sh`, `lint.sh`, or `settings.json`
  has no effect on the running session — restart Claude Code (`claude --debug` to
  confirm registration) to pick up changes.
- Both scripts must be **executable** (`chmod +x`) — `settings.json` invokes them as a
  bare path (`$CLAUDE_PROJECT_DIR/.claude/hooks/<script>.sh`), not `bash <script>.sh`,
  so a non-executable file fails silently (non-blocking, exit 126) rather than running.
