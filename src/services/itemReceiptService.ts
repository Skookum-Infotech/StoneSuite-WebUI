import { tenantClient } from '@/api/tenantClient';
import type { AuditEntry } from '@/services/crmService';
import type {
  ItemReceipt,
  ItemReceiptCreatePayload,
  ItemReceiptUpdatePayload,
  ItemReceiptPostPayload,
  ItemReceiptVoidPayload,
  ItemReceiptSearchRequest,
  ItemReceiptPage,
} from '@/types/itemReceipt';

// Item Receipt API wrapper. Talks to the dedicated relational module under
// `/api/tenant/item-receipts*` (NOT the generic `/api/tenant/crm/*` JSONB
// router) — mirrors purchaseOrderService.ts. Every call carries the tenant
// Bearer JWT via `tenantClient`; the server enforces tenancy, RBAC
// (`item_receipt:*`), scope, and IDOR.
const BASE = '/tenant/item-receipts';

export const itemReceiptService = {
  // Full filter + sort + global search + keyset pagination. Cursors are
  // opaque — pass back what the server returned, never construct one.
  searchItemReceipts: (req: ItemReceiptSearchRequest): Promise<ItemReceiptPage> =>
    tenantClient
      .post<{
        success: boolean; scope: string; records: ItemReceiptPage['records'];
        nextCursor: string; hasMore: boolean;
      }>(`${BASE}/search`, req)
      .then((r) => ({
        records: r.data.records ?? [],
        nextCursor: r.data.nextCursor ?? '',
        hasMore: Boolean(r.data.hasMore),
        scope: r.data.scope ?? '',
      })),

  getItemReceipt: (uuid: string): Promise<ItemReceipt> =>
    tenantClient
      .get<{ success: boolean; itemReceipt: ItemReceipt }>(`${BASE}/${uuid}`)
      .then((r) => r.data.itemReceipt),

  createItemReceipt: (payload: ItemReceiptCreatePayload): Promise<ItemReceipt> =>
    tenantClient
      .post<{ success: boolean; itemReceipt: ItemReceipt }>(BASE, payload)
      .then((r) => r.data.itemReceipt),

  // PEND-only server-side — a 400/409 elsewhere surfaces as a normal save error.
  updateItemReceipt: (uuid: string, payload: ItemReceiptUpdatePayload): Promise<ItemReceipt> =>
    tenantClient
      .patch<{ success: boolean; itemReceipt: ItemReceipt }>(`${BASE}/${uuid}`, payload)
      .then((r) => r.data.itemReceipt),

  // PEND/VOID-only server-side (a posted receipt is the audit trail for
  // stock that actually moved — void it first to remove it from the working set).
  deleteItemReceipt: (uuid: string): Promise<void> =>
    tenantClient.delete(`${BASE}/${uuid}`).then(() => undefined),

  // The act that moves stock: advances qty_received, writes inventory ledger
  // rows, and rolls the purchase order forward. A 403 with ErrOverReceipt
  // means the delivery exceeds tolerance — see lib/itemReceiptErrors.ts for
  // parsing the offending lines out of the message.
  post: (uuid: string, payload: ItemReceiptPostPayload = {}): Promise<ItemReceipt> =>
    tenantClient
      .post<{ success: boolean; itemReceipt: ItemReceipt }>(`${BASE}/${uuid}/post`, payload)
      .then((r) => r.data.itemReceipt),

  // Reverses a posted receipt (or just closes out a PEND one) — requires a
  // non-empty voidReason. Correction path: posted receipts are immutable, so
  // void-and-reissue is the only way to fix one.
  void: (uuid: string, payload: ItemReceiptVoidPayload): Promise<ItemReceipt> =>
    tenantClient
      .post<{ success: boolean; itemReceipt: ItemReceipt }>(`${BASE}/${uuid}/void`, payload)
      .then((r) => r.data.itemReceipt),

  getAudit: (uuid: string): Promise<AuditEntry[]> =>
    tenantClient
      .get<{ success: boolean; recordId: string; audit: AuditEntry[] }>(`${BASE}/${uuid}/audit`)
      .then((r) => r.data.audit ?? []),

  // GET /api/tenant/purchase-orders/{uuid}/receipts — hangs off the PO, gated
  // by the purchase order's own read permission + IDOR, not item_receipt's.
  forPurchaseOrder: (purchaseOrderUuid: string): Promise<ItemReceipt[]> =>
    tenantClient
      .get<{ success: boolean; records: ItemReceipt[] }>(`/tenant/purchase-orders/${purchaseOrderUuid}/receipts`)
      .then((r) => r.data.records ?? []),
};
