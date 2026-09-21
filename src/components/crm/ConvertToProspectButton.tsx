import { useMutation } from '@tanstack/react-query';
import { ArrowRightLeft, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { crmService, CRM_WORKFLOW_KEYS } from '@/services/crmService';
import { apiErrorMessage } from '@/api/tenantClient';
import type { WorkflowRecord } from '@/types/tenant';

type Props = {
  recordId: string;
  /** Called with the prospect once the lead is converted — or, on a repeat
   *  click, with the record the earlier conversion made. */
  onConverted: (record: WorkflowRecord) => void;
};

// Header action for a Qualified Lead: copies it into a new Prospect. Same shape
// as Estimate's "Convert to Quote" — a header button with no confirm dialog,
// because converting only ever ADDS a record and leaves the lead untouched.
// Idempotent server-side: clicking again on an already-converted lead resolves
// to the existing record instead of a duplicate, so a repeat click is just
// navigation. Render it as the direct child of CrmPageHeader's `actions` slot.
export function ConvertToProspectButton({ recordId, onConverted }: Props) {
  const convert = useMutation({
    mutationFn: () =>
      crmService.convertRecord(recordId, CRM_WORKFLOW_KEYS.PROSPECT, undefined, CRM_WORKFLOW_KEYS.LEAD),
    onSuccess: ({ record, created }) => {
      // On a repeat click the record may have moved on (a prospect that became a
      // customer), so name what we are actually opening.
      toast.success(created ? 'Converted to prospect.' : `Already converted — opening the ${record.workflowId}.`);
      onConverted(record);
    },
    onError: (err) => toast.error(apiErrorMessage(err, 'Failed to convert lead.')),
  });

  return (
    <button
      type="button"
      onClick={() => convert.mutate()}
      disabled={convert.isPending}
      className="inline-flex items-center gap-1.5 rounded-lg border border-stone-300 bg-white px-3 py-1.5 text-xs font-semibold text-stone-700 shadow-sm transition-colors hover:bg-stone-50 disabled:opacity-50"
    >
      {convert.isPending ? <Loader2 className="size-3.5 animate-spin" /> : <ArrowRightLeft className="size-3.5" />}
      Convert to Prospect
    </button>
  );
}
