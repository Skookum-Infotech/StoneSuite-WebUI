import { Fragment } from 'react';
import { Link, type RouteObject } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatBreadcrumbSegment, isRegisteredPath } from '@/lib/breadcrumb';

interface BreadcrumbsProps {
  segments: string[];
  labels: Record<string, string>;
  routes: RouteObject[];
}

// Approved design (DESIGN.md §5 Navigation): 13px regular gray links, the
// current page 13px medium in the strongest ink.
const CRUMB_LINK_CLASS = 'rounded-sm text-ink-muted underline-offset-2 transition-colors hover:text-ink-strong hover:underline dark:hover:text-stone-200';

export function Breadcrumbs({ segments, labels, routes }: BreadcrumbsProps) {
  return (
    <nav
      aria-label="Breadcrumb"
      className="px-4 pt-3 pb-1 sm:px-6 sm:pt-4 3xl:px-12 3xl:pt-5 4xl:px-16 text-field text-ink-muted"
    >
      <ol className="flex flex-wrap items-center gap-1.5">
        <li>
          <Link to="/" className={CRUMB_LINK_CLASS}>Home</Link>
        </li>
        {segments.map((segment, index) => {
          const url = `/${segments.slice(0, index + 1).join('/')}`;
          const isLast = index === segments.length - 1;
          // Only crumbs whose URL is a real page are links — group prefixes like
          // /finance have none, and would land on the 404 route.
          const isClickable = !isLast && isRegisteredPath(routes, url);
          const label = labels[segment] ?? formatBreadcrumbSegment(segment);
          return (
            <Fragment key={url}>
              <li aria-hidden="true" className="flex">
                <ChevronRight className="size-3 xl:size-3.5 text-ink-faint shrink-0" />
              </li>
              <li>
                {isClickable ? (
                  <Link to={url} className={CRUMB_LINK_CLASS}>{label}</Link>
                ) : (
                  <span
                    aria-current={isLast ? 'page' : undefined}
                    className={cn(isLast ? 'font-medium text-ink-strong dark:text-stone-300' : 'text-ink-muted')}
                  >
                    {label}
                  </span>
                )}
              </li>
            </Fragment>
          );
        })}
      </ol>
    </nav>
  );
}
