// Mirrors StoneSuite-Backend's anomaly.Item (anomaly/review.go) — the wire
// shape of GET /api/tenant/anomalies. The server decides which findings a
// caller may see (a super admin sees all, anyone else only those addressed to
// them), so the UI treats every response as already scoped.

export type AnomalySeverity = 'info' | 'warning' | 'critical';

export type AnomalyStatus = 'open' | 'reviewed' | 'dismissed' | 'confirmed';

export interface Anomaly {
  id: string;
  ruleKey: string;
  severity: AnomalySeverity;
  resource: string;
  recordId?: string;
  title: string;
  detail: string;
  status: AnomalyStatus;
  note: string;
  detectedAt: string;
  statusChangedAt?: string;
}

export interface AnomalyPage {
  items: Anomaly[];
  /** Opaque keyset cursor; '' on the last page. Only ever replayed, never built. */
  nextCursor: string;
}

export interface AnomalyListParams {
  status?: AnomalyStatus;
  cursor?: string;
  limit?: number;
}

/** A tab on the page: one status, or every status. */
export type AnomalyFilter = AnomalyStatus | 'all';
