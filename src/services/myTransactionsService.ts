import { tenantClient } from '@/api/tenantClient';
import type {
  TransactionRow,
  TransactionSummary,
  TransactionsOverview,
  TransactionsPage,
  TransactionsQuery,
  TransactionType,
} from '@/types/myTransactions';

// GET /api/tenant/my-transactions and /summary — see types/myTransactions.ts.
// Neither has a single RBAC resource: each record type is gated by its own, so
// a user with no read access to any type gets a 403 (surfaced as the page's
// error).

interface ListWire {
  success: boolean;
  rows: TransactionRow[] | null;
  total: number;
  page: number;
  limit: number;
}

interface OverviewWire {
  success: boolean;
  summary: TransactionSummary;
  types: TransactionType[] | null;
}

/** Drops blank/default params so the request carries only real filters. */
export function toParams(query: TransactionsQuery): Record<string, string | number> {
  const params: Record<string, string | number> = {};
  if (query.role && query.role !== 'all') params.role = query.role;
  if (query.type) params.type = query.type;
  const q = query.q?.trim();
  if (q) params.q = q;
  if (query.page && query.page > 1) params.page = query.page;
  if (query.limit) params.limit = query.limit;
  return params;
}

export const myTransactionsService = {
  list: (query: TransactionsQuery): Promise<TransactionsPage> =>
    tenantClient
      .get<ListWire>('/tenant/my-transactions', { params: toParams(query) })
      .then((r) => ({
        rows: r.data.rows ?? [],
        total: r.data.total ?? 0,
        page: r.data.page ?? 1,
        limit: r.data.limit,
      })),

  overview: (): Promise<TransactionsOverview> =>
    tenantClient
      .get<OverviewWire>('/tenant/my-transactions/summary')
      .then((r) => ({
        summary: r.data.summary,
        types: r.data.types ?? [],
      })),
};
