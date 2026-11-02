// Vendor Transactions — GET /api/tenant/vendors/{uuid}/transactions (+ /summary).
//
// Every requisition, purchase order, item receipt, vendor bill, vendor payment
// and vendor credit for ONE vendor, newest first. The backend does all
// filtering, RBAC and paging: a record type the caller cannot read never
// appears, and own-scoped callers only see their own records. Paging is keyset
// (an opaque `nextCursor`), so there is no total.

/** One transaction on the vendor's feed. */
export interface VendorTransactionRow {
  /** Registry key, e.g. "vendor_bill" — the type filter's value. */
  type: string;
  /** Display name for `type`, e.g. "Vendor Bill". */
  typeLabel: string;
  /** Route segments for the detail page — see recordRoute(). */
  domain: string;
  module: string;
  id: string;
  number: string;
  status: string;
  /** Stable status code (e.g. "APPV"); empty when the type has no status. */
  statusCode: string;
  /** ISO yyyy-mm-dd. */
  date: string;
  /** Due / expected / needed-by date, ISO yyyy-mm-dd; null when absent. */
  dueDate: string | null;
  /** Null when the type carries no single monetary total. */
  amount: number | null;
  /** Bill balance due, or a payment / credit's unapplied amount. */
  balance: number | null;
  isOpen: boolean;
  isOverdue: boolean;
  createdAt: string;
  updatedAt: string;
}

/** One keyset page of rows; `nextCursor` is '' on the last page. */
export interface VendorTransactionsPage {
  rows: VendorTransactionRow[];
  nextCursor: string;
  limit: number;
}

/** AP figures; any may be null when the caller cannot read the backing module. */
export interface VendorTransactionSummary {
  openBalance: number | null;
  openBillCount: number | null;
  overdueAmount: number | null;
  overdueBillCount: number | null;
  unappliedCredits: number | null;
  paid12m: number | null;
  lastActivityAt: string | null;
}

/** One status bucket within a type's count. */
export interface VendorTransactionStatusCount {
  code: string;
  label: string;
  count: number;
}

/** Per-type totals, for the type badges and the status filter's options. */
export interface VendorTransactionCount {
  type: string;
  count: number;
  openCount: number;
  statuses: VendorTransactionStatusCount[];
}

/** A record type the caller may read. */
export interface VendorTransactionType {
  type: string;
  label: string;
  domain: string;
  module: string;
}

/** The unfiltered context around the list — independent of filters and page. */
export interface VendorTransactionsOverview {
  summary: VendorTransactionSummary;
  counts: VendorTransactionCount[];
  /** Empty when the caller can read none of the transaction types. */
  types: VendorTransactionType[];
  /** True when the figures cover only the records the caller can see. */
  scopeLimited: boolean;
}

/** The filter state (mirrored in the URL); '' / false mean "no filter". */
export interface VendorTransactionFilters {
  type: string;
  status: string;
  /** ISO yyyy-mm-dd, inclusive. */
  from: string;
  to: string;
  /** Number search. */
  q: string;
  /** Open items only. */
  open: boolean;
  /** Opaque keyset cursor the server returned; '' is the first page. */
  cursor: string;
}

/** Query accepted by the list endpoint: the filters plus the page size. */
export interface VendorTransactionsQuery extends Partial<VendorTransactionFilters> {
  limit?: number;
}
