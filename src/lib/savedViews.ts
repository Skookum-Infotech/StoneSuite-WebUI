// Saved views: a named snapshot of a list page's filters and sort, kept in this
// browser for one signed-in user. Nothing here talks to the server, so views do
// not follow the user to another device and are not shared with the team.
//
// Browser storage can be missing, full, blocked or edited by hand, so every
// read and write is guarded: a failed read is "no views", a failed write is
// reported to the caller, and a stored entry that is not the shape we wrote is
// skipped instead of crashing the page.

/** The most views one user may keep for one page. */
export const MAX_SAVED_VIEWS = 20;
/** The longest view name, in characters. */
export const MAX_VIEW_NAME_LENGTH = 60;

const STORAGE_PREFIX = 'stonesuite:saved-views:v1';

export interface SavedView<S> {
  id: string;
  name: string;
  state: S;
}

export type AddViewError = 'empty' | 'too-long' | 'duplicate' | 'limit';
export type AddViewResult<S> =
  | { ok: true; views: SavedView<S>[]; view: SavedView<S> }
  | { ok: false; error: AddViewError };

/** Why a view could not be added, in words for the person who tried. */
export const ADD_VIEW_MESSAGES: Record<AddViewError, string> = {
  empty: 'Enter a name for this view.',
  'too-long': `Use ${MAX_VIEW_NAME_LENGTH} characters or fewer.`,
  duplicate: 'You already have a view with that name.',
  limit: `You can keep up to ${MAX_SAVED_VIEWS} saved views. Delete one to add another.`,
};

/** Storage key for one page's views, one user in one workspace. */
export function savedViewsKey(page: string, userId: string, tenantId: string | null): string {
  return [STORAGE_PREFIX, tenantId ?? 'none', userId, page].join(':');
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Reads the views stored under `key`. Anything unreadable gives an empty list;
 * a malformed entry is dropped while the rest are kept; entries past the limit
 * and repeated ids are ignored.
 */
export function loadViews<S>(key: string, isState: (value: unknown) => value is S): SavedView<S>[] {
  let parsed: unknown;
  try {
    const raw = window.localStorage.getItem(key);
    if (raw === null) return [];
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];

  const views: SavedView<S>[] = [];
  const seen = new Set<string>();
  for (const entry of parsed) {
    if (!isRecord(entry)) continue;
    const { id, name, state } = entry;
    if (typeof id !== 'string' || id === '' || seen.has(id)) continue;
    if (typeof name !== 'string' || name.trim() === '' || name.length > MAX_VIEW_NAME_LENGTH) continue;
    if (!isState(state)) continue;
    seen.add(id);
    views.push({ id, name, state });
    if (views.length === MAX_SAVED_VIEWS) break;
  }
  return views;
}

/** Writes the views; false when the browser would not keep them. */
export function storeViews<S>(key: string, views: SavedView<S>[]): boolean {
  try {
    window.localStorage.setItem(key, JSON.stringify(views));
    return true;
  } catch {
    return false;
  }
}

/** A unique id for a new view. */
export function newViewId(): string {
  const c = globalThis.crypto;
  if (c && typeof c.randomUUID === 'function') return c.randomUUID();
  return `view-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/** Adds a view named `rawName`, or says why not. Pure: persists nothing. */
export function addView<S>(
  views: SavedView<S>[],
  rawName: string,
  state: S,
  id: string = newViewId(),
): AddViewResult<S> {
  const name = rawName.trim();
  if (name === '') return { ok: false, error: 'empty' };
  if (name.length > MAX_VIEW_NAME_LENGTH) return { ok: false, error: 'too-long' };
  if (views.some((v) => v.name.toLowerCase() === name.toLowerCase())) return { ok: false, error: 'duplicate' };
  if (views.length >= MAX_SAVED_VIEWS) return { ok: false, error: 'limit' };
  const view = { id, name, state };
  return { ok: true, views: [...views, view], view };
}

/** The views without the one with `id`. */
export function removeView<S>(views: SavedView<S>[], id: string): SavedView<S>[] {
  return views.filter((v) => v.id !== id);
}
