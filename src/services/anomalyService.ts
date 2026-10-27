import { tenantClient } from '@/api/tenantClient';
import type { Anomaly, AnomalyListParams, AnomalyPage, AnomalyStatus } from '@/types/anomaly';

// Findings raised by the backend's scheduled anomaly scan —
// GET /api/tenant/anomalies and PATCH /api/tenant/anomalies/{id}. The server
// scopes the list to what the caller may see; a finding that is not theirs is
// a 404 (indistinguishable from "does not exist").

interface AnomalyListWire {
  success: boolean;
  items: Anomaly[] | null;
  nextCursor?: string;
}

export const anomalyService = {
  list: (params: AnomalyListParams): Promise<AnomalyPage> =>
    tenantClient
      .get<AnomalyListWire>('/tenant/anomalies', { params })
      .then((r) => ({ items: r.data.items ?? [], nextCursor: r.data.nextCursor ?? '' })),

  review: (id: string, status: AnomalyStatus, note: string): Promise<Anomaly> =>
    tenantClient
      .patch<{ success: boolean; item: Anomaly }>(`/tenant/anomalies/${id}`, { status, note })
      .then((r) => r.data.item),
};
