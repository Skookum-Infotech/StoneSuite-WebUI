import { useState } from 'react';
import { createPortal } from 'react-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ClipboardList } from 'lucide-react';
import { crmActivityService, type Activity, type ActivityInput, type ActivityType } from '@/services/crmActivityService';
import type { CRMWorkflowKey } from '@/services/crmService';
import { ACTIVITY_TYPES, ACTIVITY_TYPE_LABELS, toOccurredAtPayload, fromOccurredAtIso } from '@/lib/crmActivityForm';
import { apiErrorMessage } from '@/api/tenantClient';
import { useModalDialog } from '@/hooks/useModalDialog';
import { fieldCls, fieldLabelCls, textareaCls } from '@/components/crm/formUtils';
import { cn } from '@/lib/utils';

type Props = {
  workflowKey: CRMWorkflowKey;
  recordId: string;
  mode: 'create' | 'edit';
  activity?: Activity;
  onClose: () => void;
  onSaved: () => void;
};

// Create and edit share one dialog — the only difference is which mutation
// runs on submit and which values seed the form (see crmactivity/types.go's
// shared activityFields: create and update take the identical payload shape).
export function LogActivityDialog({ workflowKey, recordId, mode, activity, onClose, onSaved }: Props) {
  const queryClient = useQueryClient();
  const contentRef = useModalDialog(onClose);

  const [activityType, setActivityType] = useState<ActivityType>(activity?.activityType ?? 'call');
  const [occurredAt, setOccurredAt] = useState(() => fromOccurredAtIso(activity?.occurredAt ?? new Date().toISOString()));
  const [subject, setSubject] = useState(activity?.subject ?? '');
  const [body, setBody] = useState(activity?.body ?? '');

  const save = useMutation({
    mutationFn: () => {
      const input: ActivityInput = {
        activityType,
        occurredAt: toOccurredAtPayload(occurredAt),
        subject: subject.trim(),
        body: body.trim(),
      };
      return mode === 'edit' && activity
        ? crmActivityService.update(workflowKey, recordId, activity.id, input)
        : crmActivityService.create(workflowKey, recordId, input);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['crm-activities', recordId] });
      onSaved();
    },
  });

  const title = mode === 'edit' ? 'Edit activity' : 'Log activity';

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="log-activity-dialog-title"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div ref={contentRef} tabIndex={-1} className="mx-4 w-full max-w-sm rounded-xl bg-white p-6 shadow-2xl">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex size-9 flex-shrink-0 items-center justify-center rounded-full bg-stone-100">
            <ClipboardList className="size-4 text-stone-600" aria-hidden="true" />
          </div>
          <div>
            <h3 id="log-activity-dialog-title" className="text-sm font-bold text-stone-900">
              {title}
            </h3>
            <p className="text-xs text-stone-400 mt-0.5">Calls, emails, meetings, notes, and tasks.</p>
          </div>
        </div>

        <div className="space-y-3">
          <div>
            <span className={fieldLabelCls}>Type</span>
            <div className="mt-1.5 grid grid-cols-3 gap-1.5" role="group" aria-label="Activity type">
              {ACTIVITY_TYPES.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setActivityType(t)}
                  aria-pressed={activityType === t}
                  className={cn(
                    'rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition-colors',
                    activityType === t
                      ? 'border-accent-foreground/20 bg-accent text-accent-foreground'
                      : 'border-stone-200 bg-white text-stone-500 hover:border-stone-300 hover:text-stone-700',
                  )}
                >
                  {ACTIVITY_TYPE_LABELS[t]}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label htmlFor="activity-occurred-at" className={fieldLabelCls}>Occurred at</label>
            <input
              id="activity-occurred-at"
              type="datetime-local"
              value={occurredAt}
              onChange={(e) => setOccurredAt(e.target.value)}
              className={`${fieldCls} mt-1.5`}
              aria-label="Occurred at"
            />
          </div>

          <div>
            <label htmlFor="activity-subject" className={fieldLabelCls}>Subject</label>
            <input
              id="activity-subject"
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Optional subject"
              className={`${fieldCls} mt-1.5`}
              aria-label="Subject"
            />
          </div>

          <div>
            <label htmlFor="activity-body" className={fieldLabelCls}>Details</label>
            <textarea
              id="activity-body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Optional details…"
              rows={3}
              className={`${textareaCls} mt-1.5`}
              aria-label="Details"
            />
          </div>
        </div>

        {save.error && (
          <p role="alert" className="mt-3 text-xs text-destructive">
            {apiErrorMessage(save.error, `Failed to ${mode === 'edit' ? 'update' : 'log'} activity.`)}
          </p>
        )}

        <div className="flex justify-end gap-2 mt-4">
          <button
            type="button"
            onClick={onClose}
            disabled={save.isPending}
            className="rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-xs font-medium text-stone-600 hover:bg-stone-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => save.mutate()}
            disabled={save.isPending}
            className="rounded-lg bg-brand px-3 py-1.5 text-xs font-semibold text-stone-900 hover:bg-brand-hover disabled:opacity-50 disabled:cursor-not-allowed active:scale-95 transition-all"
          >
            {save.isPending ? 'Saving…' : mode === 'edit' ? 'Save changes' : 'Log activity'}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
