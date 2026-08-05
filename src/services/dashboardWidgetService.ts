import type { UserWidgetSettings, WidgetDefinition } from '@/types/dashboardWidgets';
import { WIDGET_CATALOG } from '@/config/dashboardWidgets';
import { applyAllocation, applyPreference, createDefaultSettings } from '@/lib/dashboardWidgets';

// No backend for this feature yet. Allocation/preference state is mocked via
// localStorage, keyed by user id, behind the same Promise-returning shape as
// a real *Service.ts — swapping in a real endpoint later only touches this
// file, not any calling page.
const STORAGE_KEY = 'stonesuite:dashboard-widget-settings';

type SettingsStore = Record<string, UserWidgetSettings>;

function readStore(): SettingsStore {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as SettingsStore) : {};
  } catch (err) {
    console.error('[dashboardWidgetService] failed to read localStorage, using in-memory defaults', err);
    return {};
  }
}

// Best-effort persistence — a write failure (quota exceeded, storage
// disabled in private browsing) degrades to in-memory-only for the rest of
// the session rather than breaking the feature.
function writeStore(store: SettingsStore): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch (err) {
    console.error('[dashboardWidgetService] failed to persist to localStorage', err);
  }
}

export const dashboardWidgetService = {
  getCatalog: (): Promise<WidgetDefinition[]> => Promise.resolve(WIDGET_CATALOG),

  getSettings: (userId: string): Promise<UserWidgetSettings> => {
    const store = readStore();
    const existing = store[userId];
    if (existing) return Promise.resolve(existing);

    const seeded = createDefaultSettings(userId, WIDGET_CATALOG);
    writeStore({ ...store, [userId]: seeded });
    return Promise.resolve(seeded);
  },

  // Admin action — grants/revokes which widgets a user may see.
  setAllocation: (userId: string, widgetIds: string[]): Promise<UserWidgetSettings> => {
    const store = readStore();
    const current = store[userId] ?? createDefaultSettings(userId, WIDGET_CATALOG);
    const updated = applyAllocation(current, widgetIds);
    writeStore({ ...store, [userId]: updated });
    return Promise.resolve(updated);
  },

  // End-user action — chooses which of their allocated widgets to show.
  setPreference: (userId: string, widgetIds: string[]): Promise<UserWidgetSettings> => {
    const store = readStore();
    const current = store[userId] ?? createDefaultSettings(userId, WIDGET_CATALOG);
    const updated = applyPreference(current, widgetIds);
    writeStore({ ...store, [userId]: updated });
    return Promise.resolve(updated);
  },
};
