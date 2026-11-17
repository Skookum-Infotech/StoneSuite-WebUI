import { isRouteErrorResponse, Link, useRouteError } from 'react-router-dom';
import { cn } from '@/lib/utils';

import { buttonVariants } from '@/components/ui/button';
const NOT_FOUND_STATUS = 404;
const LOGO_SRC = '/logo-dark.png';

/** Branded fallback for both a router `errorElement` (a crashed route) and the
 *  catch-all `*` route (an unknown URL). Replaces React Router's built-in
 *  developer screen, which shows a stack trace to end users.
 *  `embedded` is for use inside MainLayout's outlet: no full-screen backdrop
 *  or logo, since the app shell already provides the chrome. */
export default function RouteErrorPage({
  notFound = false,
  embedded = false,
}: {
  notFound?: boolean;
  embedded?: boolean;
}) {
  const error = useRouteError();
  const isNotFound = notFound || (isRouteErrorResponse(error) && error.status === NOT_FOUND_STATUS);
  // Support can match this against server/browser logs; shown only for crashes.
  const reference = `${new Date().toISOString()} ${window.location.pathname}`;

  return (
    <div
      className={cn(
        'flex items-center justify-center px-4',
        embedded ? 'min-h-[60vh]' : 'min-h-screen bg-stone-100',
      )}
    >
      <div
        role={isNotFound ? undefined : 'alert'}
        className="w-full max-w-md rounded-2xl border border-stone-200 bg-white p-8 text-center shadow-sm"
      >
        {!embedded && (
          <img src={LOGO_SRC} alt="Stone Suite logo" className="mx-auto mb-5 h-16 w-auto object-contain" />
        )}
        <h1 className="type-page-title">
          {isNotFound ? "We couldn't find that page" : 'Something went wrong on this page'}
        </h1>
        <p className="mt-2 text-sm text-stone-600">
          {isNotFound
            ? 'The link may be old or mistyped.'
            : 'Try reloading. If it keeps happening, send support the reference below.'}
        </p>
        {!isNotFound && (
          <p className="mt-2 break-all font-mono text-xs text-stone-600">Ref: {reference}</p>
        )}
        <div className="mt-6 flex justify-center gap-3">
          {!isNotFound && (
            <button
              type="button"
              aria-label="Reload this page"
              onClick={() => window.location.reload()}
              className={buttonVariants({ variant: 'outline' })}
            >
              Reload
            </button>
          )}
          <Link
            to="/dashboard"
            aria-label="Go to dashboard"
            className={buttonVariants()}
          >
            Go to dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
