// Expense module — frontend contract types.
//
// Mirrors the dedicated relational Expense backend module
// (`StoneSuite-Backend/expense/*.go`). An expense claim is an employee
// self-service reimbursement request: a header (department/memo/total) plus
// one or more dated, categorized line items (one receipt each), submitted for
// a configuration-driven approval before Finance marks it reimbursed. A
// sibling of Requisition — not the generic v1 JSONB CRM router — served from
// `/api/tenant/expenses*`.
//
// Structurally simpler than Requisition (spec AD-3): no vendor, no tax, no
// priority. The claimant defaults to the acting employee (spec AD-2); sending
// `claimantEmployeeId` files the claim for another Active employee instead.
// Approving a claim raises a Vendor Bill from it; the claim becomes Paid when
// that bill is paid.
import type { FilterClause, RecordApprover, SortKey } from '@/types/tenant';

// ── Create / update inputs (client → server) ─────────────────────────────────

/** One expense line: a single dated, categorized, described amount —
 *  typically backed by one receipt, attached separately via the generic
 *  attachments API. Unlike a requisition line there is no quantity or unit
 *  price — `amount` is entered directly. */
export interface ExpenseLineInput {
  lineNumber: number;
  categoryCode: string;
  expenseDate: string; // "yyyy-mm-dd"
  amount: number;
  description?: string;
}

export interface ExpenseCreatePayload {
  /** The employee the claim is for; omitted = the caller. Must be Active. */
  claimantEmployeeId?: number;
  department?: string;
  memo?: string;
  customFields?: Record<string, unknown>;
  items: ExpenseLineInput[];
}

/** Update takes the same shape as create. Allowed only while DRFT
 *  (expense/store_update.go) — recall to draft to revise once submitted. */
export type ExpenseUpdatePayload = ExpenseCreatePayload;

// ── Responses (server → client) ──────────────────────────────────────────────

/** `lkp_record_status` codes seeded for the EXPN record type. RJCT is only
 *  reachable via the dedicated Reject endpoint, never the generic transition
 *  map (spec AD-5). */
export type ExpenseStatusCode = 'DRFT' | 'SUBM' | 'APPV' | 'RJCT' | 'PAID';

/** The vendor bill an approved claim raised (GET /api/tenant/expenses/{id}). */
export interface ExpenseBillRef {
  id: string;
  number: string;
  statusCode: string;
  status: string;
}

/** An approved claim still waiting for a vendor bill (GET /api/tenant/expenses/billable) —
 *  what the Vendor Bill form's expense picker lists for an employee vendor. */
export interface ExpenseBillableClaim {
  id: string;
  expenseNumber: string;
  claimantName: string;
  total: number;
  memo?: string;
}

/** An Active employee a claim can be filed for (GET /api/tenant/expenses/claimants). */
export interface ExpenseClaimant {
  id: number;
  code: string; // the employee's email
  name: string;
}

/** A response line carries the resolved category snapshot, not just the code
 *  submitted at save time. */
export interface ExpenseLine {
  id: string;
  lineNumber: number;
  categoryId: number;
  categoryCode: string;
  categoryName: string;
  expenseDate: string;
  amount: number;
  description: string;
}

/** Full detail response (GET/Create/Update/Transition/Approve/Reject). Every
 *  field the create/update contract accepts round-trips back here so the Edit
 *  page can reload a claim and re-save it without blanking a header field. */
export interface Expense {
  id: string;
  expenseNumber: string;
  status: string;              // human label, e.g. "Draft"
  statusCode: ExpenseStatusCode; // drives the transition button map
  approvalStatus: 'none' | 'pending' | 'approved';
  nextStatusCodes?: string[]; // legal next-moves right now, with an approval checkpoint nobody is configured to approve collapsed out (the status control's option list)
  gated: boolean;
  approvers: RecordApprover[];
  requiredApprovals: number;
  approvedCount: number;
  canApprove: boolean;
  isOverride: boolean;
  callerAlreadyApproved: boolean;

  claimantEmployeeId: number;
  claimantName?: string;
  /** Set once the claim is approved: the bill that pays it. */
  vendorBill?: ExpenseBillRef;
  department: string;
  memo?: string;

  approvedByEmployeeId?: number;
  rejectedByEmployeeId?: number;
  rejectionReason?: string;

  customFields?: Record<string, unknown>;

  total: number;

  createdAt?: string;
  updatedAt?: string;
  items: ExpenseLine[];
}

/** List/search rows are full `Expense` records server-side with `items`
 *  omitted (search selects header columns only, to avoid an N+1 line join) —
 *  this type names the subset the table actually renders. */
export type ExpenseSummary = Pick<
  Expense,
  | 'id' | 'expenseNumber' | 'status' | 'statusCode' | 'approvalStatus' | 'nextStatusCodes'
  | 'claimantEmployeeId' | 'claimantName' | 'department' | 'total' | 'createdAt' | 'updatedAt'
>;

/** Search request = the shared `query.Request` plus the optional global-search
 *  term the expense resolver supports (document number, department, memo, and
 *  line description). */
export interface ExpenseSearchRequest {
  filters?: FilterClause[];
  sort?: SortKey[];
  limit?: number;
  cursor?: string;
  search?: string;
}

export interface ExpensePage {
  records: ExpenseSummary[];
  nextCursor: string;
  hasMore: boolean;
  scope: string;
}

/** An active `lkp_expense_category` row — the line item category picker's
 *  options (GET /api/tenant/expenses/categories). */
export interface ExpenseCategory {
  id: number;
  code: string;
  name: string;
}
