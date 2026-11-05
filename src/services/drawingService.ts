import { isAxiosError } from 'axios';
import { tenantClient } from '@/api/tenantClient';
import type { Drawing, DrawingArea } from '@/types/drawing';

const HTTP_NOT_FOUND = 404;
const HTTP_CONFLICT = 409;

/** Thrown by saveDrawing/restoreVersion on a 409 — the drawing was changed
 *  by someone else since the caller's recordVersion was read. Distinct from
 *  a generic error so callers can show the conflict dialog specifically,
 *  per the build spec's "never overwrite silently." */
export class DrawingConflictError extends Error {
  constructor() {
    super('This drawing was changed by someone else — reload and try again');
    this.name = 'DrawingConflictError';
  }
}

export interface SaveDrawingPayload {
  areas: DrawingArea[];
  displayUnit: Drawing['displayUnit'];
  fractionDenominator: Drawing['fractionDenominator'];
  recordVersion: number;
}

export interface VersionSummary {
  version: number;
  updatedAt: string;
  updatedBy: { id: string; name: string };
}

export interface VersionsPage {
  items: VersionSummary[];
  nextCursor: string | null;
}

export interface EdgeCode {
  code: string;
  label: string;
}

function asConflictOrRethrow(err: unknown): never {
  if (isAxiosError(err) && err.response?.status === HTTP_CONFLICT) throw new DrawingConflictError();
  throw err;
}

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

  saveDrawing: (salesOrderId: string, payload: SaveDrawingPayload): Promise<Drawing> =>
    tenantClient
      .put<{ success: boolean; drawing: Drawing }>(`/tenant/sales-orders/${salesOrderId}/drawing`, payload)
      .then((r) => r.data.drawing)
      .catch(asConflictOrRethrow),

  listVersions: (salesOrderId: string, cursor?: string): Promise<VersionsPage> =>
    tenantClient
      .get<{ success: boolean; items: VersionSummary[]; nextCursor: string | null }>(
        `/tenant/sales-orders/${salesOrderId}/drawing/versions`,
        { params: { cursor } },
      )
      .then((r) => ({ items: r.data.items, nextCursor: r.data.nextCursor })),

  getVersion: (salesOrderId: string, version: number): Promise<Drawing> =>
    tenantClient
      .get<{ success: boolean; drawing: Drawing }>(`/tenant/sales-orders/${salesOrderId}/drawing/versions/${version}`)
      .then((r) => r.data.drawing),

  restoreVersion: (salesOrderId: string, version: number, recordVersion: number): Promise<Drawing> =>
    tenantClient
      .post<{ success: boolean; drawing: Drawing }>(
        `/tenant/sales-orders/${salesOrderId}/drawing/versions/${version}/restore`,
        { recordVersion },
      )
      .then((r) => r.data.drawing)
      .catch(asConflictOrRethrow),

  getEdgeCodes: (): Promise<EdgeCode[]> =>
    tenantClient
      .get<{ success: boolean; edgeCodes: EdgeCode[] }>('/tenant/settings/edge-codes')
      .then((r) => r.data.edgeCodes),
};
