import { useId, useState } from 'react';
import { createPortal } from 'react-dom';
import { toast } from 'sonner';
import { apiErrorMessage } from '@/api/tenantClient';
import { ErrorNote } from '@/components/tenant/ui';
import { textareaCls } from '@/components/crm/formUtils';
import { useInstallAppointmentMutations } from '@/hooks/useInstallAppointmentMutations';
import { useModalDialog } from '@/hooks/useModalDialog';
import { isStaleError } from '@/services/installScheduleService';
import type { Appointment } from '@/types/installSchedule';

interface Props {
  appointment: Appointment;
  /** Called on Back and after a successful cancel. */
  onClose: () => void;
  /** Called after the cancel succeeds, before `onClose`. */
  onCancelled?: () => void;
}

const REASON_MAX = 500;
const STALE_MESSAGE = 'Someone else changed this visit. Close this and reopen it to see the latest.';

/** Asks why a visit is being cancelled; the reason is required (1 to 500 characters). */
export function InstallCancelDialog({ appointment, onClose, onCancelled }: Props) {
  const [reason, setReason] = useState('');
  const { cancel } = useInstallAppointmentMutations();
  const ref = useModalDialog(() => !cancel.isPending && onClose());
  const titleId = useId();
  const reasonId = useId();
  const trimmed = reason.trim();

  function submit() {
    cancel.mutate(
      { id: appointment.id, input: { expectedVersion: appointment.version, reason: trimmed } },
      {
        onSuccess: (r) => {
          toast.success(r.emailSent || appointment.crew.length === 0 ? 'Visit cancelled.' : 'Visit cancelled. Some crew have no login and were not notified.');
          onCancelled?.();
          onClose();
        },
      },
    );
  }

  const error = cancel.error;
  return createPortal(
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/50" role="presentation">
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className="mx-4 w-full max-w-md rounded-xl bg-white p-5 shadow-2xl outline-none"
      >
        <h3 id={titleId} className="text-sm font-bold text-stone-900">
          Cancel visit {appointment.jobNumber}?
        </h3>
        <p className="mt-0.5 text-xs text-stone-500">The crew is told. The visit stays on the calendar, struck through.</p>
        <label htmlFor={reasonId} className="mt-3 block text-xs font-medium text-stone-600">
          Reason (required)
        </label>
        <textarea
          id={reasonId}
          value={reason}
          maxLength={REASON_MAX}
          rows={3}
          onChange={(e) => setReason(e.target.value)}
          className={textareaCls}
        />
        {error && (
          <div className="mt-2">
            <ErrorNote>{isStaleError(error) ? STALE_MESSAGE : apiErrorMessage(error, 'Failed to cancel the visit.')}</ErrorNote>
          </div>
        )}
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={cancel.isPending}
            className="rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-xs font-medium text-stone-600 hover:bg-stone-50 disabled:opacity-50"
          >
            Back
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={trimmed === '' || cancel.isPending}
            className="rounded-lg bg-destructive px-3 py-1.5 text-xs font-semibold text-white hover:bg-destructive/90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {cancel.isPending ? 'Cancelling…' : 'Cancel visit'}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
