import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { CalendarCheck, Plus } from 'lucide-react';
import { apiErrorMessage } from '@/api/tenantClient';
import { ErrorNote, Spinner } from '@/components/tenant/ui';
import { fieldCls } from '@/components/crm/formUtils';
import { useCrewOptions } from '@/hooks/useCrewOptions';
import { useInstallAppointments } from '@/hooks/useInstallAppointments';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { useUserPermissions } from '@/hooks/useUserPermissions';
import { toISODate } from '@/lib/dateUtils';
import { appointmentsToCards } from '@/lib/installScheduleCards';
import {
  columnsFor, parseAnchor, parseView, rangeFor, rangeLabel, shiftAnchor, showsToday,
} from '@/lib/plannerCalendar';
import type { PlannerView } from '@/lib/plannerCalendar';
import { cardNoun } from '@/lib/plannerCards';
import { bucketByColumn } from '@/lib/plannerPlacement';
import { InstallAppointmentDialog } from './components/InstallAppointmentDialog';
import { PlannerMonthGrid } from './components/PlannerMonthGrid';
import { PlannerNavigator } from './components/PlannerNavigator';
import { PlannerPhoneCalendar } from './components/PlannerPhoneCalendar';
import { PlannerTimeGrid } from './components/PlannerTimeGrid';
import { PlannerViewSwitch } from './components/PlannerViewSwitch';

// The view, the date, the crew filter and the open visit live in the URL, so a
// view can be bookmarked or sent to a colleague and the back button behaves.
const PARAM_VIEW = 'view';
const PARAM_DATE = 'date';
const PARAM_CREW = 'crew';
const PARAM_APPOINTMENT = 'appointment';
const NEW_VISIT = 'new';
const STACKED_QUERY = '(max-width: 767px)';
const CALENDAR_LABEL = 'Install visits';

/** Calendar › Install Schedule: every booked template, install and service visit
 *  on the same calendar grids as the Activity Planner. Pressing a chip opens its
 *  card; the card's link, and "New visit", open the visit dialog. */
