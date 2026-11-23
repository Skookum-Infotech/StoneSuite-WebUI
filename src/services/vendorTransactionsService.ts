import { AxiosError } from 'axios';
import { tenantClient } from '@/api/tenantClient';
import type {
  VendorAging,
  VendorAgingBucket,
  VendorTransactionCount,
  VendorTransactionRow,
  VendorTransactionSummary,
  VendorTransactionType,
  VendorTransactionsOverview,
  VendorTransactionsPage,
  VendorTransactionsQuery,
} from '@/types/vendorTransactions';

// GET /api/tenant/vendors/{uuid}/transactions and /summary — see
// types/vendorTransactions.ts. Gated by vendor:read plus each type's own read
// grant; a vendor the caller cannot open answers 404 either way.

interface ListWire {
  success: boolean;
  rows: VendorTransactionRow[] | null;
  nextCursor: string | null;
  limit: number;
}

interface OverviewWire {
  success: boolean;
  scopeLimited: boolean;
  summary: VendorTransactionSummary;
  counts: VendorTransactionCount[] | null;
  types: VendorTransactionType[] | null;
}

interface AgingWire {
  success: boolean;
  scopeLimited: boolean;
  buckets: VendorAgingBucket[] | null;
  total: number;
}

const basePath = (vendorId: string): string =>
  `/tenant/vendors/${encodeURIComponent(vendorId)}/transactions`;

/**
 * A blob download's error body arrives as a Blob too, which would hide the
 * backend's message (413 "narrow the filters", 429 "wait a moment"). Reads it
 * back as JSON so apiErrorMessage can show it; any other error passes through.
 */
async function readBlobError(err: unknown): Promise<never> {
  if (err instanceof AxiosError && err.response?.data instanceof Blob) {
    try {
      err.response.data = JSON.parse(await err.response.data.text());
    } catch {
      err.response.data = {};
    }
  }
  throw err;
}

/** The filters alone: the export is everything that matches, so paging is dropped. */
export function toExportParams(query: VendorTransactionsQuery): Record<string, string | number> {
  return toParams({ ...query, cursor: '', limit: undefined });
}

/** Drops blank/default params so the request carries only real filters. */
export function toParams(query: VendorTransactionsQuery): Record<string, string | number> {
  const params: Record<string, string | number> = {};
  if (query.type) params.type = query.type;
  if (query.status) params.status = query.status;
  if (query.from) params.from = query.from;
  if (query.to) params.to = query.to;
  const q = query.q?.trim();
  if (q) params.q = q;
  if (query.open) params.open = 'true';
  // Opaque: passed back exactly as the server returned it.
  if (query.cursor) params.cursor = query.cursor;
  if (query.limit) params.limit = query.limit;
  return params;
}

export const vendorTransactionsService = {
  list: (vendorId: string, query: VendorTransactionsQuery): Promise<VendorTransactionsPage> =>
    tenantClient
      .get<ListWire>(basePath(vendorId), { params: toParams(query) })
      .then((r) => ({
        rows: r.data.rows ?? [],
        nextCursor: r.data.nextCursor ?? '',
        limit: r.data.limit,
      })),

  summary: (vendorId: string): Promise<VendorTransactionsOverview> =>
    tenantClient
      .get<OverviewWire>(`${basePath(vendorId)}/summary`)
      .then((r) => ({
        summary: r.data.summary,
        counts: r.data.counts ?? [],
        types: r.data.types ?? [],
        scopeLimited: r.data.scopeLimited ?? false,
      })),

  aging: (vendorId: string): Promise<VendorAging> =>
    tenantClient
      .get<AgingWire>(`${basePath(vendorId)}/aging`)
      .then((r) => ({
        buckets: r.data.buckets ?? null,
        total: r.data.total ?? 0,
        scopeLimited: r.data.scopeLimited ?? false,
      })),

  /** The server-built CSV of every transaction matching the filters. */
  exportCsv: (vendorId: string, query: VendorTransactionsQuery): Promise<Blob> =>
    tenantClient
      .get<Blob>(`${basePath(vendorId)}/export.csv`, { params: toExportParams(query), responseType: 'blob' })
      .then((r) => r.data)
      .catch(readBlobError),
};
