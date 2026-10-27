import type {
  AnomalyScanResult,
  AnomalyFilter,
  AnomalyListParams,
  AnomalySeverity,
  AnomalyStatus,
} from '@/types/anomaly';
import type { AutomationRule } from '@/types/automationRule';

/** rule_key of the workspace on/off switch (automation.RuleKeyAnomalyScan on the backend). */
export const ANOMALY_SCAN_RULE_KEY = 'anomaly_scan';

/** The anomaly scan switch among a workspace's automation rules, if it exists. */
export function findAnomalyScanRule(rules: ReadonlyArray<AutomationRule>): AutomationRule | undefined {
  return rules.find((r) => r.ruleKey === ANOMALY_SCAN_RULE_KEY);
}

/** One-line toast for a finished on-demand scan. */
export function scanSummary(r: AnomalyScanResult): string {
  const found =
    r.raised === 0 ? 'No new anomalies found' : `${r.raised} new ${r.raised === 1 ? 'anomaly' : 'anomalies'} found`;
  const alerts = r.alertsSent > 0 ? `, ${r.alertsSent} alert${r.alertsSent === 1 ? '' : 's'} sent` : '';
  const failed = r.alertsFailed > 0 ? `, ${r.alertsFailed} could not be sent` : '';
  return `${found}${alerts}${failed}`;
}

/** Findings per page — the server caps this too (anomaly.MaxPageSize). */
export const ANOMALY_PAGE_SIZE = 25;

/** Mirrors anomaly.MaxNoteLen on the backend. */
export const ANOMALY_NOTE_MAX_LENGTH = 1000;

export const ANOMALY_FILTERS: ReadonlyArray<{ value: AnomalyFilter; label: string }> = [
  { value: 'open', label: 'Open' },
  { value: 'confirmed', label: 'Confirmed' },
  { value: 'reviewed', label: 'Reviewed' },
  { value: 'dismissed', label: 'Dismissed' },
  { value: 'all', label: 'All' },
];

export const ANOMALY_STATUS_LABELS: Record<AnomalyStatus, string> = {
  open: 'Open',
  reviewed: 'Reviewed',
  dismissed: 'Dismissed',
  confirmed: 'Confirmed problem',
};

export const ANOMALY_SEVERITY_LABELS: Record<AnomalySeverity, string> = {
  info: 'Info',
  warning: 'Warning',
  critical: 'Critical',
};

// Literal class strings so the Tailwind scanner keeps them in the build.
export const ANOMALY_SEVERITY_CLASSES: Record<AnomalySeverity, string> = {
  info: 'bg-sky-50 text-sky-700 ring-sky-200',
  warning: 'bg-amber-50 text-amber-700 ring-amber-200',
  critical: 'bg-red-50 text-red-700 ring-red-200',
};

/** Human names for the rule keys the backend ships; unknown keys fall back to
 *  a readable form of the key so a newly added rule still shows sensibly. */
const RULE_LABELS: Record<string, string> = {
  self_approval: 'Approved by its own owner',
  unbalanced_journal: 'Unbalanced journal entry',
  duplicate_vendor_bill: 'Possible duplicate vendor bill',
  high_discount: 'Unusually high discount',
  below_cost_sale: 'Sold below cost',
  unusual_order_total: 'Unusually large order',
  duplicate_invoice: 'Possible duplicate invoice',
  over_credit_limit: 'Over credit limit',
  overdue_invoice: 'Invoice well past due',
  stale_unapplied_payment: 'Payment never applied',
  refund_exceeds_payment: 'Refund larger than the payment',
  quick_refund: 'Refund right after payment',
  credit_memo_burst: 'Several credit memos for one customer',
  voided_after_posting: 'Voided after being issued',
  backdated_document: 'Date far from when it was entered',
  price_drift_on_conversion: 'Order differs from its quote',
  zero_tax_unusual: 'No sales tax charged',
  filled_not_invoiced: 'Filled order never invoiced',
  bill_exceeds_po: 'Bills exceed the purchase order',
  vendor_overpaid: 'Paid more than owed',
  new_vendor_large_payment: 'Large payment to a new vendor',
  po_price_above_cost: 'Purchase price above the usual cost',
  split_purchase_orders: 'Purchase orders split across one day',
  po_late: 'Purchase order overdue',
  po_partial_stuck: 'Partly received order has stalled',
  expense_duplicate: 'Repeated expense',
  expense_unusually_high: 'Unusually high expense',
  over_allocated: 'More reserved than in stock',
  stock_ledger_mismatch: 'Stock does not match its history',
  large_write_off: 'Large stock write-off',
  adjustment_burst: 'Many stock adjustments',
  count_variance_high: 'Large stock count differences',
  reserved_for_closed_order: 'Stock reserved for a cancelled order',
  dead_stock: 'Slabs not moving',
  bin_transfer_stuck: 'Bin transfer waiting too long',
  received_slab_mismatch: 'Received slab count differs',
  shrinkage_spike: 'Stock loss spike',
  fabrication_job_stuck: 'Fabrication job not moving',
  install_overdue: 'Install date missed',
  schedule_activity_overdue: 'Late scheduled activity',
  many_template_revisions: 'Template redone many times',
  multiple_jobs_per_order: 'More than one job on an order',
  posted_in_closed_period: 'Posted into a closed period',
  unusual_cash_transfer: 'Unusually large cash transfer',
  chart_of_accounts_changed: 'Chart of accounts changed',
};

export function anomalyRuleLabel(ruleKey: string): string {
  const known = RULE_LABELS[ruleKey];
  if (known) return known;
  const spaced = ruleKey.replace(/_/g, ' ').trim();
  return spaced ? spaced.charAt(0).toUpperCase() + spaced.slice(1) : 'Anomaly';
}

export interface ReviewAction {
  to: AnomalyStatus;
  label: string;
}

/** The review moves offered for a finding in `status`. A finished finding can
 *  only be reopened; an open one can go anywhere. */
export function reviewActions(status: AnomalyStatus): ReviewAction[] {
  switch (status) {
    case 'open':
      return [
        { to: 'reviewed', label: 'Mark reviewed' },
        { to: 'confirmed', label: 'Confirm problem' },
        { to: 'dismissed', label: 'Dismiss' },
      ];
    case 'reviewed':
      return [
        { to: 'confirmed', label: 'Confirm problem' },
        { to: 'dismissed', label: 'Dismiss' },
        { to: 'open', label: 'Reopen' },
      ];
    case 'confirmed':
    case 'dismissed':
      return [{ to: 'open', label: 'Reopen' }];
  }
}

/** Query params for a list request: 'all' and an empty cursor are omitted. */
export function buildAnomalyParams(filter: AnomalyFilter, cursor: string): AnomalyListParams {
  const params: AnomalyListParams = { limit: ANOMALY_PAGE_SIZE };
  if (filter !== 'all') params.status = filter;
  if (cursor) params.cursor = cursor;
  return params;
}
