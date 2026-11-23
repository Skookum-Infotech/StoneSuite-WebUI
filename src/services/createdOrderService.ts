import { apiErrorMessage, tenantClient } from '@/api/tenantClient';
import type { CreatedOrder, CreatedOrderInput, CreatedOrderPage } from '@/types/createdOrder';

// Customer-portal "Created Orders" API — a portal token is confined to
// /api/portal/*, so there is no staff variant to branch to (unlike
// feedbackService).
//
//   GET  /api/portal/created-orders?cursor=&limit=
//        → { success, orders: CreatedOrder[], nextCursor, hasMore }
//          (the customer's own orders, newest first; nextCursor is an opaque
//          keyset cursor, '' at the end)
//   GET  /api/portal/created-orders/{id}   → { success, order }  (404 when it is
//        not this customer's — indistinguishable from a missing one)
//   POST /api/portal/created-orders        body: CreatedOrderInput
//        → 201 { success, order: CreatedOrder }
//          400 `message` for a validation failure; 409 when the customer's
//          account cannot place new orders right now
//   PUT  /api/portal/created-orders/{id}   body: CreatedOrderInput (the whole order)
//        → 200 { success, order: CreatedOrder }
//          as POST, plus 404 for an order that is not theirs and 409 once the
//          order's Sales Order has moved on from Draft (`order.editable` is
//          false from then on)
//
// Placing an order also drafts a Sales Order for the fabricator's staff; the
// customer never sees that draft, only their order. Changing one brings that
// draft along, keeping what staff have done to it. All calls are scoped
// server-side to the signed-in customer — the frontend never sends a customer
// or tenant id.
const BASE = '/portal/created-orders';

/** What to tell the customer when submitting fails: the server's own message
 *  (validation, account on hold) when it sent one, else a plain retry. */
export function createOrderErrorMessage(err: unknown, changing = false): string {
  return apiErrorMessage(
    err,
    changing
      ? 'We could not save your changes. Please try again.'
      : 'We could not submit your order. Please try again.',
  );
}

export const createdOrderService = {
  list: (cursor = '', limit?: number): Promise<CreatedOrderPage> =>
    tenantClient
      .get<{ success: boolean; orders: CreatedOrder[]; nextCursor: string }>(BASE, {
        params: { cursor: cursor || undefined, limit },
      })
      .then((r) => ({ orders: r.data.orders ?? [], nextCursor: r.data.nextCursor ?? '' })),

  get: (id: string): Promise<CreatedOrder> =>
    tenantClient
      .get<{ success: boolean; order: CreatedOrder }>(`${BASE}/${encodeURIComponent(id)}`)
      .then((r) => r.data.order),

  create: (input: CreatedOrderInput): Promise<CreatedOrder> =>
    tenantClient
      .post<{ success: boolean; order: CreatedOrder }>(BASE, input)
      .then((r) => r.data.order),

  update: (id: string, input: CreatedOrderInput): Promise<CreatedOrder> =>
    tenantClient
      .put<{ success: boolean; order: CreatedOrder }>(`${BASE}/${encodeURIComponent(id)}`, input)
      .then((r) => r.data.order),
};
