import { tenantClient } from '@/api/tenantClient';
import type { AuditEntry } from '@/services/crmService';
import type {
  Quote,
  QuoteCreatePayload,
  QuoteUpdatePayload,
  QuoteSearchRequest,
  QuotePage,
} from '@/types/quote';

// Quote API wrapper. Talks to the dedicated relational module under
// `/api/tenant/quotes*` (NOT the generic `/api/tenant/crm/*` JSONB router).
// Every call carries the tenant Bearer JWT via `tenantClient`; the server
// enforces tenancy, RBAC (`quote:*`), scope, and IDOR.
const BASE = '/tenant/quotes';

export const quoteService = {
  // Full filter + sort + global search + keyset pagination. Cursors are
  // opaque — pass back what the server returned, never construct one.
  searchQuotes: (req: QuoteSearchRequest): Promise<QuotePage> =>
    tenantClient
      .post<{
        success: boolean; scope: string; records: QuotePage['records'];
        nextCursor: string; hasMore: boolean;
      }>(`${BASE}/search`, req)
      .then((r) => ({
        records: r.data.records ?? [],
        nextCursor: r.data.nextCursor ?? '',
        hasMore: Boolean(r.data.hasMore),
        scope: r.data.scope ?? '',
      })),

  getQuote: (uuid: string): Promise<Quote> =>
    tenantClient
      .get<{ success: boolean; quote: Quote }>(`${BASE}/${uuid}`)
      .then((r) => r.data.quote),

  createQuote: (payload: QuoteCreatePayload): Promise<Quote> =>
    tenantClient
      .post<{ success: boolean; quote: Quote }>(BASE, payload)
      .then((r) => r.data.quote),

  updateQuote: (uuid: string, payload: QuoteUpdatePayload): Promise<Quote> =>
    tenantClient
      .patch<{ success: boolean; quote: Quote }>(`${BASE}/${uuid}`, payload)
      .then((r) => r.data.quote),

  deleteQuote: (uuid: string): Promise<void> =>
    tenantClient.delete(`${BASE}/${uuid}`).then(() => undefined),

  // Status change validated against the server-side transition map; a denied
  // move returns 409 (surface as a blocked-transition message, not a failure).
  transition: (uuid: string, toStatusCode: string): Promise<Quote> =>
    tenantClient
      .post<{ success: boolean; quote: Quote }>(
        `${BASE}/${uuid}/transition`,
        { toStatusCode },
      )
      .then((r) => r.data.quote),

  // Records this user's approval sign-off on the quote's current status
  // (typically while statusCode === 'PAPV'). Rejected with 409/403 server-side
  // if the status has no approvers configured, or the caller isn't one.
  approve: (uuid: string): Promise<Quote> =>
    tenantClient
      .post<{ success: boolean; quote: Quote }>(`${BASE}/${uuid}/approve`, {})
      .then((r) => r.data.quote),

  getAudit: (uuid: string): Promise<AuditEntry[]> =>
    tenantClient
      .get<{ success: boolean; recordId: string; audit: AuditEntry[] }>(`${BASE}/${uuid}/audit`)
      .then((r) => r.data.audit ?? []),

  // Placeholder — the backend endpoint's response shape isn't finalized yet.
  // Callers should only branch on success/failure, not on the resolved value.
  convertToSalesOrder: (uuid: string): Promise<{ salesOrderId?: string }> =>
    tenantClient
      .post<{ success: boolean; salesOrderId?: string }>(`${BASE}/${uuid}/convert-to-sales-order`, {})
      .then((r) => ({ salesOrderId: r.data.salesOrderId })),
};
