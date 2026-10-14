import { useQuery } from '@tanstack/react-query';
import { History as HistoryIcon } from 'lucide-react';
import { apiErrorMessage } from '@/api/tenantClient';
import { binTransferService } from '@/services/binTransferService';
import { ErrorNote, Spinner } from '@/components/tenant/ui';
import { btStatusLabel } from '@/lib/binTransferStatus';
import type { DocHistoryEntry } from '@/types/inventory';

const ACTION_LABELS: Record<string, string> = {
  create: 'Created',
  update: 'Edited',
  approve: 'Approved',
  approve_override: 'Approved (override)',
  reject: 'Rejected',
  complete: 'Completed',
};

function describe(e: DocHistoryEntry): string {
  if (e.action === 'transition') {
    const to = e.toStatus ?? '';
    if (to === 'PAPV') return 'Submitted for approval';
    if (to === 'CANC') return 'Cancelled';
    if (to === 'DRFT') return 'Returned to draft';
    return `Moved to ${btStatusLabel(to)}`;
  }
  const label = ACTION_LABELS[e.action] ?? e.action;
  // A sign-off that did not finish the round leaves the status where it was.
  if (e.action === 'approve' && e.fromStatus === e.toStatus) return 'Signed off — waiting for the others';
  return label;
}

function fmtDateTime(iso: string): string {
  return new Date(iso).toLocaleString();
}

// The document's own trail: who created, submitted, signed off, rejected,
// completed or cancelled it, newest first. What happened to each slab sits on
// the slab's History tab and on the bins' Movement history.
export function BinTransferHistoryTab({ transferId }: { transferId: string }) {
  const { data = [], isLoading, error } = useQuery({
    queryKey: ['bin-transfer-history', transferId],
    queryFn: () => binTransferService.history(transferId),
  });

  if (isLoading) return <Spinner label="Loading history…" />;
  if (error) return <ErrorNote>{apiErrorMessage(error, 'Failed to load history.')}</ErrorNote>;
  if (data.length === 0) {
    return <p className="rounded-xl border border-stone-200 bg-white py-10 text-center text-sm text-stone-400">No history recorded yet.</p>;
  }

  return (
    <ol className="rounded-xl border border-stone-200 bg-white p-4">
      {data.map((e, i) => (
        <li key={`${e.at}-${i}`} className="relative flex gap-3 pb-4 last:pb-0">
          {i < data.length - 1 && <span aria-hidden="true" className="absolute left-[0.6875rem] top-6 h-[calc(100%-1.25rem)] w-px bg-stone-200" />}
          <span className="relative mt-0.5 flex size-[1.375rem] shrink-0 items-center justify-center rounded-full bg-stone-100 text-stone-500">
            <HistoryIcon className="size-3" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <p className="text-xs font-semibold text-stone-800">{describe(e)}</p>
            <p className="text-2xs text-stone-400">{fmtDateTime(e.at)} · {e.byName}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}
