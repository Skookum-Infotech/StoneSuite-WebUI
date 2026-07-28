import { tenantClient } from '@/api/tenantClient';
import type {
  Account, AccountCreatePayload, AccountUpdatePayload, AccountBulkPayload, AccountBulkResult,
  AccountSearchRequest, AccountQueryFilters, AccountPage, AccountHistoryEntry,
  Category, SubCategory, DefaultSlot, TreeSection,
} from '@/types/chartOfAccounts';

// Chart of Accounts module API wrapper. Talks to the dedicated relational
// module under `/api/tenant/finance/*` — mirrors vendorService.ts /
// itemReceiptService.ts. Every call carries the tenant Bearer JWT via
// `tenantClient`; the server enforces tenancy, RBAC (`chart_of_account:*`),
// and (for account-defaults) the separate `chart_of_account:configure` grant.
const BASE = '/tenant/finance';

function toPage(data: { records?: Account[] | null; nextCursor?: string; hasMore?: boolean }): AccountPage {
  return {
    records: data.records ?? [],
    nextCursor: data.nextCursor ?? '',
    hasMore: Boolean(data.hasMore),
  };
}

export const chartOfAccountsService = {
  // GET /accounts — cursor-paginated, filtered by query-param toggles only
  // (no filter/sort body). The dropdown call every transaction screen makes
  // is { postable: true, active: true }.
  listAccounts: (
    filters: AccountQueryFilters & { search?: string; limit?: number; cursor?: string } = {},
  ): Promise<AccountPage> =>
    tenantClient
      .get<{ success: boolean; records: Account[] | null; nextCursor: string; hasMore: boolean }>(
        `${BASE}/accounts`,
        { params: filters },
      )
      .then((r) => toPage(r.data)),

  // POST /accounts/search — full filter + sort + global search + keyset
  // pagination. Cursors are opaque — pass back what the server returned,
  // never construct one. The query-param toggles (postable/active/visible/
  // subCategoryId) are ANDed server-side with the filters in the body, so
  // they ride alongside it here rather than inside AccountSearchRequest.
  searchAccounts: (req: AccountSearchRequest, filters: AccountQueryFilters = {}): Promise<AccountPage> =>
    tenantClient
      .post<{ success: boolean; records: Account[] | null; nextCursor: string; hasMore: boolean }>(
        `${BASE}/accounts/search`,
        req,
        { params: filters },
      )
      .then((r) => toPage(r.data)),

  // GET /accounts/tree — the whole chart, grouped BS/PNL -> category ->
  // sub-category -> account -> children. Not paginated: render, don't group.
  getTree: (opts: { includeInactive?: boolean; includeHidden?: boolean } = {}): Promise<TreeSection[]> =>
    tenantClient
      .get<{ success: boolean; sections: TreeSection[] | null }>(`${BASE}/accounts/tree`, { params: opts })
      .then((r) => r.data.sections ?? []),

  // GET /accounts/categories — the fixed 9-category / 17-sub-category
  // reference tree. Read-only; never user-editable.
  getCategories: (): Promise<{ categories: Category[]; subCategories: SubCategory[] }> =>
    tenantClient
      .get<{ success: boolean; categories: Category[] | null; subCategories: SubCategory[] | null }>(
        `${BASE}/accounts/categories`,
      )
      .then((r) => ({ categories: r.data.categories ?? [], subCategories: r.data.subCategories ?? [] })),

  createAccount: (payload: AccountCreatePayload): Promise<Account> =>
    tenantClient
      .post<{ success: boolean; account: Account }>(`${BASE}/accounts`, payload)
      .then((r) => r.data.account),

  getAccount: (uuid: string): Promise<Account> =>
    tenantClient
      .get<{ success: boolean; account: Account }>(`${BASE}/accounts/${uuid}`)
      .then((r) => r.data.account),

  // Always send `recordVersion` (the version last read) to opt into
  // optimistic concurrency — a 409 here means the account was changed by
  // someone else; reload rather than retry.
  updateAccount: (uuid: string, payload: AccountUpdatePayload): Promise<Account> =>
    tenantClient
      .patch<{ success: boolean; account: Account }>(`${BASE}/accounts/${uuid}`, payload)
      .then((r) => r.data.account),

  // Soft delete. isSystem accounts 409 — the UI must hide the delete
  // affordance for those rather than let the request fail.
  deleteAccount: (uuid: string): Promise<void> =>
    tenantClient.delete(`${BASE}/accounts/${uuid}`).then(() => undefined),

  // PATCH /accounts/bulk — one transaction, all-or-nothing. A blocked account
  // 409s the whole batch (with blockingSlots when applicable); there is no
  // partial-success shape to render.
  bulkUpdate: (payload: AccountBulkPayload): Promise<AccountBulkResult[]> =>
    tenantClient
      .patch<{ success: boolean; results: AccountBulkResult[] | null }>(`${BASE}/accounts/bulk`, payload)
      .then((r) => r.data.results ?? []),

  // GET /accounts/{uuid}/history — newest first. Bank account numbers never
  // appear here; redacted fields arrive as "[redacted]" old/new values.
  getHistory: (uuid: string, limit?: number): Promise<AccountHistoryEntry[]> =>
    tenantClient
      .get<{ success: boolean; history: AccountHistoryEntry[] | null }>(`${BASE}/accounts/${uuid}/history`, {
        params: limit ? { limit } : undefined,
      })
      .then((r) => r.data.history ?? []),

  getDefaults: (): Promise<DefaultSlot[]> =>
    tenantClient
      .get<{ success: boolean; slots: DefaultSlot[] | null }>(`${BASE}/account-defaults`)
      .then((r) => r.data.slots ?? []),

  // Guarded by chart_of_account:configure, not :update. An empty accountId
  // clears the slot. A 409 here means the target is a header (non-postable)
  // or inactive account.
  repointDefault: (slotKey: string, accountId: string): Promise<DefaultSlot> =>
    tenantClient
      .patch<{ success: boolean; slot: DefaultSlot }>(`${BASE}/account-defaults/${slotKey}`, { accountId })
      .then((r) => r.data.slot),
};
