const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Fallback label for a breadcrumb path segment that has no explicit entry in
// useBreadcrumbStore (record IDs get a human label pushed there once they load).
// Route segments are kebab-case or snake_case (e.g. "sales_order",
// "record-numbering") — both delimiters must become spaces, and every word
// needs its own capital letter, not just the first character of the string.
export function formatBreadcrumbSegment(segment: string): string {
  if (segment === 'crm') return 'CRM';
  if (UUID_PATTERN.test(segment)) return 'Details';

  return segment
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}
