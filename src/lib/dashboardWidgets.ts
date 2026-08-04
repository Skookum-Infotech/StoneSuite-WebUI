import type { UserWidgetSettings, WidgetDefinition } from '@/types/dashboardWidgets';

export function getDefaultWidgetIds(catalog: WidgetDefinition[]): string[] {
  return catalog.filter((w) => w.defaultEnabled).map((w) => w.id);
}

export function createDefaultSettings(userId: string, catalog: WidgetDefinition[]): UserWidgetSettings {
  const defaults = getDefaultWidgetIds(catalog);
  return { userId, allocated: defaults, enabled: defaults };
}

// Newly-granted widget ids are auto-enabled so a widget the admin allocates
// "because the user asked for it" shows up immediately. Ids that were
// already allocated keep whatever enabled state they had. Revoked ids are
// left in `enabled` untouched — visibility is always the allocated/enabled
// intersection (see getVisibleWidgetIds), so a revoked widget disappears
// regardless of its enabled state.
export function applyAllocation(settings: UserWidgetSettings, allocatedIds: string[]): UserWidgetSettings {
  const newlyAllocated = allocatedIds.filter((id) => !settings.allocated.includes(id));
  return {
    ...settings,
    allocated: allocatedIds,
    enabled: [...settings.enabled, ...newlyAllocated],
  };
}

// A user can only enable widgets they've been allocated.
export function applyPreference(settings: UserWidgetSettings, enabledIds: string[]): UserWidgetSettings {
  return {
    ...settings,
    enabled: enabledIds.filter((id) => settings.allocated.includes(id)),
  };
}

export function getVisibleWidgetIds(settings: UserWidgetSettings): string[] {
  return settings.allocated.filter((id) => settings.enabled.includes(id));
}

export interface RankedCustomer {
  id: string;
  name: string;
  value: number;
  proportion: number; // 0-1, relative to the top-ranked value in the result
}

export function rankTopCustomers(
  customers: { id: string; name: string; value: number }[],
  limit: number,
): RankedCustomer[] {
  const top = [...customers].sort((a, b) => b.value - a.value).slice(0, limit);
  const max = top[0]?.value ?? 0;
  return top.map((c) => ({ ...c, proportion: max > 0 ? c.value / max : 0 }));
}

export interface AgingBucket {
  label: '0-30' | '31-60' | '61-90' | '90+';
  amount: number;
}

const AGING_BUCKET_LABELS: AgingBucket['label'][] = ['0-30', '31-60', '61-90', '90+'];

export function bucketInvoicesByAge(invoices: { amount: number; daysPastDue: number }[]): AgingBucket[] {
  const buckets = AGING_BUCKET_LABELS.map((label) => ({ label, amount: 0 }));
  for (const invoice of invoices) {
    const index =
      invoice.daysPastDue <= 30 ? 0 : invoice.daysPastDue <= 60 ? 1 : invoice.daysPastDue <= 90 ? 2 : 3;
    buckets[index].amount += invoice.amount;
  }
  return buckets;
}
