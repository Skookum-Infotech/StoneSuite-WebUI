import { useSearchParams } from 'react-router-dom';
import { CalendarRange } from 'lucide-react';
import { apiErrorMessage } from '@/api/tenantClient';
import { ErrorNote, Spinner } from '@/components/tenant/ui';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { usePlannerEvents } from '@/hooks/usePlannerEvents';
import { useUserPermissions } from '@/hooks/useUserPermissions';
import { toISODate } from '@/lib/dateUtils';
import {
  PLANNER_ACTIVITIES,
  PLANNER_PANEL_ID,
  bucketByColumn,
  columnsFor,
  parseAnchor,
  parseView,
  plannerTabId,
  rangeFor,
  rangeLabel,
  shiftAnchor,
  showsToday,
} from '@/lib/plannerCalendar';
import type { PlannerView } from '@/lib/plannerCalendar';
import { cardNoun } from '@/lib/plannerCards';
import { PlannerActivityTabs } from './components/PlannerActivityTabs';
import { PlannerAgenda } from './components/PlannerAgenda';
import { PlannerGrid } from './components/PlannerGrid';
import { PlannerNavigator } from './components/PlannerNavigator';
import { PlannerViewSwitch } from './components/PlannerViewSwitch';

// The tab, the columns and the date live in the URL, so a view can be
// bookmarked or sent to a colleague and the back button behaves.
const PARAM_ACTIVITY = 'activity';
const PARAM_VIEW = 'view';
const PARAM_DATE = 'date';

// Below Tailwind's `md` a sideways-scrolling grid is a poor fit for the screen,
// so the calendar becomes a day-by-day list. Chosen in JS because it swaps the
// whole component (one tree mounted, not two with one hidden).
const STACKED_QUERY = '(max-width: 767px)';

const INVOICE_NOTE =
  'Invoices made from an order are listed on their due date. Void invoices, and invoices with no due date, are not shown.';

/** Calendar › Activity Planner: every order's planned activity laid out by day,
 *  one activity at a time, as stacked job cards that link to their order.
 *
 *  Type scale for the whole page: `text-xl` for the title, `text-sm` for
 *  controls and headings, `text-xs` for secondary detail. */
