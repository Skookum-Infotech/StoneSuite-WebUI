// Pure helpers behind the shared StatusSelect control. Kept React-free so the
// branch that varies per sales document (transition filtering vs. flat catalog)
// is unit-testable without mounting a component.

export interface StatusOption {
  code: string;
  label: string;
}

/** Per-target permission verdict. When `permitted` is false the option is
 *  rendered disabled (via aria-disabled, so it stays in the a11y tree) with
 *  `reason` shown beside it; `needsApprove` swaps in the shield icon. */
export interface TransitionGuardResult {
  permitted: boolean;
  reason?: string;
  needsApprove?: boolean;
}

/** Resolve which options to render and whether the current status is terminal.
 *  With `allowedTransitions` (mirrors the backend `<doc>/transitions.go`), only
 *  the current status plus its legal next-moves are offered and a status with
 *  no legal moves is terminal. Without it, the whole catalog is offered and it
 *  is never terminal. */
export function resolveStatusOptions(
  statuses: StatusOption[],
  value: string,
  allowedTransitions?: Record<string, string[]>,
): { options: StatusOption[]; isTerminal: boolean } {
  if (!allowedTransitions) return { options: statuses, isTerminal: false };
  const nextCodes = allowedTransitions[value] ?? [];
  const options = statuses.filter((s) => s.code === value || nextCodes.includes(s.code));
  return { options, isTerminal: nextCodes.length === 0 };
}

/** Whether picking `code` would land on a status with no further legal moves
 *  out of it — i.e. this move can't be walked back via the status control
 *  afterward. Used to gate the compact 'pill' variant's two-step confirm.
 *  Without `allowedTransitions` nothing is ever terminal. */
export function isTerminalTarget(code: string, allowedTransitions?: Record<string, string[]>): boolean {
  if (!allowedTransitions) return false;
  return (allowedTransitions[code] ?? []).length === 0;
}
