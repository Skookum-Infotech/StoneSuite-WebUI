/** Query-string key carrying the id of the record an Add page copies from. */
export const COPY_SOURCE_PARAM = 'copyFrom';

const COPY_MARKER = '(Copy)';
const COPY_SOURCE_ID_PATTERN = /^[A-Za-z0-9_-]+$/;

/** Whether `id` is shaped like a record id. The value comes from the URL and is
 *  placed in an API path, so anything else (slashes, dots, query characters) is
 *  refused rather than sent. */
export function isCopySourceId(id: string): boolean {
  return COPY_SOURCE_ID_PATTERN.test(id);
}

/** Add-page URL that opens pre-filled from the record `sourceId`. */
export function copyPath(addPath: string, sourceId: string): string {
  return `${addPath}?${COPY_SOURCE_PARAM}=${encodeURIComponent(sourceId)}`;
}

/** Add-page subtitle shown while a copy of `sourceNumber` is being edited. */
export function copySubtitle(sourceNumber: string): string {
  return `Copied from ${sourceNumber}. Nothing is created until you save.`;
}

/** Puts `keys` back to their Add-form default ('' when a fresh form leaves the
 *  field unset), so a copy never inherits what belongs to the original alone. */
export function resetCopiedFields(
  data: Record<string, unknown>,
  defaults: Record<string, unknown>,
  keys: readonly string[],
): Record<string, unknown> {
  const next = { ...data };
  for (const key of keys) next[key] = defaults[key] ?? '';
  return next;
}

/** Name for a copy: the original's with " (Copy)" appended, never doubled. */
export function copiedName(name: string): string {
  const trimmed = name.trim();
  if (!trimmed || trimmed.endsWith(COPY_MARKER)) return trimmed;
  return `${trimmed} ${COPY_MARKER}`;
}
