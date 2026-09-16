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

/** "BS" | "PNL" — matches chk_coa_bs_pnl. Derived server-side from the
 *  account's category, except under a MIXED one (see CategorySide). */
export type BSPNL = 'BS' | 'PNL';

/** The side a category declares. 'MIXED' means its accounts each carry their
 *  own — 9000 System & Control is the only seeded one, holding both
 *  balance-sheet (9101, 9102) and P&L (9103–9107) accounts (AD-2). A create
 *  under a MIXED category must supply `bsPnl`; anywhere else it is ignored. */
export type CategorySide = BSPNL | 'MIXED';
export const MIXED_SIDE = 'MIXED';

/** matches chk_coa_category_balance. */
export const NORMAL_BALANCES = ['debit', 'credit'] as const;
export type NormalBalance = (typeof NORMAL_BALANCES)[number];

// ── Core records ───────────────────────────────────────────────────────────────

export interface Account {
  id: string; // uuid
  code: string; // server-assigned; never sent by the client
  name: string;
  description: string;
  /** An account is placed under EITHER a sub-category or a category directly
   *  (chk_coa_placement server-side). The three subCategory* fields are absent
   *  for a category-placed account; category* is always present. */
  subCategoryId?: number;
  subCategoryCode?: number;
  subCategoryName?: string;
  categoryId: number;
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

/** Top-level classification (1000 Assets ... 9000 System). Nine are seeded;
 *  tenants may rename any of them and append their own. Code, range, side and
 *  normal balance are server-assigned and immutable after create — re-coding a
 *  category would strand every account code already allocated in its range. */
export interface Category {
  id: number;
  code: number;
  name: string;
  rangeLow: number;
  rangeHigh: number;
  normalBalance: NormalBalance;
  bsPnl: CategorySide;
  sortOrder: number;
}

/** Second-level classification (1100 Current Assets ...). Seventeen are seeded;
 *  same rename-only rule as Category. Inherits its category's side. */
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
  normalBalance: NormalBalance;
  /** Accounts placed directly on the category, rendered above its
   *  sub-categories. Empty for every seeded category until a tenant adds one. */
  accounts: TreeAccount[];
  subCategories: TreeSubCategory[];
}

export interface TreeSection {
  bsPnl: BSPNL;
  label: string;
  categories: TreeCategory[];
}

// ── Create / update inputs (client → server) ──────────────────────────────────

/** Code, depth and bsPnl are server-assigned; bsPnl is accepted only under a
 *  MIXED category (AD-2). Placement is exactly one of subCategoryId (under a
 *  sub-category), categoryId (directly under a category), or parentId (a
 *  sub-account, which inherits its parent's placement — AD-5). */
export interface AccountCreatePayload {
  name: string;
  description?: string;
  subCategoryId?: number;
  categoryId?: number;
  parentId?: string;
  bsPnl?: BSPNL;
  type: AccountType;
  attributes?: Record<string, string>;
  isPostable?: boolean;
}

/** Appends a category. Code, range and sort order are server-assigned.
 *  `normalBalance` is asked for rather than derived because the side does not
 *  imply it — 1000 Assets and 6000 Operating Expenses are both debit. */
export interface CategoryCreatePayload {
  name: string;
  bsPnl: CategorySide;
  normalBalance: NormalBalance;
}

/** Appends a sub-category under an existing category. Its code and range come
 *  from the parent's free blocks; its side is inherited. */
export interface SubCategoryCreatePayload {
  categoryId: number;
  name: string;
}

/** Renames a category or a sub-category — the only mutable field on either. */
export interface TaxonomyRenamePayload {
  name: string;
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
