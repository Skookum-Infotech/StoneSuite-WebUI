// Chart of Accounts module — frontend contract types.
//
// Mirrors the dedicated relational backend module
// (`StoneSuite-Backend/chartofaccounts/types.go`, `tree.go`, `store_get.go`,
// `store_defaults.go`, `store_history.go`), served from
// `/api/tenant/finance/*`. Master data — a fixed category/sub-category
// reference tree, seeded + user-extensible accounts, and named
// default-account mapping slots. Holds no balances; there is no general
// ledger yet.
import type { FilterClause, SortKey } from './tenant';

// ── Account types & attributes ────────────────────────────────────────────────

/** Must stay in sync with chartofaccounts.ValidAccountTypes() (attributes.go)
 *  and chk_coa_type in database/migrations/tenant/schema.sql. */
export const ACCOUNT_TYPES = [
  'general', 'ar', 'ap', 'inventory', 'cash', 'tax', 'fixed_asset', 'bank', 'credit_card',
] as const;
export type AccountType = (typeof ACCOUNT_TYPES)[number];

export const ACCOUNT_TYPE_LABELS: Record<AccountType, string> = {
  general: 'General',
  ar: 'Accounts Receivable',
  ap: 'Accounts Payable',
  inventory: 'Inventory',
  cash: 'Cash',
  tax: 'Tax',
  fixed_asset: 'Fixed Asset',
  bank: 'Bank',
  credit_card: 'Credit Card',
};

/** "BS" | "PNL" — matches chk_coa_bs_pnl. Derived server-side for every
 *  sub-category except 9100 (see MixedSubCategoryCode below). */
export type BSPNL = 'BS' | 'PNL';

/** Sub-category 9100 (System & Control Accounts) is the only sub-category
 *  mixing balance-sheet and P&L accounts — every other sub-category derives
 *  its side automatically and bsPnl must be omitted for it (AD-2). */
export const MIXED_SUBCATEGORY_CODE = 9100;

// ── Core records ───────────────────────────────────────────────────────────────

export interface Account {
  id: string; // uuid
  code: string; // server-assigned; never sent by the client
  name: string;
  description: string;
  subCategoryId: number;
  subCategoryCode: number;
  subCategoryName: string;
  categoryCode: number;
  categoryName: string;
  parentId?: string | null;
  depth: 0 | 1;
  bsPnl: BSPNL;
  type: AccountType;
  /** Bank account numbers never arrive here — the server strips the
   *  ciphertext and returns only `accountNumberLast4`. There is no unmask
   *  affordance and no endpoint for one. */
  attributes: Record<string, string>;
  isPostable: boolean;
  isActive: boolean;
  isVisible: boolean;
  isSystem: boolean;
  recordVersion: number;
  createdAt: string;
  updatedAt: string;
}

/** Fixed top-level classification (1000 Assets ... 9000 System). Not user-editable. */
export interface Category {
  id: number;
  code: number;
  name: string;
  rangeLow: number;
  rangeHigh: number;
  normalBalance: 'debit' | 'credit';
  sortOrder: number;
}

/** Fixed second-level classification (1100 Current Assets ...). Not user-editable. */
export interface SubCategory {
  id: number;
  categoryId: number;
  categoryCode: number;
  code: number;
  name: string;
  rangeLow: number;
  rangeHigh: number;
  sortOrder: number;
}

/** A named mapping from a posting purpose to one account. */
export interface DefaultSlot {
  key: string;
  label: string;
  description: string;
  accountId?: string | null; // uuid
  accountCode?: string;
  accountName?: string;
  isSystem: boolean;
  sortOrder: number;
  updatedAt: string;
}

/** One audited change to an account or a default slot. `by` is an employee
 *  id, not a name — resolve via lookupService's employees list. Values for
 *  any field outside the store's allowlist arrive as "[redacted]" (AD-10);
 *  render "changed", never a diff, for those rows. */
export interface AccountHistoryEntry {
  id: number;
  accountId?: string | null;
  slotKey?: string;
  action: 'create' | 'update' | 'delete' | 'activate' | 'deactivate' | 'show' | 'hide' | 'repoint_slot';
  field: string;
  oldValue: string;
  newValue: string;
  at: string;
  by?: number | null;
}

// ── Grouped report tree (GET /accounts/tree) ──────────────────────────────────
// Rendered as-is — BS/PNL -> category -> sub-category -> account -> children.
// The server groups; the frontend only renders.

export interface TreeAccount extends Account {
  children: TreeAccount[];
}

export interface TreeSubCategory {
  id: number;
  code: number;
  name: string;
  accounts: TreeAccount[];
}

export interface TreeCategory {
  id: number;
  code: number;
  name: string;
  normalBalance: 'debit' | 'credit';
  subCategories: TreeSubCategory[];
}

export interface TreeSection {
  bsPnl: BSPNL;
  label: string;
  categories: TreeCategory[];
}

// ── Create / update inputs (client → server) ──────────────────────────────────

/** Code, depth and bsPnl are server-assigned; bsPnl is accepted only under
 *  sub-category 9100 (AD-2). Either subCategoryId (top-level) or parentId
 *  (child, inherits the parent's sub-category — AD-5) must be set. */
export interface AccountCreatePayload {
  name: string;
  description?: string;
  subCategoryId?: number;
  parentId?: string;
  bsPnl?: BSPNL;
  type: AccountType;
  attributes?: Record<string, string>;
  isPostable?: boolean;
}

/** Partial update. Code, sub-category and parent are immutable after create.
 *  `recordVersion` opts into optimistic concurrency — send back the version
 *  you last read; omitting it means last-write-wins with no protection. */
export interface AccountUpdatePayload {
  name?: string;
  description?: string;
  type?: AccountType;
  attributes?: Record<string, string>;
  isPostable?: boolean;
  isActive?: boolean;
  isVisible?: boolean;
  recordVersion: number;
}

/** Toggles isActive/isVisible across many accounts in one transaction.
 *  All-or-nothing: a 409 means nothing was applied. */
export interface AccountBulkPayload {
  uuids: string[];
  isActive?: boolean;
  isVisible?: boolean;
}

/** `changed` distinguishes an account the batch actually modified from one
 *  that already held the requested flags — there is no failure shape here,
 *  because the batch aborts entirely on the first blocked account. */
export interface AccountBulkResult {
  uuid: string;
  changed: boolean;
}

// ── Search / list (server-side Record Filter Engine) ──────────────────────────
// Sortable fields are limited to code / created_at / updated_at ("code" is
// this module's record_number equivalent — see resolver.go). Pagination is
// keyset: cursors are opaque, pass back only what the server returned.

export interface AccountSearchRequest {
  filters?: FilterClause[];
  sort?: SortKey[];
  search?: string;
  limit?: number;
  cursor?: string;
}

/** Query-param toggles accepted by both GET /accounts and POST /accounts/search
 *  (chartofaccounts.Filters). The dropdown call every transaction screen
 *  makes is postable=true&active=true. */
export interface AccountQueryFilters {
  postable?: boolean;
  active?: boolean;
  visible?: boolean;
  subCategoryId?: number;
}

export interface AccountPage {
  records: Account[];
  nextCursor: string;
  hasMore: boolean;
}
