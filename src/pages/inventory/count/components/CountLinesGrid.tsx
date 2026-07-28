import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Save, Loader2 } from 'lucide-react';
import { inventoryCountService } from '@/services/inventoryCountService';
import { apiErrorMessage } from '@/api/tenantClient';
import { ReasonSelect } from '@/components/inventory/ReasonSelect';
import { useInventoryLookups } from '@/hooks/useInventoryLookups';
import { cn } from '@/lib/utils';
import { countedQtyDisplay, foundDisplay, lineNeedsReason } from '@/lib/inventoryCountLines';
import type { Count, CountEntry, CountLine } from '@/types/inventory';

interface DirtyEntry {
  countedQty?: string;
  found?: boolean;
  reasonId?: string;
}

// The counting/review grid. countedQty === null renders as "— not counted",
// deliberately distinct from a counted zero (spec §9). A line's reason
// becomes required in this grid wherever its last-saved variance !== 0 — the
// server itself blocks posting on that; this just surfaces it earlier.
export function CountLinesGrid({ count, editable }: { count: Count; editable: boolean }) {
  const queryClient = useQueryClient();
  const { lookups } = useInventoryLookups();
  const [dirty, setDirty] = useState<Record<string, DirtyEntry>>({});

  function setDirtyField(lineId: string, patch: Partial<DirtyEntry>) {
    setDirty((d) => ({ ...d, [lineId]: { ...d[lineId], ...patch } }));
  }

  const { mutate: submit, isPending, error } = useMutation({
    mutationFn: () => {
      const entries: CountEntry[] = Object.entries(dirty).map(([lineId, d]) => {
        const line = count.lines.find((l) => l.id === lineId)!;
        const serialized = Boolean(line.inventoryUnitId);
        return {
          lineId,
          countedQty: serialized ? undefined : (d.countedQty !== undefined ? Number(d.countedQty) : undefined),
          found: serialized ? d.found : undefined,
          reasonId: d.reasonId ? Number(d.reasonId) : undefined,
        };
      }).filter((e) => e.countedQty !== undefined || e.found !== undefined);
      return inventoryCountService.recordCounts(count.id, entries);
    },
    onSuccess: () => {
      setDirty({});
      queryClient.invalidateQueries({ queryKey: ['inventory-count', count.id] });
    },
  });

  const dirtyCount = Object.keys(dirty).length;

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto modal-scrollbar rounded-lg border border-stone-200">
        <table className="w-full text-left text-xs">
          <thead className="bg-stone-50 border-b border-stone-200">
            <tr>
              <th className="px-3 py-2 font-semibold text-stone-500">Item / Unit</th>
              <th className="px-3 py-2 font-semibold text-stone-500">Location</th>
              <th className="px-3 py-2 font-semibold text-stone-500 text-right">System Qty</th>
              <th className="px-3 py-2 font-semibold text-stone-500 text-right">Counted</th>
              <th className="px-3 py-2 font-semibold text-stone-500 text-right">Variance</th>
              <th className="px-3 py-2 font-semibold text-stone-500">Reason</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {count.lines.map((line) => (
              <CountLineRow
                key={line.id}
                line={line}
                editable={editable}
                dirty={dirty[line.id]}
                onChange={(patch) => setDirtyField(line.id, patch)}
                reasons={lookups?.reasons ?? []}
              />
            ))}
            {count.lines.length === 0 && (
              <tr><td colSpan={6} className="py-8 text-center text-stone-400">No lines yet — freeze to snapshot the scope.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {editable && (
        <div className="flex items-center gap-3">
          <button
            type="button"
            disabled={dirtyCount === 0 || isPending}
            onClick={() => submit()}
            className="flex items-center gap-1.5 rounded-lg bg-brand px-3.5 py-1.5 text-xs font-semibold text-stone-950 hover:bg-brand-hover disabled:opacity-50 transition-colors"
          >
            {isPending ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />}
            {isPending ? 'Saving…' : `Save Progress${dirtyCount > 0 ? ` (${dirtyCount})` : ''}`}
          </button>
          {error && <p className="text-2xs text-destructive">{apiErrorMessage(error, 'Failed to save counts.')}</p>}
        </div>
      )}
    </div>
  );
}

function CountLineRow({ line, editable, dirty, onChange, reasons }: {
  line: CountLine;
  editable: boolean;
  dirty?: DirtyEntry;
  onChange: (patch: Partial<DirtyEntry>) => void;
  reasons: { id: number; name: string; code: string; isActive: boolean; isSystem: boolean }[];
}) {
  const serialized = Boolean(line.inventoryUnitId);
  const hasVariance = (line.variance ?? 0) !== 0;
  const needsReason = lineNeedsReason(line);
  const reasonValue = dirty?.reasonId ?? (line.reasonId ? String(line.reasonId) : '');

  return (
    <tr className={cn(hasVariance && 'bg-amber-50/40')}>
      <td className="px-3 py-2.5">
        <span className="block font-medium text-stone-800">{line.inventoryItemName || '—'}</span>
        {line.unitSerial && <span className="block font-mono text-2xs text-stone-400">{line.unitSerial}</span>}
      </td>
      <td className="px-3 py-2.5 text-stone-500">{line.binPath || '—'}</td>
      <td className="px-3 py-2.5 text-right tabular-nums text-stone-700">{line.systemQty}</td>
      <td className="px-3 py-2.5 text-right">
        {serialized ? (
          editable ? (
            <div className="flex justify-end gap-1">
              <button type="button" onClick={() => onChange({ found: true })} className={cn('rounded-md px-2 py-1 text-2xs font-semibold', (dirty?.found ?? undefined) === true ? 'bg-emerald-100 text-emerald-700' : 'bg-stone-100 text-stone-500')}>Found</button>
              <button type="button" onClick={() => onChange({ found: false })} className={cn('rounded-md px-2 py-1 text-2xs font-semibold', (dirty?.found ?? undefined) === false ? 'bg-destructive/10 text-destructive' : 'bg-stone-100 text-stone-500')}>Missing</button>
            </div>
          ) : (
            <span className="text-stone-500">{foundDisplay(line.countedQty)}</span>
          )
        ) : editable ? (
          <input
            type="number"
            defaultValue={line.countedQty ?? ''}
            onChange={(e) => onChange({ countedQty: e.target.value })}
            placeholder="—"
            aria-label={`Counted quantity for ${line.inventoryItemName}`}
            className="w-24 h-8 rounded-md border border-stone-300 px-2 text-right text-xs"
          />
        ) : (
          <span className="tabular-nums text-stone-700">
            {line.countedQty === null || line.countedQty === undefined
              ? <span className="italic text-stone-400">{countedQtyDisplay(line.countedQty)}</span>
              : line.countedQty}
          </span>
        )}
      </td>
      <td className={cn('px-3 py-2.5 text-right tabular-nums font-semibold', hasVariance ? 'text-amber-700' : 'text-stone-400')}>
        {line.variance === null || line.variance === undefined ? '—' : (line.variance > 0 ? '+' : '') + line.variance}
      </td>
      <td className="px-3 py-2.5">
        {needsReason ? (
          // Reasons can only be recorded while counting (AcceptsCounts) — a
          // missing one in review must go back via Recount, not be patched
          // here, so this is read-only outside CNTG.
          editable ? (
            <ReasonSelect reasons={reasons} value={reasonValue} onChange={(v) => onChange({ reasonId: v })} required label="Reason" />
          ) : line.reasonName ? (
            <span className="text-stone-500">{line.reasonName}</span>
          ) : (
            <span className="font-semibold text-amber-700">Missing — recount needed</span>
          )
        ) : (
          <span className="text-stone-300">—</span>
        )}
      </td>
    </tr>
  );
}
