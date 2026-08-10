import type { RoleWidgetAllocation, WidgetDefinition } from '@/types/dashboardWidgets';

export function getDefaultWidgetIds(catalog: WidgetDefinition[]): string[] {
  return catalog.filter((w) => w.defaultEnabled).map((w) => w.id);
}

export function createDefaultRoleAllocation(
  roleId: string,
  catalog: WidgetDefinition[],
): RoleWidgetAllocation {
  return { roleId, allocated: getDefaultWidgetIds(catalog) };
}

// No active role selected (activeRoleId === '') means every assigned role's
// allocation applies, unioned — mirrors rbacService.myPermissions()'s
// activeRoleId semantics, so the dashboard always matches what the user can
// currently do. A non-empty activeRoleId narrows to just that one role.
export function effectiveRoleIds(userRoleIds: string[], activeRoleId: string): string[] {
  return activeRoleId ? [activeRoleId] : userRoleIds;
}

export function getAllocatedWidgetIds(
  roleAllocations: RoleWidgetAllocation[],
  userRoleIds: string[],
  activeRoleId: string,
): string[] {
  const roleIds = effectiveRoleIds(userRoleIds, activeRoleId);
  const allocated = new Set<string>();
  for (const allocation of roleAllocations) {
    if (roleIds.includes(allocation.roleId)) {
      allocation.allocated.forEach((id) => allocated.add(id));
    }
  }
  return [...allocated];
}

// hidden is opt-out, so a widget newly granted to a role appears immediately
// for everyone with that role without each user revisiting Customize.
export function getVisibleWidgetIds(allocatedIds: string[], hidden: string[]): string[] {
  return allocatedIds.filter((id) => !hidden.includes(id));
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
