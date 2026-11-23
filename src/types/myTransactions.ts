// My Transactions — GET /api/tenant/my-transactions (+ /summary).
//
// The records the signed-in user created or last updated, across every module
// they may read, newest-updated first. The backend does all filtering, RBAC and
// paging: the list endpoint returns one numbered page plus the total number of
// matching rows, and a record type the caller cannot read never appears.

/** Why a record is on the list: the caller created it, or last updated someone else's. */
export type TransactionRole = 'created' | 'updated';

/** The role filter's state; 'all' means "created or updated". */
export type TransactionRoleFilter = 'all' | TransactionRole;

/** One record on the caller's list. */
export interface TransactionRow {
  /** Registry key, e.g. "sales_order" — the type filter's value. */
  type: string;
  /** Display name for `type`, e.g. "Sales Order". */
  typeLabel: string;
  /** Route segments for the detail page — see recordRoute(). */
  domain: string;
  module: string;
  id: string;
  /** Reference: document number, sku, account code or serial. May be empty. */
  number: string;
  /** Title: customer / vendor / item / account name. Empty for plain documents. */
  name: string;
  /** The customer or vendor the record is with. Empty when the type has none. */
  account: string;
  status: string;
  /** Stable status code (e.g. "PAPV"), empty when the type has no status. */
  statusCode: string;
  /** Null when the type carries no single monetary total. */
  amount: number | null;
  role: TransactionRole;
  createdAt: string;
  updatedAt: string;
}

/** A record type the caller may read, for the type filter. */
export interface TransactionType {
  type: string;
  label: string;
  domain: string;
}

/** The stat-card counts over everything the caller may read. */
export interface TransactionSummary {
  total: number;
  created: number;
  updated: number;
  /** Touched in the last 7 days. */
  recent: number;
}

/** One numbered page of rows. */
export interface TransactionsPage {
  rows: TransactionRow[];
  /** Rows matching the current filters across ALL pages. */
  total: number;
  /** The page returned (1-based) and the page size the backend used. */
  page: number;
  limit: number;
}

/** The unfiltered context around the list — independent of filters and page. */
export interface TransactionsOverview {
  summary: TransactionSummary;
  types: TransactionType[];
}

/** Query params accepted by the list endpoint. */
export interface TransactionsQuery {
  role?: TransactionRoleFilter;
  type?: string;
  q?: string;
  /** 1-based. */
  page?: number;
  limit?: number;
}
