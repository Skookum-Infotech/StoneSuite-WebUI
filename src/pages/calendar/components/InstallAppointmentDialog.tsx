import { useId, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { apiErrorMessage } from '@/api/tenantClient';
import { ErrorNote, Spinner } from '@/components/tenant/ui';
import { useInstallAppointment } from '@/hooks/useInstallAppointment';
import { useModalDialog } from '@/hooks/useModalDialog';
import { toISODate } from '@/lib/dateUtils';
import { InstallCancelDialog } from './InstallCancelDialog';
import { InstallVisitForm } from './InstallVisitForm';

interface Props {
  mode: 'create' | 'edit';
  /** The visit to edit (edit mode). */
  appointmentId?: string;
  /** Pre-chosen fabrication job (create mode, opened from a job). */
  jobId?: string;
  onClose: () => void;
  /** The calendar day a new visit starts on; today when omitted. */
  defaultDate?: string;
}

/** Book or edit a site visit. A hand-rolled portal dialog: Esc closes it, Tab
 *  stays inside, focus returns to whatever opened it. The cancel-reason dialog
 *  stacks on top of it. */
export function InstallAppointmentDialog({ mode, appointmentId, jobId, onClose, defaultDate }: Props) {
  const detail = useInstallAppointment(mode === 'edit' ? appointmentId : undefined);
  const [cancelling, setCancelling] = useState(false);
  // Esc belongs to the topmost dialog only.
  const ref = useModalDialog(() => { if (!cancelling) onClose(); });
  const titleId = useId();
  const appointment = detail.data;

  function body() {
    if (mode === 'edit' && detail.isLoading) return <Spinner label="Loading visit…" />;
    if (mode === 'edit' && !appointment) {
      return (
        <div className="flex flex-col gap-3">
          <ErrorNote>{apiErrorMessage(detail.error, 'This visit could not be loaded.')}</ErrorNote>
          <button type="button" onClick={onClose} className="self-start rounded-lg border border-stone-200 px-3 py-1.5 text-xs font-medium text-stone-600 hover:bg-stone-50">
            Close
          </button>
        </div>
      );
    }
    return (
      <>
        <InstallVisitForm
          key={detail.dataUpdatedAt}
          appointment={appointment}
          jobId={jobId}
          defaultDate={defaultDate ?? toISODate(new Date())}
          actions={{ onClose, onCancelVisit: () => setCancelling(true), onReload: () => void detail.refetch() }}
        />
      </>
    );
  }

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-[2px]" role="presentation">
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className="mx-4 flex max-h-[90vh] w-full max-w-xl flex-col rounded-xl bg-white p-5 shadow-2xl outline-none max-sm:mx-0 max-sm:h-full max-sm:max-h-none max-sm:max-w-none max-sm:rounded-none"
      >
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 id={titleId} className="text-sm font-bold text-stone-900">
            {mode === 'edit' ? 'Edit visit' : 'New visit'}
          </h2>
          <button type="button" onClick={onClose} aria-label="Close dialog" className="rounded-md p-1 text-stone-500 hover:bg-stone-100">
            <X className="size-4" aria-hidden="true" />
          </button>
        </div>
        {body()}
      </div>
      {cancelling && appointment && (
        <InstallCancelDialog appointment={appointment} onClose={() => setCancelling(false)} onCancelled={onClose} />
      )}
    </div>,
    document.body,
  );
}
