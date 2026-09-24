import { matchRoutes, type RouteObject } from 'react-router-dom';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// The router's trailing "404 - Not Found" route. A URL that only matches this
// has no page of its own.
const CATCH_ALL_ROUTE_PATH = '*';

// Whether `path` resolves to a real page in `routes`. Breadcrumb crumbs are
// built from every prefix of the current URL, but not every prefix is a page:
// "/finance" is only a sidebar group, and "/config/roles/<id>" only has an
// "/edit" child. Linking such a crumb lands the user on the catch-all 404.
export function isRegisteredPath(routes: RouteObject[], path: string): boolean {
  const matches = matchRoutes(routes, path);
  const leaf = matches?.[matches.length - 1];

  return leaf !== undefined && leaf.route.path !== CATCH_ALL_ROUTE_PATH;
}

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
