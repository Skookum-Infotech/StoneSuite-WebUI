import { isAxiosError } from 'axios';
import { tenantClient } from '@/api/tenantClient';
import type { Drawing } from '@/types/drawing';

const HTTP_NOT_FOUND = 404;

export const drawingService = {
  // The build spec §6 endpoint this calls doesn't exist in StoneSuite-Backend
  // yet, so this resolves to a 404 (or a network error) for every real
  // sales order today — both fall through to null here, exactly like a
  // real "no drawing saved yet" would. SalesOrderDrawingPage (Task 10)
  // treats null as "start blank".
  getDrawing: (salesOrderId: string): Promise<Drawing | null> =>
    tenantClient
      .get<{ success: boolean; drawing: Drawing }>(`/tenant/sales-orders/${salesOrderId}/drawing`)
      .then((r) => r.data.drawing)
      .catch((err: unknown) => {
        if (isAxiosError(err) && err.response?.status === HTTP_NOT_FOUND) return null;
        throw err;
      }),
};
