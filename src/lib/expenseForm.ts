// Expense form field definitions — mirrors requisitionForm.ts's shape,
// adapted to the Expense backend contract (types/expense.ts).
// Field keys are UI-facing (mapped to the create/update payload via
// toCreatePayload, not sent to the backend verbatim).
//
// Deliberately simpler than requisitionForm: no vendor, no tax, no priority
// (spec AD-3 — a reimbursement claim isn't a priced commitment against a
// counterparty), and the claimant is never a form field at all (spec AD-2 —
// always the acting employee, resolved server-side).

import type { FieldDefinition } from '@/types/tenant';
import type {
  Expense, ExpenseCreatePayload, ExpenseLineInput, ExpenseLine, ExpenseCategory,
} from '@/types/expense';

export const PAGE_TABS = [
  { key: 'details', label: 'Details' },
  { key: 'audit', label: 'Audit' },
  { key: 'files', label: 'Files' },
] as const;
export type PageTab = (typeof PAGE_TABS)[number]['key'];

export interface ExpenseFormField {
  key: string;
  label: string;
  type: 'text' | 'textarea' | 'select' | 'number' | 'date' | 'readonly';
  required?: boolean;
  options?: string[];
  placeholder?: string;
  /** Span all grid columns */
  colSpanFull?: boolean;
  /** Textarea row count (only used when type === 'textarea') */
  rows?: number;
  /** Small helper line rendered under the field */
  hint?: string;
}

// ── Form section field definitions ───────────────────────────────────────────

export const PRIMARY_INFO_FIELDS: ExpenseFormField[] = [
  {
    key: 'exp_status',
    label: 'Expense Status',
    type: 'readonly',
    placeholder: 'Draft',
  },
  {
    key: 'exp_doc_num',
    label: 'Expense #',
    type: 'readonly',
    placeholder: 'Auto-generated',
  },
  {
    key: 'department',
    label: 'Department',
    type: 'text',
    placeholder: 'e.g. Sales',
  },
  {
    key: 'memo',
    label: 'Memo',
    type: 'textarea',
    placeholder: 'What is this claim for…',
    colSpanFull: true,
  },
];

// ── Items grid ────────────────────────────────────────────────────────────────

/** One editable line row. A line is a category pick + date + description +
 *  amount — unlike a requisition line there is no quantity/unit-price/
 *  catalog item; `amount` is a direct entry (expense/calc.go's
 *  ComputeHeaderTotal is a plain sum of line amounts, not qty×price). */
export interface ExpenseLineItem {
  id: string;
  lineNo: number;
  categoryCode: string;
  categoryName: string;
  expenseDate: string;
  amount: string;
  description: string;
}

export const EMPTY_LINE_ITEM: Omit<ExpenseLineItem, 'id' | 'lineNo'> = {
  categoryCode: '',
  categoryName: '',
  expenseDate: '',
  amount: '',
  description: '',
};

/** Rounds to 2 decimal places — mirrors the backend's `round2`
 *  (expense/calc.go), so the client-side preview matches the server's total. */
export function round2(x: number): number {
  return Math.round(x * 100) / 100;
}

/** Client-side preview of the header total, replicating the backend's
 *  `ComputeHeaderTotal` exactly: round2(sum of line amounts). Server totals
 *  stay authoritative; this only drives the live preview. */
export function calcHeaderTotal(
  lineItems: Pick<ExpenseLineItem, 'amount'>[],
): number {
  let total = 0;
  for (const item of lineItems) {
    total += parseFloat(item.amount) || 0;
  }
  return round2(total);
}

// ── Status catalog (backend expense/transitions.go) ──────────────────────────

/** Every `lkp_record_status` row seeded for the EXPN record type. */
export const EXPENSE_STATUS_CODES: { code: string; label: string }[] = [
  { code: 'DRFT', label: 'Draft' },
  { code: 'SUBM', label: 'Submitted' },
  { code: 'APPV', label: 'Approved' },
  { code: 'RJCT', label: 'Rejected' },
  { code: 'REIM', label: 'Reimbursed' },
];

