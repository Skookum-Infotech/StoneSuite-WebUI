// "Create Customer"/"Create Vendor" round trip for a document's
// Customer/Vendor picker field (CustomerPicker.tsx, VendorPicker.tsx).
//
// Mirrors the shape of lib/inventoryItemReturn.ts (leave the page, create the
// missing master-data record via its own dedicated Add page, come back with
// it picked) but simpler: a customer/vendor is a single header field, not a
// repeating line-items row, so there is no draft-line concept to restore —
// only the whole page's other unsaved state, plus the freshly created ref to
// apply to that one field.
//
// Customer and Vendor share this module (rather than each getting its own
// copy) because they are structurally identical for this purpose: both are
// simple `{id, name}`-shaped master-data records, both created via a
// dedicated Add page reached at a fixed path, both hand the created record
// back through router state. `kind` namespaces the sessionStorage stash so a
// customer round trip and a vendor round trip in the same tab can never be
// confused for one another (even though in practice only one is ever in
// flight at a time — a single click starts a single navigation).

export type RecordCreateKind = 'customer' | 'vendor';

export const RETURN_TO_PARAM = 'returnTo';
export const NAME_PARAM = 'name';
/** Router-state key the Add page sets when it sends the user back. */
export const RECORD_CREATE_STATE_KEY = 'recordCreateReturn';

const STASH_KEY = 'stonesuite:record-create-return';

export interface RecordCreateStash<P = unknown> {
  kind: RecordCreateKind;
  returnTo: string;
  page: P;
}

export interface ResolvedRecordCreateReturn<P, R> {
  page: P;
  createdRef: R | null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/** Only same-origin, in-app paths — never `//host` or an absolute URL. */
export function isSafeReturnPath(path: string | null | undefined): path is string {
  return typeof path === 'string'
    && path.startsWith('/')
    && !path.startsWith('//')
    && !path.startsWith('/\\');
}

export function newRecordCreatePath(basePath: string, returnTo: string, name: string): string {
  const params = new URLSearchParams({ [RETURN_TO_PARAM]: returnTo });
  const trimmed = name.trim();
  if (trimmed) params.set(NAME_PARAM, trimmed);
  return `${basePath}?${params.toString()}`;
}

/** Router state for navigating back to the document — `createdRef` is null
 *  when the user cancelled out of the Add page. */
export function returnRouterState<R>(createdRef: R | null): Record<string, unknown> {
  return { [RECORD_CREATE_STATE_KEY]: { createdRef } };
}

/** Returns false when storage is unavailable (private mode, quota) so the
 *  caller can keep the user on the page instead of losing their work. */
export function writeStash<P>(stash: RecordCreateStash<P>): boolean {
  try {
    sessionStorage.setItem(STASH_KEY, JSON.stringify(stash));
    return true;
  } catch (err) {
    console.error('Failed to stash the document before creating a record', err);
    return false;
  }
}

export function readStash(): RecordCreateStash | null {
  try {
    const raw = sessionStorage.getItem(STASH_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed) || typeof parsed.returnTo !== 'string' || typeof parsed.kind !== 'string') return null;
    return { kind: parsed.kind as RecordCreateKind, returnTo: parsed.returnTo, page: parsed.page };
  } catch {
    // A corrupt or unreadable stash is treated as no stash — the document
    // simply opens fresh, which is what it would do without this feature.
    return null;
  }
}

export function clearStash(): void {
  try {
    sessionStorage.removeItem(STASH_KEY);
  } catch {
    // Storage unavailable — nothing was stashed, so nothing to clear.
  }
}

function readCreatedRef<R>(routerState: unknown): { returned: boolean; createdRef: R | null } {
  if (!isRecord(routerState) || !isRecord(routerState[RECORD_CREATE_STATE_KEY])) {
    return { returned: false, createdRef: null };
  }
  const candidate = routerState[RECORD_CREATE_STATE_KEY].createdRef;
  const valid = isRecord(candidate) && typeof candidate.id === 'string' && typeof candidate.name === 'string';
  return { returned: true, createdRef: valid ? (candidate as R) : null };
}

/**
 * Decides whether a document page mounting at `currentPath` should restore
 * the stash. It must be this page's stash, for the same `kind`, and the user
 * must have come back from the Add page — either via its Save/Cancel (router
 * state) or the browser's back button (a POP navigation). A fresh in-app
 * visit starts clean.
 */
export function resolveRecordCreateReturn<P, R>(
  stash: RecordCreateStash | null,
  kind: RecordCreateKind,
  currentPath: string,
  routerState: unknown,
  isHistoryPop: boolean,
): ResolvedRecordCreateReturn<P, R> | null {
  if (!stash || stash.kind !== kind || stash.returnTo !== currentPath) return null;
  const { returned, createdRef } = readCreatedRef<R>(routerState);
  if (!returned && !isHistoryPop) return null;
  return { page: stash.page as P, createdRef };
}

/** True when `term` exactly matches (case/whitespace-insensitively) one of
 *  the records already shown — used to hide "Create X" once the typed name
 *  is already in the list, not just close to it. Reused from the inventory
 *  item picker's identical rule (InventoryItem also has a `.name`), kept as
 *  its own copy here since the two pickers otherwise share nothing. */
export function hasExactName(records: { name: string }[], term: string): boolean {
  const needle = term.trim().toLowerCase();
  if (!needle) return false;
  return records.some((r) => r.name.trim().toLowerCase() === needle);
}
