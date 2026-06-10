import { useState } from 'react';
import { ArrowRight, AlertTriangle } from 'lucide-react';
import { useMutation } from '@tanstack/react-query';
import { crmService, CRM_WORKFLOW_KEYS } from '@/services/crmService';
import { apiErrorMessage } from '@/api/tenantClient';

const TARGET_MAP = {
  [CRM_WORKFLOW_KEYS.LEAD]: CRM_WORKFLOW_KEYS.PROSPECT,
  [CRM_WORKFLOW_KEYS.PROSPECT]: CRM_WORKFLOW_KEYS.CUSTOMER,
} as const;

const LABEL_MAP = {
  [CRM_WORKFLOW_KEYS.LEAD]: { from: 'Lead', to: 'Prospect' },
  [CRM_WORKFLOW_KEYS.PROSPECT]: { from: 'Prospect', to: 'Customer' },
};

type Props = {
  recordId: string;
  sourceWorkflowKey: 'lead' | 'prospect';
  onConverted: (newRecordId: string) => void;
};

export function ConvertRecordButton({ recordId, sourceWorkflowKey, onConverted }: Props) {
  const [open, setOpen] = useState(false);

  const labels = LABEL_MAP[sourceWorkflowKey];
  const targetWorkflowKey = TARGET_MAP[sourceWorkflowKey];

  const convert = useMutation({
    mutationFn: () => crmService.convertRecord(recordId, targetWorkflowKey),
    onSuccess: ({ record }) => {
      setOpen(false);
      onConverted(record.id);
    },
  });

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded border border-stone-300 bg-white px-3 py-1.5 text-xs font-semibold text-stone-700 transition hover:bg-stone-50"
      >
        <ArrowRight className="size-3.5" />
        Convert to {labels.to}
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          role="dialog"
          aria-modal="true"
          aria-labelledby="convert-dialog-title"
        >
          <div className="mx-4 w-full max-w-sm rounded-xl bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex size-9 flex-shrink-0 items-center justify-center rounded-full bg-amber-100">
                <AlertTriangle className="size-4 text-amber-600" />
              </div>
              <h3 id="convert-dialog-title" className="text-sm font-bold text-stone-900">
                Convert to {labels.to}?
              </h3>
            </div>

            <p className="text-xs text-stone-600">
              This {labels.from} will be converted to a <span className="font-semibold">{labels.to}</span>.
              The original record will remain unchanged.
            </p>

            {convert.error && (
              <p className="mt-3 text-xs text-red-600">
                {apiErrorMessage(convert.error, 'Failed to convert record.')}
              </p>
            )}

            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setOpen(false)}
                disabled={convert.isPending}
                className="rounded border border-stone-300 bg-white px-3 py-1.5 text-xs font-semibold text-stone-600 hover:bg-stone-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => convert.mutate()}
                disabled={convert.isPending}
                className="inline-flex items-center gap-1 rounded bg-brand px-3 py-1.5 text-xs font-semibold text-stone-950 hover:bg-brand/80 disabled:opacity-50"
              >
                <ArrowRight className="size-3.5" />
                {convert.isPending ? 'Converting…' : `Convert to ${labels.to}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
