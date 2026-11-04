import { useId, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { apiErrorMessage } from '@/api/tenantClient';
import { ErrorNote } from '@/components/tenant/ui';
import { useCrewOptions } from '@/hooks/useCrewOptions';
import { useIdempotencyKey } from '@/hooks/useIdempotencyKey';
import { useInstallAppointmentMutations } from '@/hooks/useInstallAppointmentMutations';
import { useUserPermissions } from '@/hooks/useUserPermissions';
import { formatDisplayDate } from '@/lib/dateUtils';
import { emptyForm, formFromAppointment, formProblem, toCreateBase, toUpdateInput } from '@/lib/installAppointmentForm';
import type { VisitForm } from '@/lib/installAppointmentForm';
import { fabricationService } from '@/services/fabricationService';
import { isConflictError, isStaleError } from '@/services/installScheduleService';
import type { Appointment, AppointmentWriteResult, ConflictResponse } from '@/types/installSchedule';
import { InstallConflictNotice } from './InstallConflictNotice';
import { InstallJobField } from './InstallJobField';
import { InstallVisitFields } from './InstallVisitFields';

interface Props {
  /** The visit being edited; absent when booking a new one. */
  appointment?: Appointment;
  /** Pre-chosen (and locked) fabrication job. */
  jobId?: string;
  /** The calendar day a new visit starts on. */
  defaultDate: string;
  actions: { onClose: () => void; onCancelVisit: () => void; onReload: () => void };
}

const STALE_MESSAGE = 'Someone else changed this visit. Reload to see the latest.';
const NO_LOGIN_MESSAGE = 'Saved. Some crew have no login and were not notified.';
const btn = 'rounded-lg px-3 py-1.5 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-50';

/** The body of the visit dialog: the form, its conflict and stale handling, and
 *  the Save / Cancel visit / Mark complete actions the caller's grants allow. */
export function InstallVisitForm({ appointment, jobId, defaultDate, actions }: Props) {
  const { onClose, onCancelVisit, onReload } = actions;
  const editing = Boolean(appointment);
  const { hasPermission, isLoading: permsLoading } = useUserPermissions();
  const canWrite = !permsLoading && hasPermission('install_appointment', editing ? 'update' : 'create');
  const canTransition = !permsLoading && hasPermission('install_appointment', 'transition');
  const live = !appointment || appointment.status === 'scheduled';

  const [form, setForm] = useState<VisitForm>(() =>
    appointment ? formFromAppointment(appointment) : emptyForm(defaultDate, jobId ?? ''),
  );
  const [jobLabel, setJobLabel] = useState('');
  const [conflict, setConflict] = useState<ConflictResponse | null>(null);
  const [stale, setStale] = useState(false);
  const [problem, setProblem] = useState('');
  const idPrefix = useId();
  const { keyFor, reset } = useIdempotencyKey();
  const { create, update, complete } = useInstallAppointmentMutations();
  const crew = useCrewOptions(canWrite);
  const lockedJobId = appointment?.fabricationJobId ?? jobId;
  const job = useQuery({
    queryKey: ['fabrication-job', lockedJobId],
    queryFn: () => fabricationService.getJob(lockedJobId as string),
    enabled: Boolean(lockedJobId),
  });
  const pending = create.isPending || update.isPending || complete.isPending;

  function change(next: VisitForm) {
    setForm(next);
    setConflict(null);
    setProblem('');
  }

  function done(r: AppointmentWriteResult) {
    reset();
    if (r.appointment.crew.length > 0 && !r.emailSent) toast.warning(NO_LOGIN_MESSAGE);
    else toast.success('Saved.');
    onClose();
  }

  function failed(err: unknown) {
    if (isConflictError(err) && err.response) setConflict(err.response.data);
    else if (isStaleError(err)) setStale(true);
    else setProblem(apiErrorMessage(err, 'Failed to save the visit.'));
  }

  function submit(acknowledge: boolean) {
    const invalid = formProblem(form);
    if (invalid) return setProblem(invalid);
    setProblem('');
    const handlers = { onSuccess: done, onError: failed };
    if (appointment) {
      update.mutate({ id: appointment.id, input: toUpdateInput(form, appointment.version, acknowledge) }, handlers);
      return;
    }
    // The key follows the request's content, not the acknowledgement, so
    // "Book anyway" is the same request the server may already have seen.
    const base = toCreateBase(form);
    create.mutate(
      { ...base, requestId: keyFor(JSON.stringify(base)), ...(acknowledge ? { acknowledgeConflicts: true } : {}) },
      handlers,
    );
  }

  function markComplete() {
    if (!appointment) return;
    complete.mutate({ id: appointment.id, input: { expectedVersion: appointment.version } }, { onSuccess: done, onError: failed });
  }

  const promised = job.data?.promisedInstallDate;
  const chosenLabel = appointment
    ? `${appointment.jobNumber} · ${appointment.customerName}`
    : jobId
      ? job.data ? `${job.data.jobNumber} · ${job.data.customer.name}` : 'Loading job…'
      : jobLabel;

  return (
    <form
      className="flex min-h-0 flex-1 flex-col"
      onSubmit={(e) => { e.preventDefault(); if (canWrite && live) submit(false); }}
    >
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto pr-1">
        {appointment?.status === 'cancelled' && (
          <ErrorNote role="status">Cancelled{appointment.cancelReason ? `: ${appointment.cancelReason}` : ''}</ErrorNote>
        )}
        <fieldset disabled={!canWrite || !live || pending} className="flex min-w-0 flex-col gap-4 border-0 p-0">
          <div>
            <span className="mb-1 block text-xs font-medium text-stone-600">Job</span>
            {editing || jobId ? (
              <p className="rounded-[10px] border border-stone-300 bg-stone-50 px-3 py-2 text-xs font-medium text-stone-800">{chosenLabel}</p>
            ) : (
              <InstallJobField
                chosen={form.jobId ? chosenLabel : ''}
                onPick={(j) => { setJobLabel(`${j.jobNumber} · ${j.customer.name}`); change({ ...form, jobId: j.id }); }}
                onClear={() => { setJobLabel(''); change({ ...form, jobId: '' }); }}
              />
            )}
            {promised && <p className="mt-1 text-xs text-stone-500">Promised install date: {formatDisplayDate(promised)}</p>}
          </div>
          <InstallVisitFields form={form} onChange={change} crewOptions={crew.data ?? []} idPrefix={idPrefix} />
        </fieldset>

        {conflict && (
          <InstallConflictNotice
            conflicts={conflict}
            busy={pending}
            onBookAnyway={() => submit(true)}
            onChangeTime={() => setConflict(null)}
          />
        )}
        {stale && (
          <div className="flex flex-wrap items-center gap-2">
            <ErrorNote>{STALE_MESSAGE}</ErrorNote>
            <button type="button" onClick={onReload} className={`${btn} border border-stone-300 text-stone-700 hover:bg-stone-50`}>
              Reload
            </button>
          </div>
        )}
        {problem && <ErrorNote>{problem}</ErrorNote>}
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-stone-100 pt-3">
        <div className="flex gap-2">
          {appointment && live && canTransition && (
            <>
              <button type="button" onClick={onCancelVisit} disabled={pending} className={`${btn} border border-destructive/40 text-destructive hover:bg-destructive/5`}>
                Cancel visit
              </button>
              <button type="button" onClick={markComplete} disabled={pending} className={`${btn} border border-stone-300 text-stone-700 hover:bg-stone-50`}>
                Mark complete
              </button>
            </>
          )}
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={onClose} className={`${btn} border border-stone-200 text-stone-600 hover:bg-stone-50`}>
            Close
          </button>
          {canWrite && live && (
            <button type="submit" disabled={pending || stale} className={`${btn} bg-brand text-stone-900 hover:bg-brand-hover`}>
              {pending ? 'Saving…' : editing ? 'Save changes' : 'Book visit'}
            </button>
          )}
        </div>
      </div>
    </form>
  );
}
