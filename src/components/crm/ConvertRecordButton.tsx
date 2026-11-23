import { useMutation } from '@tanstack/react-query';
import { ArrowRightLeft, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { crmService, CRM_WORKFLOW_KEYS, type CRMWorkflowKey } from '@/services/crmService';
import { apiErrorMessage } from '@/api/tenantClient';
import type { WorkflowRecord } from '@/types/tenant';

/** The workflows a record is converted FROM — each hop copies it into the next stage. */
type ConvertibleWorkflow = typeof CRM_WORKFLOW_KEYS.LEAD | typeof CRM_WORKFLOW_KEYS.PROSPECT;

type Props = {
  recordId: string;
  /** The workflow the record is in; it decides what the button converts it into. */
  sourceKey: ConvertibleWorkflow;
  /** Called with the new record once the source is converted — or, on a repeat
   *  click, with the record the earlier conversion made. */
  onConverted: (record: WorkflowRecord) => void;
};

interface ConvertAction {
  target: CRMWorkflowKey;
  label: string;
  done: string;
  failed: string;
}

const CONVERT_ACTIONS: Record<ConvertibleWorkflow, ConvertAction> = {
  lead: {
    target: CRM_WORKFLOW_KEYS.PROSPECT,
    label: 'Convert to Prospect',
    done: 'Converted to prospect.',
    failed: 'Failed to convert lead.',
  },
  prospect: {
    target: CRM_WORKFLOW_KEYS.CUSTOMER,
    label: 'Convert to Customer',
    done: 'Converted to customer.',
    failed: 'Failed to convert prospect.',
  },
};

// Header action for a Qualified Lead ("Convert to Prospect") or a Pending
// Conversion Prospect ("Convert to Customer"): copies the record into the next
// stage. Same shape as Estimate's "Convert to Quote" — a header button with no
// confirm dialog, because converting only ever ADDS a record and leaves the
// source untouched. Idempotent server-side: clicking again on an
// already-converted record resolves to the existing one instead of a
// duplicate, so a repeat click is just navigation. Render it as the direct
// child of CrmPageHeader's `actions` slot. Styled as the header's primary
// action (solid brand button) — it's the one move that advances the record.
export function ConvertRecordButton({ recordId, sourceKey, onConverted }: Props) {
  const action = CONVERT_ACTIONS[sourceKey];
  const convert = useMutation({
    mutationFn: () => crmService.convertRecord(recordId, action.target, undefined, sourceKey),
    onSuccess: ({ record, created }) => {
      // On a repeat click the record may have moved on (a prospect that became a
      // customer), so name what we are actually opening.
      toast.success(created ? action.done : `Already converted — opening the ${record.workflowId}.`);
      onConverted(record);
    },
    onError: (err) => toast.error(apiErrorMessage(err, action.failed)),
  });

  return (
    <button
      type="button"
      onClick={() => convert.mutate()}
      disabled={convert.isPending}
      className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-3 py-1.5 text-xs font-semibold text-stone-900 shadow-sm transition-colors hover:bg-brand-hover disabled:opacity-50"
    >
      {convert.isPending ? <Loader2 className="size-3.5 animate-spin" /> : <ArrowRightLeft className="size-3.5" />}
      {action.label}
    </button>
  );
}
