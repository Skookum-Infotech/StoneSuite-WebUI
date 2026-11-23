// Status vocabulary for Bin Transfer (BTRF): labels, colours, the progress
// stepper, and which moves a status control should offer. The legal moves come
// from the server's own `nextStatusCodes` on every read (an approval checkpoint
// nobody is configured on is already collapsed out of it); this file only decides
// how they are presented and which belong to the approvers' banner instead.

export const BT_STATUS_CODES: { code: string; label: string }[] = [
  { code: 'DRFT', label: 'Draft' },
  { code: 'PAPV', label: 'Pending Approval' },
  { code: 'APPV', label: 'Approved' },
  { code: 'COMP', label: 'Completed' },
  { code: 'CANC', label: 'Cancelled' },
];

export const BT_STATUS_COLORS: Record<string, string> = {
  DRFT: '#a8a29e',
  PAPV: '#f59e0b',
  APPV: '#3b82f6',
  COMP: '#22c55e',
  CANC: '#78716c',
};

const BT_TRANSITION_LABELS: Record<string, string> = {
  'DRFT:PAPV': 'Submit for Approval',
  'DRFT:COMP': 'Complete',
  'PAPV:APPV': 'Approve',
  'PAPV:DRFT': 'Return to Draft',
  'APPV:COMP': 'Complete',
  'APPV:DRFT': 'Revise',
};

/** Cancelling reads the same from every status. */
const CANCEL_LABEL = 'Cancel Transfer';

export function btStatusLabel(code: string): string {
  return BT_STATUS_CODES.find((s) => s.code === code)?.label ?? code;
}

export function btTransitionLabel(from: string, to: string): string {
  if (to === 'CANC') return CANCEL_LABEL;
  return BT_TRANSITION_LABELS[`${from}:${to}`] ?? `Move to ${btStatusLabel(to)}`;
}

/** Approval freezes the document: the moves that were signed off are the ones
 *  applied, so only a draft can be edited. */
export function btIsEditable(code: string): boolean {
  return code === 'DRFT';
}

// ── Progress stepper ────────────────────────────────────────────────────────

export type BtStepState = 'done' | 'current' | 'upcoming';

export interface BtStep {
  code: string;
  label: string;
  state: BtStepState;
}

export interface BtProgress {
  steps: BtStep[];
  /** A cancelled transfer is stopped, not part-way along the steps. */
  cancelled: boolean;
}

const STEP_ORDER = ['DRFT', 'PAPV', 'APPV', 'COMP'];

export function btProgress(statusCode: string): BtProgress {
  const cancelled = statusCode === 'CANC';
  const at = STEP_ORDER.indexOf(statusCode);
  const steps = STEP_ORDER.map((code, i): BtStep => {
    let state: BtStepState = 'upcoming';
    if (!cancelled && at >= 0) {
      // Completed is the end of the line: every step, itself included, is done.
      if (statusCode === 'COMP' || i < at) state = 'done';
      else if (i === at) state = 'current';
    }
    return { code, label: btStatusLabel(code), state };
  });
  return { steps, cancelled };
}

// ── Actions ─────────────────────────────────────────────────────────────────

export type BtActionKind = 'primary' | 'secondary' | 'danger';

export interface BtAction {
  to: string;
  label: string;
  kind: BtActionKind;
  /** The RBAC action this move needs: a move onto Approved rides `approve`,
   *  every other rides `transition`. */
  permission: 'transition' | 'approve';
}

function actionFor(from: string, to: string): BtAction {
  const kind: BtActionKind = to === 'CANC' ? 'danger' : to === 'DRFT' ? 'secondary' : 'primary';
  return {
    to,
    label: btTransitionLabel(from, to),
    kind,
    permission: to === 'APPV' ? 'approve' : 'transition',
  };
}

const KIND_ORDER: Record<BtActionKind, number> = { primary: 0, secondary: 1, danger: 2 };

/**
 * The buttons a status control should show, in order: the move forward first,
 * then the way back, then Cancel.
 *
 * While a transfer is gated (approvers configured and not yet satisfied) Approve
 * and Return to Draft are not offered here: signing off and sending back are the
 * approvers' own controls (the approval banner), and the server refuses both
 * when done by hand.
 */
export function btActions(statusCode: string, nextStatusCodes: string[], gated: boolean): BtAction[] {
  return nextStatusCodes
    .filter((to) => !(gated && statusCode === 'PAPV' && (to === 'APPV' || to === 'DRFT')))
    .map((to) => actionFor(statusCode, to))
    .sort((a, b) => KIND_ORDER[a.kind] - KIND_ORDER[b.kind]);
}
