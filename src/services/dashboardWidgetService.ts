import type { RoleWidgetAllocation, UserWidgetPreference, WidgetDefinition } from '@/types/dashboardWidgets';
import { WIDGET_CATALOG } from '@/config/dashboardWidgets';
import { createDefaultRoleAllocation } from '@/lib/dashboardWidgets';

// No backend for this feature yet. Allocation (by role) and preference (by
// user) are mocked via localStorage behind the same Promise-returning shape
// as a real *Service.ts — swapping in a real endpoint later only touches
// this file, not any calling page.
const ALLOCATION_STORAGE_KEY = 'stonesuite:dashboard-widget-role-allocations';
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

type AllocationStore = Record<string, RoleWidgetAllocation>; // keyed by roleId
type PreferenceStore = Record<string, UserWidgetPreference>; // keyed by userId

export const dashboardWidgetService = {
  getCatalog: (): Promise<WidgetDefinition[]> => Promise.resolve(WIDGET_CATALOG),

  // Returns each given role's allocation, seeding catalog defaults for any
  // role that hasn't been configured yet (e.g. a role created after this
  // feature shipped).
  getRoleAllocations: (roleIds: string[]): Promise<RoleWidgetAllocation[]> => {
    const store = readJson<AllocationStore>(ALLOCATION_STORAGE_KEY, {});
    let dirty = false;
    const result = roleIds.map((roleId) => {
      const existing = store[roleId];
      if (existing) return existing;
      dirty = true;
      const seeded = createDefaultRoleAllocation(roleId, WIDGET_CATALOG);
      store[roleId] = seeded;
      return seeded;
    });
    if (dirty) writeJson(ALLOCATION_STORAGE_KEY, store);
    return Promise.resolve(result);
  },

  // Admin action — grants/revokes which widgets every member of a role may see.
  setRoleAllocation: (roleId: string, widgetIds: string[]): Promise<RoleWidgetAllocation> => {
    const store = readJson<AllocationStore>(ALLOCATION_STORAGE_KEY, {});
    const updated: RoleWidgetAllocation = { roleId, allocated: widgetIds };
    store[roleId] = updated;
    writeJson(ALLOCATION_STORAGE_KEY, store);
    return Promise.resolve(updated);
  },

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
