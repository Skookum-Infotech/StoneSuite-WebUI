// Status display metadata shared by the three stock documents (adjustment,
// transfer, count) — labels/colors only. Which moves are actually legal from
// a given status comes from the server's own `nextStatuses` on every GET
// (docflow.Machine().Next), never hardcoded here (spec §7-9: "render buttons
// from that rather than hardcoding the machine").
//
// Status codes are shared vocabulary across the three modules (DRFT/PAPV/
// APPV/POST/CANC), plus module-specific ones (TRNS/RCVD for transfer,
// CNTG/RVW_ for count) — see inventoryadjustment/transitions.go,
// inventorytransfer/transitions.go, inventorycount/transitions.go.

export const DOC_STATUS_LABELS: Record<string, string> = {
  DRFT: 'Draft',
  PAPV: 'Pending Approval',
  APPV: 'Approved',
  POST: 'Posted',
  CANC: 'Cancelled',
  TRNS: 'In Transit',
  RCVD: 'Received',
  CNTG: 'Counting',
  RVW_: 'In Review',
};

export const DOC_STATUS_COLORS: Record<string, string> = {
  DRFT: '#a8a29e',
  PAPV: '#f59e0b',
  APPV: '#3b82f6',
  POST: '#22c55e',
  CANC: '#ef4444',
  TRNS: '#6366f1',
  RCVD: '#22c55e',
  CNTG: '#f97316',
  RVW_: '#a855f7',
};

// Button label per (from, to) pair — a plain `to`-keyed map can't
// distinguish e.g. "Reject to Draft" (PAPV->DRFT) from "Recount" (RVW_->CNTG).
export const DOC_TRANSITION_LABELS: Record<string, string> = {
  'DRFT:PAPV': 'Submit for Approval',
  'DRFT:CANC': 'Cancel',
  'PAPV:APPV': 'Approve',
  'PAPV:DRFT': 'Reject to Draft',
  'PAPV:CANC': 'Cancel',
  'APPV:DRFT': 'Revise',
  'APPV:CANC': 'Cancel',
  'APPV:TRNS': 'Ship',
  'CNTG:RVW_': 'Send to Review',
  'CNTG:CANC': 'Cancel',
  'RVW_:APPV': 'Approve',
  'RVW_:CNTG': 'Recount',
  'RVW_:CANC': 'Cancel',
  'TRNS:RCVD': 'Receive',
  'DRFT:CNTG': 'Freeze & Start Counting',
};

export function docStatusLabel(code: string): string {
  return DOC_STATUS_LABELS[code] ?? code;
}

export function docTransitionLabel(from: string, to: string): string {
  return DOC_TRANSITION_LABELS[`${from}:${to}`] ?? `Move to ${docStatusLabel(to)}`;
}

/** The one target status every document's approval gate protects — moving
 *  INTO Approved requires the resource's separate `approve` grant, not just
 *  `transition` (spec: "whoever raises a write-off should not be whoever
 *  signs it off"). Mirrors the `body.Status == ...StatusApproved` check
 *  duplicated in inventory_adjustments.go / _transfers.go / _counts.go. */
export const APPROVAL_TARGET_STATUS = 'APPV';