/** Legal next-moves per status via the generic transition endpoint — mirrors
 *  the backend expense/transitions.go `allowedTransitions` map exactly.
 *  `SUBM` deliberately excludes `RJCT`: rejection is only reachable through
 *  the dedicated Reject action (spec AD-5), which always captures a reason
 *  and never requires quorum — a generic `POST .../transition {toStatusCode:
 *  "RJCT"}` 409s server-side. The terminal status (REIM) maps to an empty
 *  list. The backend (ValidateTransition) stays authoritative; an illegal
 *  pick is rejected with 409, so this only keeps the UI from offering one. */
export const EXPENSE_ALLOWED_TRANSITIONS: Record<string, string[]> = {
  DRFT: ['SUBM'],
  SUBM: ['APPV', 'DRFT'],
  APPV: ['REIM'],
  RJCT: ['DRFT'],
  REIM: [],
};

/** Button label per (from, to) status-code pair — a plain `to`-keyed map
 *  can't distinguish "Recall to Draft" (SUBM→DRFT) from "Revise" (RJCT→DRFT),
 *  so the key is `${from}:${to}`. */
export const EXPENSE_TRANSITION_LABELS: Record<string, string> = {
  'DRFT:SUBM': 'Submit for Approval',
  'SUBM:APPV': 'Approve & Advance',
  'SUBM:DRFT': 'Recall to Draft',
  'APPV:REIM': 'Mark Reimbursed',
  'RJCT:DRFT': 'Revise',
};

export function expTransitionLabel(from: string, to: string): string {
  return EXPENSE_TRANSITION_LABELS[`${from}:${to}`] ?? to;
}

/** Human label for a status code (e.g. "SUBM" -> "Submitted") — used by the
 *  transition confirmation dialog. Falls back to the raw code for an
 *  unrecognized one rather than throwing. */
export function expStatusLabel(code: string): string {
  return EXPENSE_STATUS_CODES.find((s) => s.code === code)?.label ?? code;
}

/** Approval gate (expense/store_transition.go): once a status has configured
 *  approvers, every move away from it is blocked until `approvalStatus`
 *  reaches "approved" — except the recall back to DRFT, which is always
 *  allowed, since it is how a submitter withdraws a pending claim for rework
 *  without an approver's sign-off. */
export function isExpTransitionBlocked(toCode: string, approvalStatus: string, gated?: boolean): boolean {
  return toCode !== 'DRFT' && (gated ?? approvalStatus === 'pending');
}

/** Status badge color, shared by the list table, detail page, and transition
 *  bar. Keyed by status code (EXPN statuses are fixed/seeded). */
export const EXPENSE_STATUS_COLORS: Record<string, string> = {
  DRFT: '#a8a29e',
  SUBM: '#f59e0b',
  APPV: '#22c55e',
  RJCT: '#ef4444',
  REIM: '#3b82f6',
};

/** Statuses `expenseService.updateExpense` rejects edits against
 *  (expense/store_update.go — editing is DRFT-only; recall to draft to
 *  revise, since a submitted claim is awaiting someone's sign-off). */
export const EXPENSE_NON_DRAFT_LOCKED = (statusCode: string): boolean => statusCode !== 'DRFT';

/** Statuses from which Delete is offered (expense/store_update.go — delete is
 *  DRFT only, unlike Requisition which also allows its cancelled state). */
export const EXPENSE_DELETABLE_STATUSES = new Set(['DRFT']);

/** Whether the dedicated Reject action should be offered alongside the
 *  transition bar (spec AD-5) — only a submitted claim can be rejected, and
 *  only through `POST .../reject`, never the generic transition map. */
export function canRejectExpense(statusCode: string): boolean {
  return statusCode === 'SUBM';
}

// ── Form defaults ─────────────────────────────────────────────────────────────

export function expenseDefaults(): Record<string, unknown> {
  return {
    exp_status: 'Draft',
  };
}