export default function ActivityPlannerPage() {
  const [params, setParams] = useSearchParams();
  const { hasPermission, isLoading: permissionsLoading } = useUserPermissions();
  const stacked = useMediaQuery(STACKED_QUERY);

  // The Invoicing tab lists invoices, so it needs invoice:read on top of the
  // sales_order:read that opens the page. Optimistic while grants load, like
  // the sidebar, so the tab doesn't flicker away.
  const canSeeInvoices = permissionsLoading || hasPermission('invoice', 'read');
  const activities = PLANNER_ACTIVITIES.filter((a) => a.source !== 'invoice' || canSeeInvoices);
  const activity = activities.find((a) => a.key === params.get(PARAM_ACTIVITY)) ?? activities[0];

  const today = toISODate(new Date());
  const view = parseView(params.get(PARAM_VIEW));
  const anchor = parseAnchor(params.get(PARAM_DATE), today);
  const range = rangeFor(view, anchor);
  // Invoices carry a due date but no time of day, so the Day view has no hours to offer.
  const timed = activity.source === 'schedule';
  const columns = columnsFor(view, anchor, today, timed);

  const { cards, truncated, isLoading, isFetching, isPlaceholderData, error, refetch } = usePlannerEvents(
    activity,
    range,
    !permissionsLoading,
  );
  const buckets = bucketByColumn(cards, view, columns, timed);
  const overdue = cards.filter((c) => c.overdue).length;
  const loading = permissionsLoading || isLoading;
  // Counts are only worth stating once the cards on hand are the window asked
  // for, not the previous one carried across while it loads.
  const settled = !loading && !error && !isPlaceholderData;
  const kind = activity.source === 'invoice' ? 'invoice' : 'schedule';

  function update(changes: Record<string, string>) {
    const next = new URLSearchParams(params);
    for (const [key, value] of Object.entries(changes)) next.set(key, value);
    setParams(next, { replace: true });
  }

  function handleStep(step: -1 | 0 | 1) {
    update({ [PARAM_DATE]: step === 0 ? today : shiftAnchor(view, anchor, step) });
  }

  function handleViewChange(next: PlannerView) {
    update({ [PARAM_VIEW]: next });
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex min-h-0 flex-1 flex-col p-4 sm:p-6 3xl:p-10 4xl:p-14">
        {/* The toolbar sits beside the title where there is room (about 1280px and
            up) and wraps beneath it where there isn't. */}
        <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent ring-1 ring-accent-foreground/10">
              <CalendarRange className="size-5 text-accent-foreground" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <h1 className="text-xl font-bold tracking-tight text-stone-900">Activity Planner</h1>
              <p className="flex min-h-5 flex-wrap items-center gap-x-3 text-sm text-stone-500" aria-live="polite">
                {settled && (
                  <>
                    <span>
                      <span className="font-semibold text-stone-900">{cards.length}</span>{' '}
                      {cardNoun(kind, cards.length)} in this view
                    </span>
                    {overdue > 0 && <span className="font-semibold text-destructive">{overdue} overdue</span>}
                  </>
                )}
                {isFetching && !loading && <span>Updating…</span>}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <PlannerNavigator
              span={{
                label: rangeLabel(view, anchor),
                date: anchor,
                unit: view,
                showsToday: showsToday(view, anchor, today),
              }}
              onStep={handleStep}
              onPick={(date) => update({ [PARAM_DATE]: date })}
            />
            <PlannerViewSwitch view={view} onChange={handleViewChange} />
          </div>
        </div>

        <div className="mt-4 flex min-h-0 flex-1 flex-col gap-3 border-t border-stone-100 pt-3 sm:mt-5 sm:pt-4">
          <PlannerActivityTabs
            activities={activities}
            activeKey={activity.key}
            onSelect={(key) => update({ [PARAM_ACTIVITY]: key })}
          />

          <section
            id={PLANNER_PANEL_ID}
            role="tabpanel"
            aria-labelledby={plannerTabId(activity.key)}
            aria-busy={isFetching}
            className="flex min-h-0 flex-1 flex-col gap-2"
          >
            {error ? (
              <div className="flex flex-wrap items-center gap-3">
                <ErrorNote>{apiErrorMessage(error, 'Failed to load the calendar.')}</ErrorNote>
                <button
                  type="button"
                  onClick={() => void refetch()}
                  className="rounded-lg border border-stone-300 bg-white px-3 py-1.5 text-sm font-medium text-stone-700 shadow-sm transition-colors hover:bg-stone-50"
                >
                  Try again
                </button>
              </div>
            ) : loading ? (
              <Spinner label="Loading calendar…" />
            ) : (
              <>
                {truncated && (
                  <p role="status" className="rounded-lg bg-amber-50 px-3 py-2 text-xs font-medium text-amber-700">
                    Only the first part of this window is shown. Switch to Week or Day to see everything.
                  </p>
                )}
                {stacked ? (
                  <PlannerAgenda columns={columns} buckets={buckets} rowLabel={activity.label} />
                ) : (
                  // Remounted for each window, so its scroll position and any
                  // opened "Show more" start fresh.
                  <PlannerGrid
                    key={`${activity.key}:${view}:${range.from}`}
                    columns={columns}
                    buckets={buckets}
                    rowLabel={activity.label}
                  />
                )}
                {settled && cards.length === 0 && (
                  <p className="text-xs text-stone-500">Nothing scheduled for {activity.label} in this view.</p>
                )}
                {activity.source === 'invoice' && <p className="text-xs text-stone-500">{INVOICE_NOTE}</p>}
              </>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
