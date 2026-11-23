// Customer Transactions — GET /api/tenant/crm/customer/records/{id}/transactions
// (+ /summary).
//
// Every quote, estimate, sales order, installation job, invoice, payment, credit
// memo and refund for ONE customer. The backend does all filtering, RBAC and
// paging: a record type the caller cannot read never appears, and own-scoped
// callers only see their own records.

/** One transaction on the customer's feed. */
export interface CustomerTransactionRow {
  /** Registry key, e.g. "sales_order" — the type filter's value. */
  type: string;
  /** Display name for `type`, e.g. "Sales Order". */
  typeLabel: string;
  /** Route segments for the detail page — see recordRoute(). */
  domain: string;
  module: string;
  id: string;
  number: string;
  status: string;
  /** Stable status code (e.g. "SENT"); empty when the type has no status. */
  statusCode: string;
  /** ISO yyyy-mm-dd; null when absent. */
  date: string | null;
  /** Due / valid-until / promised date, ISO yyyy-mm-dd. */
  dueDate: string | null;
  /** Null when the type carries no single monetary total. */
  amount: number | null;
  /** Invoice balance due, or a payment / credit memo's unapplied amount. */
  balance: number | null;
  isOpen: boolean;
  isOverdue: boolean;
  createdAt: string;
  updatedAt: string;
}

/** One numbered page of rows. */
export interface CustomerTransactionsPage {
  rows: CustomerTransactionRow[];
  /** Rows matching the current filters across ALL pages. */
  total: number;
  page: number;
  limit: number;
}

/** AR figures; any may be null when the caller cannot read the backing module. */
export interface CustomerTransactionSummary {
  openBalance: number | null;
  openInvoiceCount: number | null;
  overdueBalance: number | null;
  overdueInvoiceCount: number | null;
  unappliedCredits: number | null;
  billed12m: number | null;
  paid12m: number | null;
  lastActivityAt: string | null;
}

/** One status bucket within a type's count. */
export interface CustomerTransactionStatusCount {
  code: string;
  label: string;
  count: number;
}

/** Per-type totals, for the type filter and the status filter's options. */
export interface CustomerTransactionCount {
  type: string;
  count: number;
  openCount: number;
  statuses: CustomerTransactionStatusCount[];
}

/** A record type the caller may read. */
export interface CustomerTransactionType {
  type: string;
  label: string;
  domain: string;
  module: string;
}

/** The unfiltered context around the list — independent of filters and page. */
export interface CustomerTransactionsOverview {
  summary: CustomerTransactionSummary;
  counts: CustomerTransactionCount[];
  /** Empty when the caller can read none of the transaction types. */
  types: CustomerTransactionType[];
  /** True when the figures cover only the records the caller can see. */
  scopeLimited: boolean;
}

/** The filter state (mirrored in the URL); '' / false mean "no filter". */
export interface CustomerTransactionFilters {
  type: string;
  status: string;
  /** ISO yyyy-mm-dd, inclusive. */
  from: string;
  to: string;
  /** Number search. */
  q: string;
  /** Open items only. */
  open: boolean;
  /** 1-based. */
  page: number;
}

/** Query accepted by the list endpoint: the filters plus the page size. */
export interface CustomerTransactionsQuery extends Partial<CustomerTransactionFilters> {
  limit?: number;
}
