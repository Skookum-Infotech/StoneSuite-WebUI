// sessionStorage draft of the review form, keyed by extraction id, so a reload
// or re-login in the same tab keeps the reviewer's edits. Every access is
// wrapped: storage can be unavailable (private mode, blocked site data).

const DRAFT_PREFIX = 'so-doc-draft:';

/** sessionStorage key of the draft for an extraction. */
export function draftKey(extractionId: string): string {
  return `${DRAFT_PREFIX}${extractionId}`;
}

/** Reads the saved draft, or null when there is none or it can't be parsed. */
export function readDraft<S>(extractionId: string): S | null {
  try {
    const raw = window.sessionStorage.getItem(draftKey(extractionId));
    return raw ? (JSON.parse(raw) as S) : null;
  } catch {
    return null;
  }
}

/** Saves the draft; silently skipped when storage is unavailable or full. */
export function writeDraft(extractionId: string, state: unknown): void {
  try {
    window.sessionStorage.setItem(draftKey(extractionId), JSON.stringify(state));
  } catch {
    // Draft persistence is a convenience only.
  }
}

/** Removes the draft. */
export function removeDraft(extractionId: string): void {
  try {
    window.sessionStorage.removeItem(draftKey(extractionId));
  } catch {
    // Nothing to clean up when storage is unavailable.
  }
}

/** Removes every review draft in this tab (called on logout / workspace switch so
 *  one user's unsaved values never surface for the next). */
export function clearAllDrafts(): void {
  try {
    const keys: string[] = [];
    for (let i = 0; i < window.sessionStorage.length; i += 1) {
      const k = window.sessionStorage.key(i);
      if (k?.startsWith(DRAFT_PREFIX)) keys.push(k);
    }
    keys.forEach((k) => window.sessionStorage.removeItem(k));
  } catch {
    // Nothing to clean up when storage is unavailable.
  }
}
