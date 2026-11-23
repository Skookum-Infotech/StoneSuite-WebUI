import { recordRoute } from '@/lib/recentRecordRoute';
import { DELIVERY_STATUSES, type AutomationDelivery, type DeliveryStatus } from '@/types/automationDelivery';

export const DELIVERY_STATUS_LABEL: Readonly<Record<DeliveryStatus, string>> = {
  planned: 'Planned',
  claimed: 'Sending',
  sent: 'Sent',
  skipped: 'Skipped',
  failed: 'Failed',
  dead: 'Dead',
  unknown: 'Unknown',
};

/** Statuses whose `lastError` is worth showing. */
const ERROR_STATUSES: ReadonlySet<DeliveryStatus> = new Set(['failed', 'dead', 'unknown']);

const SHORT_ID_LENGTH = 8;

/** Route [domain, module] per delivery resource; approval resources are the workflow keys. */
const RESOURCE_ROUTE: Readonly<Record<string, readonly [string, string]>> = {
  invoice: ['sales', 'invoice'],
  quote: ['sales', 'quote'],
  estimate: ['sales', 'estimate'],
  sales_order: ['sales', 'sales_order'],
  installation: ['sales', 'installation'],
  payment: ['sales', 'payment'],
  credit_memo: ['sales', 'credit_memo'],
  refund: ['sales', 'refund'],
  purchase_order: ['purchases', 'purchase_order'],
  requisition: ['purchases', 'requisition'],
  vendor_bill: ['purchases', 'vendor_bill'],
  vendor_payment: ['purchases', 'vendor_payment'],
  vendor_credit: ['purchases', 'vendor_credit'],
  expense: ['purchases', 'expense'],
};

export function isDeliveryStatus(value: string | null): value is DeliveryStatus {
  return value !== null && (DELIVERY_STATUSES as readonly string[]).includes(value);
}

export function hasDeliveryError(d: Pick<AutomationDelivery, 'status' | 'lastError'>): boolean {
  return ERROR_STATUSES.has(d.status) && Boolean(d.lastError);
}

/** Document label: the record number when the backend sends one, else a short id. */
export function documentLabel(d: Pick<AutomationDelivery, 'recordNumber' | 'recordId'>): string {
  return (d.recordNumber ?? '') || d.recordId.slice(0, SHORT_ID_LENGTH);
}

/** Detail-page link for the delivery's document, or null for an unknown resource. */
export function documentLink(d: Pick<AutomationDelivery, 'resource' | 'recordId'>): string | null {
  const route = RESOURCE_ROUTE[d.resource];
  return route ? recordRoute(route[0], route[1], d.recordId) : null;
}

/** "Reminder 2 of 4" — stage is a zero-based cadence index; total is the rule's cadence length. */
export function stageText(stage: number, cadenceLength: number | undefined): string {
  const n = stage + 1;
  return cadenceLength && n <= cadenceLength ? `Reminder ${n} of ${cadenceLength}` : `Reminder ${n}`;
}

export function formatDeliveryTime(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
}
