import { tenantClient } from '@/api/tenantClient';
import type {
  CustomerTransactionCount,
  CustomerTransactionRow,
  CustomerTransactionSummary,
  CustomerTransactionType,
  CustomerTransactionsOverview,
  CustomerTransactionsPage,
  CustomerTransactionsQuery,
} from '@/types/customerTransactions';

// GET /api/tenant/crm/customer/records/{id}/transactions and /summary — see
// types/customerTransactions.ts. Gated by customer:read plus each type's own
// read grant; a customer the caller cannot open answers 404 either way.

interface ListWire {
  success: boolean;
  rows: CustomerTransactionRow[] | null;
  total: number;
  page: number;
  limit: number;
}

interface OverviewWire {
  success: boolean;
  scopeLimited: boolean;
  summary: CustomerTransactionSummary;
  counts: CustomerTransactionCount[] | null;
  types: CustomerTransactionType[] | null;
}

const basePath = (customerId: string): string =>
  `/tenant/crm/customer/records/${encodeURIComponent(customerId)}/transactions`;

/** Drops blank/default params so the request carries only real filters. */
export function toParams(query: CustomerTransactionsQuery): Record<string, string | number> {
  const params: Record<string, string | number> = {};
  if (query.type) params.type = query.type;
  if (query.status) params.status = query.status;
  if (query.from) params.from = query.from;
  if (query.to) params.to = query.to;
  const q = query.q?.trim();
  if (q) params.q = q;
  if (query.open) params.open = 'true';
  if (query.page && query.page > 1) params.page = query.page;
  if (query.limit) params.limit = query.limit;
  return params;
}

export const customerTransactionsService = {
  list: (customerId: string, query: CustomerTransactionsQuery): Promise<CustomerTransactionsPage> =>
    tenantClient
      .get<ListWire>(basePath(customerId), { params: toParams(query) })
      .then((r) => ({
        rows: r.data.rows ?? [],
        total: r.data.total ?? 0,
        page: r.data.page ?? 1,
        limit: r.data.limit,
      })),

  summary: (customerId: string): Promise<CustomerTransactionsOverview> =>
    tenantClient
      .get<OverviewWire>(`${basePath(customerId)}/summary`)
      .then((r) => ({
        summary: r.data.summary,
        counts: r.data.counts ?? [],
        types: r.data.types ?? [],
        scopeLimited: r.data.scopeLimited ?? false,
      })),
};
