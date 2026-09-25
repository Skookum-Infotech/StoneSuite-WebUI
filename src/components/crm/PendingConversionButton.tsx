import { useMutation } from '@tanstack/react-query';
import { Hourglass, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { crmService, CRM_WORKFLOW_KEYS } from '@/services/crmService';
import { apiErrorMessage } from '@/api/tenantClient';
import type { WorkflowRecord } from '@/types/tenant';

type Props = {
  recordId: string;
  /** Id of the Pending Conversion status, from the prospect workflow's status
   *  catalog (the page already has it loaded for the status badge). */
  toStateId: string;
  /** Called with the updated prospect once it is in Pending Conversion. */
  onMarked: (record: WorkflowRecord) => void;
};

// Header action for a prospect being worked: moves it to Pending Conversion,
// which is what unlocks Convert to Customer. It is the ONLY way into that
// status — the status dropdown never lists it — and it goes through the same
// transition endpoint as the dropdown, so the approval gate applies as usual
// (the page hides the button while the prospect is gated). No confirm dialog:
// the move can be undone from the status dropdown. Render it as the direct
// child of CrmPageHeader's `actions` slot. Solid brand — same treatment as
// Lead's Mark Qualified / Convert buttons (LeadStatusActions.tsx,
// ConvertRecordButton.tsx): the CRM's header status buttons use one shared
// color language (solid brand for a forward move, red only for an exit like
// Closed Lost), not a color per button.
export function PendingConversionButton({ recordId, toStateId, onMarked }: Props) {
  const mark = useMutation({
    mutationFn: () => crmService.transitionRecord(recordId, toStateId, CRM_WORKFLOW_KEYS.PROSPECT),
    onSuccess: (record) => {
      toast.success('Marked as Pending Conversion.');
      onMarked(record);
    },
    onError: (err) => toast.error(apiErrorMessage(err, 'Failed to mark as Pending Conversion.')),
  });

  return (
    <button
      type="button"
      onClick={() => mark.mutate()}
      disabled={mark.isPending}
      className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-3 py-1.5 text-xs font-semibold text-stone-900 shadow-sm transition-colors hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-50"
    >
      {mark.isPending ? <Loader2 className="size-3.5 animate-spin" /> : <Hourglass className="size-3.5" />}
      Pending Conversion
    </button>
  );
}