// ── Payload mapping (UI form state -> backend create contract) ───────────────

function toStr(v: unknown): string {
  return v === null || v === undefined ? '' : String(v);
}

/** Maps one editable line row to the create/update contract's line shape. */
function toLineInput(item: ExpenseLineItem, lineNo: number): ExpenseLineInput {
  return {
    lineNumber: lineNo,
    categoryCode: item.categoryCode,
    expenseDate: item.expenseDate,
    amount: parseFloat(item.amount) || 0,
    description: item.description.trim() || undefined,
  };
}

/** Maps the Add/Edit page form state + line items to the backend's
 *  `ExpenseCreatePayload`. Status is intentionally omitted: every new claim
 *  starts at DRFT server-side; status changes go through the `/transition`,
 *  `/approve`, and `/reject` endpoints. There is no claimant field to map —
 *  the server always resolves it from the caller (AD-2). */
export function toCreatePayload(
  data: Record<string, unknown>,
  lineItems: ExpenseLineItem[],
  customFields: Record<string, unknown> = {},
): ExpenseCreatePayload {
  return {
    department: toStr(data.department),
    memo: toStr(data.memo),
    customFields,
    items: lineItems.map((item, i) => toLineInput(item, i + 1)),
  };
}

function fromLine(line: ExpenseLine, i: number): ExpenseLineItem {
  return {
    id: `existing-${i}`,
    lineNo: line.lineNumber,
    categoryCode: line.categoryCode,
    categoryName: line.categoryName,
    expenseDate: line.expenseDate,
    amount: String(line.amount),
    description: line.description ?? '',
  };
}

/** Maps a loaded Expense (GET response) back to the Edit form's state — the
 *  inverse of toCreatePayload. */
export function fromExpense(exp: Expense): {
  data: Record<string, unknown>;
  lineItems: ExpenseLineItem[];
  customFieldValues: Record<string, unknown>;
} {
  const data: Record<string, unknown> = {
    exp_status: exp.status,
    exp_doc_num: exp.expenseNumber,
    department: exp.department ?? '',
    memo: exp.memo ?? '',
  };

  const lineItems: ExpenseLineItem[] = exp.items.map(fromLine);

  return {
    data,
    lineItems,
    customFieldValues: exp.customFields ?? {},
  };
}

// ── Category lookup ──────────────────────────────────────────────────────────

/** Resolves a category code to its display name from the loaded category
 *  list — used to keep a line row's `categoryName` in sync when the user
 *  picks a different category code. */
export function categoryNameForCode(categories: ExpenseCategory[], code: string): string {
  return categories.find((c) => c.code === code)?.name ?? '';
}

// ── Validation ────────────────────────────────────────────────────────────────

/** A line is valid when it carries a category, a date, and a non-negative
 *  amount — mirrors the backend's resolveLines rules (expense/store_create.go).
 *  Returns the 1-based positions of the invalid rows so the caller can name
 *  them in an error message. */
export function invalidLinePositions(lineItems: ExpenseLineItem[]): number[] {
  const bad: number[] = [];
  lineItems.forEach((item, i) => {
    const hasCategory = item.categoryCode.trim() !== '';
    const hasDate = item.expenseDate.trim() !== '';
    const amount = parseFloat(item.amount);
    const hasValidAmount = Number.isFinite(amount) && amount >= 0;
    if (!hasCategory || !hasDate || !hasValidAmount) bad.push(i + 1);
  });
  return bad;
}

/** Required-field check for the expense workflow's custom field definitions
 *  (rendered via DynamicFieldInput) — mirrors validateRequisitionCustomFields. */
export function validateExpenseCustomFields(
  defs: FieldDefinition[],
  values: Record<string, unknown>,
): { key: string; label: string }[] {
  const errors: { key: string; label: string }[] = [];
  for (const def of defs) {
    if (!def.required) continue;
    const val = values[def.key];
    if (val === undefined || val === null || val === '') {
      errors.push({ key: def.key, label: def.label });
    }
  }
  return errors;
}
