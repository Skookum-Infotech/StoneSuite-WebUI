import { AxiosError } from 'axios';
import { apiErrorMessage, tenantClient } from '@/api/tenantClient';
import type { CreatedOrder, CreatedOrderInput, CreatedOrderPage } from '@/types/createdOrder';

// Customer-portal "Created Orders" API.
//
// TODO(backend): these endpoints do not exist yet — the frontend ships first
// and the backend owner wires them. The contract this file assumes, so the two
// sides can meet in the middle (a portal token is confined to /api/portal/*, so
// there is no staff variant to branch to, unlike feedbackService):
//
//   GET  /api/portal/created-orders?cursor=&limit=
//        → { success, orders: CreatedOrder[], nextCursor }   (own orders only,
//          newest first; nextCursor is an opaque keyset cursor, '' at the end)
//   POST /api/portal/created-orders        body: CreatedOrderInput
//        → { success, order: CreatedOrder }                  (400 with a
//          `message` for a validation failure)
//
// Both are scoped server-side to the signed-in customer; the frontend never
// sends a customer or tenant id.
const BASE = '/portal/created-orders';

const HTTP_NOT_FOUND = 404;

const EMPTY_PAGE: CreatedOrderPage = { orders: [], nextCursor: '' };

function isNotFound(err: unknown): boolean {
  return err instanceof AxiosError && err.response?.status === HTTP_NOT_FOUND;
}

/** What to tell the customer when submitting fails. While the endpoint is
 *  missing (see TODO(backend) above) that is a 404, which "Request failed with
 *  status code 404" would describe unhelpfully. */
export function createOrderErrorMessage(err: unknown): string {
  if (isNotFound(err)) {
    return "Order submission isn't available yet. Your entries are still here — please try again later.";
  }
  return apiErrorMessage(err, 'We could not submit your order. Please try again.');
}

export const createdOrderService = {
  list: (cursor = '', limit?: number): Promise<CreatedOrderPage> =>
    tenantClient
      .get<{ success: boolean; orders: CreatedOrder[]; nextCursor: string }>(BASE, {
        params: { cursor: cursor || undefined, limit },
      })
      .then((r) => ({ orders: r.data.orders ?? [], nextCursor: r.data.nextCursor ?? '' }))
      .catch((err: unknown) => {
        // TODO(backend): drop this once the endpoint ships. Until then the
        // route itself is missing, which reads as "no orders yet" rather than
        // a broken page. Any other failure still surfaces to the caller.
        if (isNotFound(err)) return EMPTY_PAGE;
        throw err;
      }),

  create: (input: CreatedOrderInput): Promise<CreatedOrder> =>
    tenantClient
      .post<{ success: boolean; order: CreatedOrder }>(BASE, input)
      .then((r) => r.data.order),
};
