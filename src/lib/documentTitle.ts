import { formatBreadcrumbSegment } from '@/lib/breadcrumb';

/** The app name every browser-tab title ends with, and the title shown outside any page. */
export const APP_TITLE = 'Stone Suite';

const TITLE_SEPARATOR = ' · ';
// Enough to tell "New · Invoice" from "New · Payment" without turning the tab into a sentence.
const TITLE_SEGMENT_COUNT = 2;

/** Browser-tab title for a URL path: the last two breadcrumb labels, most specific first,
 *  then the app name — e.g. "/sales/invoice/new" → "New · Invoice · Stone Suite". `labels`
 *  holds the human names pages push for record ids; a path with no segments is just the app name. */
export function buildDocumentTitle(pathname: string, labels: Record<string, string>): string {
  const segments = pathname.split('/').filter(Boolean);
  const parts = segments
    .slice(-TITLE_SEGMENT_COUNT)
    .map((segment) => labels[segment] ?? formatBreadcrumbSegment(segment))
    .reverse();

  return [...parts, APP_TITLE].join(TITLE_SEPARATOR);
}
