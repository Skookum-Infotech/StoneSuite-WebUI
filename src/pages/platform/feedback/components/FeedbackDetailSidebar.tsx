import { Select } from '@/components/ui/select';
import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { FileDown, Loader2 } from 'lucide-react';
import { feedbackAdminService } from '@/services/feedbackAdminService';
import { apiErrorMessage } from '@/api/tenantClient';
import { fieldCls, fieldLabelCls, textareaCls } from '@/components/crm/formUtils';
import {
  FEEDBACK_PRIORITY_LABELS,
  FEEDBACK_STATUS_LABELS,
  MAX_DESCRIPTION_LENGTH,
  type AssigneeCandidate,
} from '@/lib/feedback';
import { cn } from '@/lib/utils';
import type { FeedbackAdminPatch, FeedbackPriority, FeedbackStatus, FeedbackTicket } from '@/types/feedback';
import { FeedbackAssigneePicker } from './FeedbackAssigneePicker';

import { buttonVariants } from '@/components/ui/button';
interface Props {
  ticket: FeedbackTicket;
  assigneeCandidates: AssigneeCandidate[];
  onExportPdf: () => void;
  exportingPdf: boolean;
  exportPdfError: string | null;
}

// Quick Actions sidebar: status/priority/assignment controls (each PATCHes
// immediately on change — no separate Save step, matching how single-field
// admin controls behave elsewhere in this app), the internal-notes
// scratchpad, and Export PDF.
export function FeedbackDetailSidebar({ ticket, assigneeCandidates, onExportPdf, exportingPdf, exportPdfError }: Props) {
  const queryClient = useQueryClient();
  const [notes, setNotes] = useState(ticket.internalNotes ?? '');
  const [notesDirty, setNotesDirty] = useState(false);

  const patchMutation = useMutation({
    mutationFn: (patch: FeedbackAdminPatch) => feedbackAdminService.patch(ticket.id, patch),
    onSuccess: (updated) => {
      queryClient.setQueryData(['platform-feedback-detail', ticket.id], (prev: unknown) =>
        prev && typeof prev === 'object' ? { ...prev, ticket: updated } : prev,
      );
      void queryClient.invalidateQueries({ queryKey: ['platform-feedback'] });
      void queryClient.invalidateQueries({ queryKey: ['platform-feedback-stats'] });
    },
  });

  const handleSaveNotes = (): void => {
    patchMutation.mutate({ internalNotes: notes }, { onSuccess: () => setNotesDirty(false) });
  };

  return (
    <div className="space-y-4">
      <div className="mb-4 space-y-3 rounded-xl border border-stone-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-white/[0.03]">
        <p className="type-card-title">Quick Actions</p>

        <div>
          <label htmlFor="fb-status" className={fieldLabelCls}>Status</label>
          <Select
            id="fb-status"
            value={ticket.status}
            onChange={(e) => patchMutation.mutate({ status: e.target.value as FeedbackStatus })}
            disabled={patchMutation.isPending}
            className={cn(fieldCls, 'mt-1')}
          >
            {Object.entries(FEEDBACK_STATUS_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </Select>
        </div>

        <div>
          <label htmlFor="fb-priority" className={fieldLabelCls}>Priority</label>
          <Select
            id="fb-priority"
            value={ticket.priority}
            onChange={(e) => patchMutation.mutate({ priority: e.target.value as FeedbackPriority })}
            disabled={patchMutation.isPending}
            className={cn(fieldCls, 'mt-1')}
          >
            {Object.entries(FEEDBACK_PRIORITY_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </Select>
        </div>

        <div>
          <p className={fieldLabelCls}>Assigned to</p>
          <div className="mt-1">
            <FeedbackAssigneePicker
              candidates={assigneeCandidates}
              selectedId={ticket.assignedAdminIdentityId}
              selectedName={ticket.assignedAdminName}
              onSelect={(userId) => patchMutation.mutate({ assignedAdminIdentityId: userId })}
              onUnassign={() => patchMutation.mutate({ assignedAdminIdentityId: '' })}
              disabled={patchMutation.isPending}
            />
          </div>
        </div>

        {patchMutation.isError && (
          <p className="type-error">{apiErrorMessage(patchMutation.error, 'Failed to update ticket.')}</p>
        )}

        <div className="border-t border-stone-100 pt-3 dark:border-white/10">
          <button
            type="button"
            onClick={onExportPdf}
            disabled={exportingPdf}
            aria-label="Export ticket as PDF"
            className="flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-3 py-2 text-left text-xs text-ink transition-colors hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-60 dark:text-stone-200 dark:hover:bg-white/[0.06]"
          >
            {exportingPdf ? <Loader2 className="size-4 shrink-0 animate-spin text-ink-faint" /> : <FileDown className="size-4 shrink-0 text-ink-faint" />}
            {exportingPdf ? 'Exporting…' : 'Export PDF'}
          </button>
          {exportPdfError && <p className="px-3 type-error">{exportPdfError}</p>}
        </div>
      </div>

      <div className="space-y-2 rounded-xl border border-stone-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-white/[0.03]">
        <label htmlFor="fb-internal-notes" className={fieldLabelCls}>Internal Notes</label>
        <p className="type-helper">Visible to platform admins only — never shown to the reporter.</p>
        <textarea
          id="fb-internal-notes"
          value={notes}
          onChange={(e) => { setNotes(e.target.value); setNotesDirty(true); }}
          rows={4}
          maxLength={MAX_DESCRIPTION_LENGTH}
          placeholder="Triage notes, escalation status, links…"
          className={textareaCls}
        />
        {notesDirty && (
          <button
            type="button"
            onClick={handleSaveNotes}
            disabled={patchMutation.isPending}
            className={buttonVariants({ size: 'sm' })}
          >
            {patchMutation.isPending ? 'Saving…' : 'Save notes'}
          </button>
        )}
      </div>
    </div>
  );
}
