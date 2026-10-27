import { useNavigate } from 'react-router-dom';
import { AlertTriangle, ArrowRight, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { BinTransferLine } from '@/types/binTransfer';

const NOT_MOVABLE = new Set(['consumed', 'scrapped', 'in_transit']);

function fmtStatus(status: string): string {
  return status.replace('_', ' ');
}

// What is worth flagging on a line while the transfer is still waiting to move
// it: the slab can no longer move at all, or it has been moved some other way.
function lineWarning(line: BinTransferLine, pending: boolean): string | null {
  if (!pending) return null;
  if (NOT_MOVABLE.has(line.unitStatus)) {
    return `Slab is ${fmtStatus(line.unitStatus)} and can no longer be moved — completing will be refused.`;
  }
  const from = line.fromBinPath ?? '';
  const now = line.currentBinPath ?? '';
  if (from !== now) {
    return `Now in ${now || 'no bin'} — it will still go to ${line.toBinPath || 'the destination'}.`;
  }
  return null;
}

// Read-only list of a transfer's slabs: where each was, where it is going, and —
// once completed — that it got there.
export function BinTransferSlabsTable({ lines, pending }: {
  lines: BinTransferLine[];
  /** True while the moves have not been applied yet (not completed or cancelled). */
  pending: boolean;
}) {
  const navigate = useNavigate();

  return (
    <div className="overflow-x-auto rounded-xl border border-stone-200 bg-white modal-scrollbar">
      <table className="w-full min-w-[620px] text-left text-xs">
        <thead className="border-b border-stone-200 bg-table-header">
          <tr>
            <th className="px-4 py-2.5 text-2xs font-semibold uppercase tracking-wider text-stone-500">Slab</th>
            <th className="px-4 py-2.5 text-right text-2xs font-semibold uppercase tracking-wider text-stone-500">Area</th>
            <th className="px-4 py-2.5 text-2xs font-semibold uppercase tracking-wider text-stone-500">From</th>
            <th className="w-6 px-0 py-2.5" aria-hidden="true" />
            <th className="px-4 py-2.5 text-2xs font-semibold uppercase tracking-wider text-stone-500">To</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-stone-100">
          {lines.map((l) => {
            const warning = lineWarning(l, pending);
            return (
              <tr key={l.id} className="align-top">
                <td className="px-4 py-3">
                  <button
                    type="button"
                    onClick={() => navigate(`/inventory/unit/${l.unitId}`)}
                    className="font-mono text-xs font-semibold text-stone-900 transition-colors hover:text-accent-foreground"
                  >
                    {l.unitSerial}
                  </button>
                  <span className="block truncate text-2xs text-stone-500">{l.inventoryItemName || '—'}</span>
                  {warning && (
                    <span role="note" className="mt-1.5 flex items-start gap-1 text-2xs text-amber-700">
                      <AlertTriangle className="mt-px size-3 shrink-0" aria-hidden="true" />
                      {warning}
                    </span>
                  )}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums text-stone-700">
                  {l.area.toFixed(2)} {l.areaUnitCode}
                </td>
                <td className="px-4 py-3 text-stone-500">
                  {l.fromBinPath || <span className="text-stone-500">No bin</span>}
                </td>
                <td className="px-0 py-3 text-stone-400"><ArrowRight className="size-3.5" aria-hidden="true" /></td>
                <td className="px-4 py-3">
                  <span className={cn('font-medium', l.movedAt ? 'text-emerald-700' : 'text-stone-800')}>{l.toBinPath}</span>
                  {l.toBinName && <span className="block text-2xs text-stone-500">{l.toBinName}</span>}
                  {l.movedAt && (
                    <span className="mt-1 flex items-center gap-1 text-2xs font-semibold text-emerald-700">
                      <CheckCircle2 className="size-3" aria-hidden="true" /> Moved
                    </span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
