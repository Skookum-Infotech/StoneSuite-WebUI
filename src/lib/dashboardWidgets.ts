import type { RoleWidgetAllocation, WidgetDefinition } from '@/types/dashboardWidgets';
import type { WidgetPreset, WidgetPresetId } from '@/config/dashboardWidgetPresets';

// hidden is opt-out, so a widget newly granted to a role appears immediately
// for everyone with that role without each user revisiting Customize.
export function getVisibleWidgetIds(allocatedIds: string[], hidden: string[]): string[] {
  return allocatedIds.filter((id) => !hidden.includes(id));
}

// Adds/removes a batch of ids from a set in one step — shared by single-widget
// toggles, category header toggles, and matrix row/column toggle-alls.
export function toggleIds(currentIds: string[], ids: string[], next: boolean): string[] {
  if (next) return [...new Set([...currentIds, ...ids])];
  const remove = new Set(ids);
  return currentIds.filter((id) => !remove.has(id));
}

export function resolvePresetWidgetIds(preset: WidgetPreset, catalog: WidgetDefinition[]): string[] {
  if (preset.categories === 'all') return catalog.map((w) => w.id);
  return catalog.filter((w) => preset.categories.includes(w.category)).map((w) => w.id);
}

// Which preset (if any) exactly matches a role's currently allocated widgets,
// so the UI can highlight it as active rather than just offering it as an action.
export function matchingPresetId(
  allocatedIds: string[],
  catalog: WidgetDefinition[],
  presets: WidgetPreset[],
): WidgetPresetId | null {
  const allocatedSet = new Set(allocatedIds);
  for (const preset of presets) {
    const presetIds = resolvePresetWidgetIds(preset, catalog);
    if (presetIds.length === allocatedSet.size && presetIds.every((id) => allocatedSet.has(id))) {
      return preset.id;
    }
  }
  return null;
}

// Role ids whose staged allocation differs from what's currently persisted —
// drives the dirty count and which roles Save actually writes.
export function dirtyRoleIds(
  staged: Record<string, string[]>,
  original: RoleWidgetAllocation[],
): string[] {
  const originalByRole = new Map(original.map((a) => [a.roleId, a.allocated]));
  return Object.keys(staged).filter((roleId) => {
    const orig = originalByRole.get(roleId) ?? [];
    const next = staged[roleId];
    return orig.length !== next.length || !orig.every((id) => next.includes(id));
  });
}

// Matches the wildcard-grant convention used elsewhere (e.g.
// AccountSettingsPage's AccessSummary) rather than a hardcoded role name/key,
// since tenants can rename their admin role.
export function isSuperAdminGrants(grants: { resource: string; action: string }[]): boolean {
  return grants.some((g) => g.resource === '*' && g.action === '*');
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
