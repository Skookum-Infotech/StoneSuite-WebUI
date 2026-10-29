/** True only for absolute http(s) URLs — the sole schemes safe to render as an
 *  external `href` from user-entered data (rejects `javascript:`, `data:`, …). */
export function isHttpUrl(value: string | null | undefined): value is string {
  if (!value) return false;
  try {
    const { protocol } = new URL(value);
    return protocol === 'http:' || protocol === 'https:';
  } catch {
    return false;
  }
}
