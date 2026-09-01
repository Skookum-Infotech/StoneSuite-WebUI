// Resolves a status code to its display label using a module's existing
// STATUS_CODES list, so the instant "you just did this" toast shown after a
// transition mutation always matches what the status pill would show.
export function statusToastLabel(codes: { code: string; label: string }[], code: string): string {
  return codes.find((s) => s.code === code)?.label ?? code;
}