export default function InstallSchedulePage() {
  const [params, setParams] = useSearchParams();
  const { hasPermission, isLoading: permissionsLoading } = useUserPermissions();
  const stacked = useMediaQuery(STACKED_QUERY);
  // Write controls stay hidden while grants load, so they never flicker in.
  const canCreate = !permissionsLoading && hasPermission('install_appointment', 'create');
  const canUpdate = !permissionsLoading && hasPermission('install_appointment', 'update');

  const today = toISODate(new Date());
  const view = parseView(params.get(PARAM_VIEW));
  const anchor = parseAnchor(params.get(PARAM_DATE), today);
  const range = rangeFor(view, anchor);
  const columns = columnsFor(view, anchor, today);
  const crewParam = Number(params.get(PARAM_CREW));
  const crewId = Number.isInteger(crewParam) && crewParam > 0 ? crewParam : null;
  const openId = params.get(PARAM_APPOINTMENT);

  const { appointments, truncated, isLoading, isFetching, isPlaceholderData, error, refetch } =
    useInstallAppointments(range, crewId, !permissionsLoading);
  const crewOptions = useCrewOptions(canCreate || canUpdate);

  // A chip's link only names the visit; keep the rest of the view in it.
  const cards = useMemo(() => {
    const keep = new URLSearchParams(params);
    return appointmentsToCards(appointments).map((card) => {
      const id = new URLSearchParams(card.href.replace(/^\?/, '')).get(PARAM_APPOINTMENT) ?? '';
      keep.set(PARAM_APPOINTMENT, id);
      return { ...card, href: `?${keep.toString()}` };
    });
  }, [appointments, params]);
  const buckets = bucketByColumn(cards, columns);

  const crewChoices = useMemo(() => {
    const byId = new Map<number, string>();
    for (const o of crewOptions.data ?? []) byId.set(o.employeeId, o.name);
    for (const a of appointments) for (const c of a.crew) if (!byId.has(c.employeeId)) byId.set(c.employeeId, c.name);
    return [...byId].sort((x, y) => x[1].localeCompare(y[1]));
  }, [crewOptions.data, appointments]);

  const loading = permissionsLoading || isLoading;
  const settled = !loading && !error && !isPlaceholderData;

  // Stepping and picking refine the one place you are, so they replace the
  // history entry. Opening a day or a visit goes somewhere else (`replace: false`).
  function update(changes: Record<string, string | null>, replace = true) {
    const next = new URLSearchParams(params);
    for (const [key, value] of Object.entries(changes)) {
      if (value === null || value === '') next.delete(key);
      else next.set(key, value);
    }
    setParams(next, { replace });
  }

  const handleSelectDay = (date: string) => update({ [PARAM_VIEW]: 'day', [PARAM_DATE]: date }, false);

  function renderCalendar() {
    if (stacked) {
      return (
        <PlannerPhoneCalendar
          view={view}
          columns={columns}
          buckets={buckets}
          selected={anchor}
          onSelect={(date) => update({ [PARAM_DATE]: date })}
        />
      );
    }
    const key = `${view}:${range.from}:${crewId ?? 'all'}`;
    if (view === 'month') {
      return <PlannerMonthGrid key={key} columns={columns} buckets={buckets} label={CALENDAR_LABEL} onSelectDay={handleSelectDay} />;
    }
    return (
      <PlannerTimeGrid
        key={key}
        columns={columns}
        buckets={buckets}
        label={CALENDAR_LABEL}
        timed
        onSelectDay={view === 'day' ? undefined : handleSelectDay}
      />
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex min-h-0 flex-1 flex-col p-4 sm:p-6 3xl:p-10 4xl:p-14">
        <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent ring-1 ring-accent-foreground/10">
              <CalendarCheck className="size-5 text-accent-foreground" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <h1 className="text-xl font-bold tracking-tight text-stone-900">Install Schedule</h1>
              <p className="flex min-h-5 flex-wrap items-center gap-x-3 text-sm text-stone-500" aria-live="polite">
                {settled && (
                  <span>
                    <span className="font-semibold text-stone-900">{appointments.length}</span>{' '}
                    {cardNoun('appointment', appointments.length)} in this view
                  </span>
                )}
                {isFetching && !loading && <span>Updating…</span>}
              </p>
            </div>
          </div>

          <div className="flex w-full flex-wrap items-center gap-2 md:w-auto">
            <label className="sr-only" htmlFor="install-crew-filter">Crew</label>
            <select
              id="install-crew-filter"
              value={crewId ?? ''}
              onChange={(e) => update({ [PARAM_CREW]: e.target.value })}
              className={`${fieldCls} w-auto`}
            >
              <option value="">All crew</option>
              {crewChoices.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
            </select>
            <PlannerNavigator
              span={{
                label: rangeLabel(view, anchor),
                date: anchor,
                unit: view,
                showsToday: stacked ? anchor === today : showsToday(view, anchor, today),
              }}
              onStep={(step) => update({ [PARAM_DATE]: step === 0 ? today : shiftAnchor(view, anchor, step) })}
              onPick={(date) => update({ [PARAM_DATE]: date })}
            />
            <PlannerViewSwitch view={view} onChange={(next: PlannerView) => update({ [PARAM_VIEW]: next })} />
            {canCreate && (
              <button
                type="button"
                onClick={() => update({ [PARAM_APPOINTMENT]: NEW_VISIT }, false)}
                className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-brand px-3 py-2 text-sm font-semibold text-stone-900 hover:bg-brand-hover md:w-auto"
              >
                <Plus className="size-4" aria-hidden="true" />
                New visit
              </button>
            )}
          </div>
        </div>

        <section aria-busy={isFetching} className="mt-4 flex min-h-0 flex-1 flex-col gap-2 border-t border-stone-100 pt-3 sm:mt-5 sm:pt-4">
          {error ? (
            <div className="flex flex-wrap items-center gap-3">
              <ErrorNote>{apiErrorMessage(error, 'Failed to load the schedule.')}</ErrorNote>
              <button
                type="button"
                onClick={() => void refetch()}
                className="rounded-lg border border-stone-300 bg-white px-3 py-1.5 text-sm font-medium text-stone-700 shadow-sm transition-colors hover:bg-stone-50"
              >
                Try again
              </button>
            </div>
          ) : loading ? (
            <Spinner label="Loading schedule…" />
          ) : (
            <>
              {truncated && (
                <p role="status" className="rounded-lg bg-amber-50 px-3 py-2 text-xs font-medium text-amber-700">
                  Only the first part of this window is shown. Switch to Week or Day to see everything.
                </p>
              )}
              {renderCalendar()}
              {settled && cards.length === 0 && <p className="text-xs text-stone-500">No visits booked in this view.</p>}
            </>
          )}
        </section>
      </div>

      {openId && (
        <InstallAppointmentDialog
          mode={openId === NEW_VISIT ? 'create' : 'edit'}
          appointmentId={openId === NEW_VISIT ? undefined : openId}
          defaultDate={anchor}
          onClose={() => update({ [PARAM_APPOINTMENT]: null })}
        />
      )}
    </div>
  );
}
