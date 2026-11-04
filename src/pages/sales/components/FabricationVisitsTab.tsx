import { useState } from 'react';
import { apiErrorMessage } from '@/api/tenantClient';
import { ErrorNote, Spinner } from '@/components/tenant/ui';
import { useJobInstallAppointments } from '@/hooks/useJobInstallAppointments';
import { useUserPermissions } from '@/hooks/useUserPermissions';
import { InstallAppointmentDialog } from '@/pages/calendar/components/InstallAppointmentDialog';
import { formatDisplayDate } from '@/lib/dateUtils';
import { PLANNER_CLOCK } from '@/lib/plannerPlacement';
import { formatWallClock } from '@/lib/salesOrderSchedule';
import type { Appointment } from '@/types/installSchedule';

const VISIT_LABELS: Record<Appointment['visitType'], string> = { template: 'Template', install: 'Install', service: 'Service' };
const STATUS_LABELS: Record<Appointment['status'], string> = { scheduled: 'Scheduled', completed: 'Completed', cancelled: 'Cancelled' };
const EMPTY_COPY = 'No visits booked for this job.';

function whenOf(a: Appointment): string {
  if (!a.allDay) return formatWallClock(a.startLocal, PLANNER_CLOCK);
  return a.localEndDate === a.localStartDate
    ? `${formatDisplayDate(a.localStartDate)} (all day)`
    : `${formatDisplayDate(a.localStartDate)} to ${formatDisplayDate(a.localEndDate)} (all day)`;
}

type DialogState = { mode: 'create' } | { mode: 'edit'; id: string } | null;

/** Visits tab on a fabrication job: the job's site visits and a way to book one.
 *  Renders nothing without `install_appointment:read`. */
export function FabricationVisitsTab({ jobId }: { jobId: string }) {
  const { hasPermission, isLoading: permissionsLoading } = useUserPermissions();
  const canRead = !permissionsLoading && hasPermission('install_appointment', 'read');
  const canCreate = hasPermission('install_appointment', 'create');
  const visits = useJobInstallAppointments(jobId, canRead);
  const [dialog, setDialog] = useState<DialogState>(null);

  if (!canRead) return null;

  function body() {
    if (visits.isLoading) return <Spinner label="Loading visits…" />;
    if (visits.error) {
      return (
        <div className="flex flex-col gap-2">
          <ErrorNote>{apiErrorMessage(visits.error, 'Visits could not be loaded.')}</ErrorNote>
          <button type="button" onClick={() => void visits.refetch()} className="self-start rounded-lg border border-stone-200 px-3 py-1.5 text-xs font-medium text-stone-600 hover:bg-stone-50">
            Try again
          </button>
        </div>
      );
    }
    const items = visits.data ?? [];
    if (items.length === 0) return <p className="text-sm text-stone-500">{EMPTY_COPY}</p>;
    return (
      <ul className="divide-y divide-stone-200 rounded-xl border border-stone-200 bg-white">
        {items.map((a) => (
          <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
            <div className="min-w-0">
              <p className={a.status === 'cancelled' ? 'text-sm font-medium text-stone-500 line-through' : 'text-sm font-medium text-stone-900'}>
                {VISIT_LABELS[a.visitType]} · {whenOf(a)}
              </p>
              <p className="text-xs text-stone-500">
                {STATUS_LABELS[a.status]} · {a.crew.length === 0 ? 'No crew' : a.crew.map((c) => c.name).join(', ')}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setDialog({ mode: 'edit', id: a.id })}
              aria-label={`Open ${VISIT_LABELS[a.visitType].toLowerCase()} visit, ${whenOf(a)}`}
              className="rounded-lg border border-stone-200 px-3 py-1.5 text-xs font-medium text-stone-600 hover:bg-stone-50"
            >
              Open
            </button>
          </li>
        ))}
      </ul>
    );
  }

  return (
    <section className="space-y-3" aria-label="Visits">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-stone-900">Visits</h2>
        {canCreate && (
          <button type="button" onClick={() => setDialog({ mode: 'create' })} className="rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90">
            Book visit
          </button>
        )}
      </div>
      {body()}
      {dialog && (
        <InstallAppointmentDialog
          mode={dialog.mode}
          appointmentId={dialog.mode === 'edit' ? dialog.id : undefined}
          jobId={dialog.mode === 'create' ? jobId : undefined}
          onClose={() => setDialog(null)}
        />
      )}
    </section>
  );
}
