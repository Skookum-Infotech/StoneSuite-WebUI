// Mirrors the backend's controllers.AutomationDelivery (automation_deliveries_store.go).
export const DELIVERY_STATUSES = ['planned', 'claimed', 'sent', 'skipped', 'failed', 'dead', 'unknown'] as const;
export type DeliveryStatus = (typeof DELIVERY_STATUSES)[number];

export interface AutomationDelivery {
  id: string;
  ruleKey: string;
  /** What the delivery is about: invoice, quote, estimate, or an approval workflow key. */
  resource: string;
  recordId: string;
  /** Zero-based index into the rule's cadence. */
  stage: number;
  anchorDate: string;
  recipientEmail: string;
  status: DeliveryStatus;
  reason: string | null;
  attempts: number;
  runAt: string;
  sentAt: string | null;
  lastError: string | null;
  createdAt: string;
  /** Human document number; absent until the backend ships it. */
  recordNumber?: string;
}

export interface AutomationDeliveryFilters {
  status?: DeliveryStatus;
  ruleKey?: string;
}

export interface AutomationDeliveryPage {
  deliveries: AutomationDelivery[];
  /** Opaque keyset cursor; empty when there is no further page. */
  nextCursor: string;
}
