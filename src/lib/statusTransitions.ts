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
 *  `nextCodes`, when the record carries one (the backend's `nextStatusCodes`),
 *  is authoritative: it is the static transition map with any approval
 *  checkpoint nobody is configured to approve already collapsed out, so a
 *  Draft with no approver is offered Sent directly instead of "Submit for
 *  Approval". Otherwise, with `allowedTransitions` (mirrors the backend
 *  `<doc>/transitions.go`), only the current status plus its legal next-moves
 *  are offered and a status with no legal moves is terminal. Without either,
 *  the whole catalog is offered and it is never terminal. Options always come
 *  out in catalog order. */
export function resolveStatusOptions(
  statuses: StatusOption[],
  value: string,
  allowedTransitions?: Record<string, string[]>,
  nextCodes?: string[],
): { options: StatusOption[]; isTerminal: boolean } {
  if (!nextCodes && !allowedTransitions) return { options: statuses, isTerminal: false };
  const next = nextCodes ?? allowedTransitions?.[value] ?? [];
  const options = statuses.filter((s) => s.code === value || next.includes(s.code));
  return { options, isTerminal: next.length === 0 };
}

/** Whether picking `code` would land on a status with no further legal moves
 *  out of it — i.e. this move can't be walked back via the status control
 *  afterward. Used to gate the compact 'pill' variant's two-step confirm.
 *  Without `allowedTransitions` nothing is ever terminal. */
export function isTerminalTarget(code: string, allowedTransitions?: Record<string, string[]>): boolean {
  if (!allowedTransitions) return false;
  return (allowedTransitions[code] ?? []).length === 0;
}
