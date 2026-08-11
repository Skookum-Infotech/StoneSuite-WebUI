import type { RoleWidgetAllocation, UserWidgetPreference, WidgetDefinition } from '@/types/dashboardWidgets';
import { WIDGET_CATALOG } from '@/config/dashboardWidgets';
import { tenantClient } from '@/api/tenantClient';

// Widget catalog (title/description/size/category, used for rendering) has
// no backend endpoint -- it's a static frontend concern. Role allocation and
// the caller's own resolved set are real API calls; preference (per-user
// show/hide) still has no backend endpoint, so it stays mocked via
// localStorage behind the same Promise-returning shape as the rest of this
// service.
const PREFERENCE_STORAGE_KEY = 'stonesuite:dashboard-widget-preferences';

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch (err) {
    console.error(`[dashboardWidgetService] failed to read localStorage key "${key}"`, err);
    return fallback;
  }
}

// Best-effort persistence — a write failure (quota exceeded, storage
// disabled in private browsing) degrades to in-memory-only for the rest of
// the session rather than breaking the feature.
function writeJson<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (err) {
    console.error(`[dashboardWidgetService] failed to persist localStorage key "${key}"`, err);
  }
}

type PreferenceStore = Record<string, UserWidgetPreference>; // keyed by userId

// Wire shape from the backend (dashboardui.RoleAllocation) — widgetIds, not
// allocated. Mapped to the frontend's RoleWidgetAllocation at this service
// boundary so every caller keeps using the existing field name.
interface RoleAllocationWire {
  roleId: string;
  widgetIds: string[];
}

function toRoleAllocation(wire: RoleAllocationWire): RoleWidgetAllocation {
  return { roleId: wire.roleId, allocated: wire.widgetIds };
}

export const dashboardWidgetService = {
  getCatalog: (): Promise<WidgetDefinition[]> => Promise.resolve(WIDGET_CATALOG),

  // Admin allocation page — every role's widget allocation. A role with no
  // saved configuration comes back already seeded to the catalog defaults
  // (resolved server-side, not persisted until the admin actually saves).
  getRoleAllocations: (): Promise<RoleWidgetAllocation[]> =>
    tenantClient
      .get<{ success: boolean; allocations: RoleAllocationWire[] }>('/tenant/dashboard/widgets/roles')
      .then((r) => (r.data.allocations ?? []).map(toRoleAllocation)),

  // Admin action — batch-writes every given role's allocation in one atomic
  // request; a partial failure leaves every role's saved allocation untouched.
  setRoleAllocations: (allocations: RoleWidgetAllocation[]): Promise<RoleWidgetAllocation[]> =>
    tenantClient
      .put<{ success: boolean; allocations: RoleAllocationWire[] }>('/tenant/dashboard/widgets/roles', {
        allocations: allocations.map((a) => ({ roleId: a.roleId, widgetIds: a.allocated })),
      })
      .then((r) => (r.data.allocations ?? []).map(toRoleAllocation)),

  // End-user's own dashboard — resolved server-side from their assigned
  // role(s) (narrowed to the active role if one is set), or every widget if
  // any of their grants is the wildcard (super admin) grant.
  getMyAllocation: (): Promise<string[]> =>
    tenantClient
      .get<{ success: boolean; widgetIds: string[] }>('/tenant/dashboard/widgets/me')
      .then((r) => r.data.widgetIds ?? []),

  getPreference: (userId: string): Promise<UserWidgetPreference> => {
    const store = readJson<PreferenceStore>(PREFERENCE_STORAGE_KEY, {});
    const existing = store[userId];
    if (existing) return Promise.resolve(existing);

    const seeded: UserWidgetPreference = { userId, hidden: [] };
    store[userId] = seeded;
    writeJson(PREFERENCE_STORAGE_KEY, store);
    return Promise.resolve(seeded);
  },

  // End-user action — hides/shows widgets within whatever their role(s) allocate.
  setPreference: (userId: string, hiddenIds: string[]): Promise<UserWidgetPreference> => {
    const store = readJson<PreferenceStore>(PREFERENCE_STORAGE_KEY, {});
    const updated: UserWidgetPreference = { userId, hidden: hiddenIds };
    store[userId] = updated;
    writeJson(PREFERENCE_STORAGE_KEY, store);
    return Promise.resolve(updated);
  },
};
