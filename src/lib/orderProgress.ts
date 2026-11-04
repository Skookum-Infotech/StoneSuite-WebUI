export const CANCELLED_STATUS_CODE = 'CANC';

/** Statuses that leave the forward path for good. A record in one of these
 *  shows a single strip instead of the step list. */
export const OFF_PATH_STATUS_CODES: ReadonlySet<string> = new Set(['CANC', 'VOID', 'RJCT', 'EXPR', 'HOLD']);

export type ProgressStepState = 'done' | 'current' | 'upcoming';

export interface ProgressStep {
  code: string;
  label: string;
  state: ProgressStepState;
  /** ISO timestamp the record entered this step, when the audit trail has it. */
  at?: string;
  /** Who moved it into this step, when the audit trail has it. */
  actor?: string;
}

export interface StatusCatalogEntry {
  code: string;
  label: string;
}

/** Subset of the audit entry the progress card needs. */
export interface ProgressAuditEntry {
  action: string;
  actorName: string;
  newValue?: Record<string, unknown>;
  at: string;
}

const STATUS_KEY_PATTERN = /status/i;
const APPROVAL_KEY_PATTERN = /approv/i;
const CREATE_ACTION = 'create';

/** Marks every step before the current status done, the current one current,
 *  and the rest upcoming. A status outside the path (e.g. Cancelled) leaves
 *  every step upcoming. A terminal status's step reads as current rather than
 *  done, so the last dot is never an unexplained checkmark. `statusAlias` maps
 *  a side status (e.g. Overdue) onto the path step it sits on. */
export function buildProgressSteps(
  pathCodes: string[],
  catalog: StatusCatalogEntry[],
  statusCode: string,
  statusAlias: Record<string, string> = {},
): ProgressStep[] {
  const currentIdx = pathCodes.indexOf(statusAlias[statusCode] ?? statusCode);
  return pathCodes.map((code, idx) => {
    let state: ProgressStepState = 'upcoming';
    if (currentIdx >= 0) {
      if (idx < currentIdx) state = 'done';
      else if (idx === currentIdx) state = 'current';
    }
    return { code, label: catalog.find((s) => s.code === code)?.label ?? code, state };
  });
}

/** Whether an audit entry moved the record into the given step's status. */
function enteredStatus(entry: ProgressAuditEntry, step: ProgressStep): boolean {
  const value = entry.newValue;
  if (!value) return false;
  return Object.entries(value).some(
    ([key, v]) =>
      STATUS_KEY_PATTERN.test(key) &&
      !APPROVAL_KEY_PATTERN.test(key) &&
      (v === step.code || v === step.label),
  );
}

/** Stamps each reached step with when and by whom the record entered it, read
 *  from the audit trail (oldest first). The first step falls back to the
 *  record's creation entry. Steps the trail does not mention stay unstamped. */
export function attachStepHistory(steps: ProgressStep[], audit: ProgressAuditEntry[]): ProgressStep[] {
  const ordered = [...audit].sort((a, b) => a.at.localeCompare(b.at));
  return steps.map((step, idx) => {
    if (step.state === 'upcoming') return step;
    const hit =
      ordered.find((e) => enteredStatus(e, step)) ??
      (idx === 0 ? ordered.find((e) => e.action === CREATE_ACTION) : undefined);
    if (!hit) return step;
    return { ...step, at: hit.at, actor: hit.actorName || undefined };
  });
}

const DRAFT_APPROVAL = ['DRFT', 'PAPV', 'APPV'];

export type ProgressModule =
  | 'salesOrder' | 'quote' | 'estimate' | 'invoice' | 'payment' | 'refund' | 'creditMemo' | 'fabrication'
  | 'purchaseOrder' | 'requisition' | 'vendorBill' | 'itemReceipt' | 'vendorPayment' | 'vendorCredit' | 'expense';

/** The forward path each document walks. Side branches (Cancelled, Void,
 *  Rejected, Expired, On Hold) are not steps; see OFF_PATH_STATUS_CODES. */
export const PROGRESS_PATHS: Record<ProgressModule, string[]> = {
  salesOrder: [...DRAFT_APPROVAL, 'OPEN', 'PART', 'FILL'],
  quote: [...DRAFT_APPROVAL, 'SENT'],
  estimate: [...DRAFT_APPROVAL, 'SENT'],
  invoice: [...DRAFT_APPROVAL, 'SENT', 'PART', 'PAID'],
  payment: ['PEND', 'APPV', 'DEPO'],
  refund: ['PEND', 'APPV', 'SENT'],
  creditMemo: ['DRFT', 'APPV', 'APPL'],
  fabrication: ['DRFT', 'ORCV', 'MALC', 'TMPL', 'TAPV', 'FRDY', 'CUTG', 'EDGP', 'QCPD', 'QCPS', 'RSHP', 'TRAN', 'INST', 'COMP'],
  purchaseOrder: [...DRAFT_APPROVAL, 'SENT', 'PART', 'RCVD', 'CLSD'],
  requisition: DRAFT_APPROVAL,
  vendorBill: [...DRAFT_APPROVAL, 'PART', 'PAID'],
  itemReceipt: ['PEND', 'PART', 'RCVD'],
  vendorPayment: [...DRAFT_APPROVAL, 'SCHD', 'SENT'],
  vendorCredit: ['DRFT', 'APPV', 'APPL'],
  expense: ['DRFT', 'SUBM', 'APPV', 'REIM'],
};

/** Side statuses that still sit on a path step (an overdue invoice is still
 *  awaiting payment). */
export const PROGRESS_STATUS_ALIASES: Partial<Record<ProgressModule, Record<string, string>>> = {
  invoice: { ODUE: 'SENT' },
  vendorBill: { ODUE: 'APPV' },
};
