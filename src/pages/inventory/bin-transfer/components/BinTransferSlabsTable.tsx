import { Link } from 'react-router-dom';
import { AlertTriangle, ArrowRight, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { BinTransferLine } from '@/types/binTransfer';

const NOT_MOVABLE = new Set(['consumed', 'scrapped', 'in_transit', 'on_order']);

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

  return (
    <div className="overflow-x-auto rounded-xl border border-stone-200 bg-white modal-scrollbar">
      <table className="w-full min-w-[620px] text-left type-cell">
        <thead className="border-b border-stone-200 bg-table-header">
          <tr>
            <th className="px-4 py-2.5 type-th">Slab</th>
            <th className="px-4 py-2.5 text-right type-th">Area</th>
            <th className="px-4 py-2.5 type-th">From</th>
            <th className="type-th w-6 px-0 py-2.5" aria-hidden="true" />
            <th className="px-4 py-2.5 type-th">To</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-stone-100">
          {lines.map((l) => {
            const warning = lineWarning(l, pending);
            return (
              <tr key={l.id} className="align-top">
                <td className="px-4 py-2.5">
                  <Link
                    to={`/inventory/unit/${l.unitId}`}
                    className="transition-colors hover:text-accent-foreground type-record-id"
                  >
                    {l.unitSerial}
                  </Link>
                  <span className="block truncate type-subline">{l.inventoryItemName || '—'}</span>
                  {warning && (
                    <span role="note" className="mt-1.5 flex items-start gap-1 text-micro text-warning-ink">
                      <AlertTriangle className="mt-px size-3 shrink-0" aria-hidden="true" />
                      {warning}
                    </span>
                  )}
                </td>
                <td className="type-cell whitespace-nowrap px-4 py-2.5 text-right tabular-nums">
                  {l.area.toFixed(2)} {l.areaUnitCode}
                </td>
                <td className="type-cell px-4 py-2.5">
                  {l.fromBinPath || <span className="text-ink-muted">No bin</span>}
                </td>
                <td className="px-0 py-2.5 text-ink-muted"><ArrowRight className="size-3.5" aria-hidden="true" /></td>
                <td className="px-4 py-2.5">
                  <span className={cn('font-medium', l.movedAt ? 'text-success-ink' : 'text-ink-strong')}>{l.toBinPath}</span>
                  {l.toBinName && <span className="block type-subline">{l.toBinName}</span>}
                  {l.movedAt && (
                    <span className="mt-1 flex items-center gap-1 text-micro font-semibold text-success-ink">
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
