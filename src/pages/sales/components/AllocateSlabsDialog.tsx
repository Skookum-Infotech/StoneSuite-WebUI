import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, Search, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { apiErrorMessage } from '@/api/tenantClient';
import { fieldCls } from '@/components/crm/formUtils';
import { Spinner } from '@/components/tenant/ui';
import { fabricationService } from '@/services/fabricationService';
import { inventoryUnitService } from '@/services/inventoryUnitService';
import { AllocationInterrupted, allocateInOrder } from '@/lib/slabAllocation';
import { suggestSlabs } from '@/lib/slabSuggest';
import { formatStockQty } from '@/lib/stockShortage';
import { UNIT_STATUS_AVAILABLE } from '@/types/inventory';
import type { FabricationJobPiece, FabricationMaterial } from '@/types/fabrication';

const CANDIDATE_LIMIT = 100;
const SEARCH_DEBOUNCE_MS = 300;
const EPSILON = 0.0005;

// Picking the slabs for a job. Lists the slabs and offcuts of ONE material that are
// in stock and unallocated, biggest first, and works out which to take: "Suggest
// best fit" selects the fewest slabs that cover what the job is still short of.
export function AllocateSlabsDialog({ jobId, material, pieces, onClose }: {
  jobId: string;
  material: FabricationMaterial;
  pieces: FabricationJobPiece[];
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [term, setTerm] = useState('');
  const [debounced, setDebounced] = useState('');
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const [pieceUuid, setPieceUuid] = useState('');

  useEffect(() => {
    const t = setTimeout(() => setDebounced(term.trim()), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [term]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const { data, isLoading, error } = useQuery({
    // Under the 'inventory-units' root so a receipt, cut or allocation refreshes it.
    queryKey: ['inventory-units', 'allocate-candidates', material.itemId, debounced],
    queryFn: () => inventoryUnitService.searchUnits({
      search: debounced || undefined,
      filters: [
        { field: 'item_id', op: 'eq', value: material.itemId },
        { field: 'status', op: 'eq', value: UNIT_STATUS_AVAILABLE },
      ],
      sort: [{ field: 'area', dir: 'desc' }],
      limit: CANDIDATE_LIMIT,
    }),
  });
  const slabs = data?.records ?? [];

  const selectedArea = slabs.filter((s) => selected.has(s.id)).reduce((sum, s) => sum + s.area, 0);
  const stillShort = Math.max(0, material.shortfall - selectedArea);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function suggest() {
    setSelected(new Set(suggestSlabs(slabs, material.shortfall).ids));
  }

  const allocate = useMutation({
    mutationFn: (ids: string[]) =>
      allocateInOrder(ids, (id) => fabricationService.allocateSlab(jobId, id, pieceUuid || undefined)),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['fabrication-job-materials', jobId] });
      queryClient.invalidateQueries({ queryKey: ['fabrication-job-slabs', jobId] });
      queryClient.invalidateQueries({ queryKey: ['fabrication-job', jobId] });
      queryClient.invalidateQueries({ queryKey: ['inventory-units'] });
    },
    onSuccess: onClose,
    onError: (err) => {
      // Slabs allocated before the failure stay allocated; drop them from the
      // selection so a retry does not try them again.
      if (err instanceof AllocationInterrupted) {
        setSelected((prev) => new Set([...prev].filter((id) => !err.allocated.includes(id))));
      }
    },
  });

  const allocateLabel = selected.size === 0
    ? 'Allocate'
    : `Allocate ${selected.size} ${selected.size === 1 ? 'slab' : 'slabs'}`;

  const failure = allocate.error;
  const failureMessage = failure instanceof AllocationInterrupted
    ? `${failure.allocated.length} of ${allocate.variables?.length ?? failure.allocated.length} allocated. ${apiErrorMessage(failure.reason, 'Failed to allocate a slab.')}`
    : failure ? apiErrorMessage(failure, 'Failed to allocate slabs.') : null;

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="allocate-slabs-title"
      onClick={(e) => e.target === e.currentTarget && !allocate.isPending && onClose()}
    >
      <div className="mx-4 flex max-h-[90vh] w-full max-w-3xl flex-col rounded-xl bg-white p-6 shadow-2xl">
        <div className="mb-4">
          <h3 id="allocate-slabs-title" className="text-sm font-bold text-stone-900">Allocate {material.name}</h3>
          <p className="mt-0.5 text-xs text-stone-500">
            {material.shortfall > 0
              ? `${formatStockQty(material.shortfall, material.unitCode)} still to allocate. `
              : 'This material is covered; more can still be allocated. '}
            {formatStockQty(material.inStock, material.unitCode)} in stock.
          </p>
        </div>

        <div className="mb-3 flex flex-wrap items-center gap-2">
          <div className="relative min-w-[200px] flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-stone-400" aria-hidden="true" />
            <input
              type="text"
              value={term}
              onChange={(e) => setTerm(e.target.value)}
              placeholder="Search serial, lot, barcode…"
              aria-label="Search slabs"
              className={cn(fieldCls, 'h-8 py-1 pl-8')}
            />
          </div>
          {pieces.length > 0 && (
            <select
              value={pieceUuid}
              onChange={(e) => setPieceUuid(e.target.value)}
              aria-label="Piece to allocate to"
              className={cn(fieldCls, 'h-8 w-44 py-1')}
            >
              <option value="">— Whole job —</option>
              {pieces.map((p) => (
                <option key={p.id} value={p.id}>{p.pieceName || `Piece ${p.pieceNumber}`}</option>
              ))}
            </select>
          )}
          <button
            type="button"
            onClick={suggest}
            disabled={slabs.length === 0 || material.shortfall <= 0}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-stone-200 bg-white px-3 text-xs font-medium text-stone-700 hover:bg-stone-50 disabled:opacity-50"
          >
            <Sparkles className="size-3.5" aria-hidden="true" /> Suggest best fit
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-auto rounded-lg border border-stone-200">
          {isLoading ? (
            <div className="flex justify-center py-8"><Spinner label="Loading slabs…" /></div>
          ) : error ? (
            <p role="alert" className="py-8 text-center text-xs text-destructive">{apiErrorMessage(error, 'Failed to load slabs.')}</p>
          ) : slabs.length === 0 ? (
            <p className="py-8 text-center text-xs text-stone-400">
              {debounced ? 'No slabs match that search.' : `No unallocated ${material.name} is in stock.`}
            </p>
          ) : (
            <table className="w-full min-w-[560px] text-left text-xs" aria-label="Slabs in stock">
              <thead className="sticky top-0 border-b border-stone-200 bg-stone-50">
                <tr>
                  <th className="w-8 px-3 py-2"><span className="sr-only">Select</span></th>
                  {['Serial', 'Kind', 'Size (mm)', 'Area', 'Location', 'Lot'].map((h) => (
                    <th key={h} className="px-3 py-2 text-2xs font-semibold uppercase tracking-wide text-stone-500">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {slabs.map((s) => (
                  <tr key={s.id} className={cn('hover:bg-stone-50', selected.has(s.id) && 'bg-accent/10')}>
                    <td className="px-3 py-2">
                      <input
                        type="checkbox"
                        checked={selected.has(s.id)}
                        onChange={() => toggle(s.id)}
                        aria-label={`Select ${s.serial}`}
                        className="size-4 rounded border-stone-300 text-brand focus:ring-brand/30"
                      />
                    </td>
                    <td className="px-3 py-2 font-mono font-semibold text-stone-900">{s.serial}</td>
                    <td className="px-3 py-2 capitalize text-stone-500">{s.kind}</td>
                    <td className="px-3 py-2 tabular-nums text-stone-600">{s.lengthMm} × {s.widthMm} × {s.thicknessMm}</td>
                    <td className="whitespace-nowrap px-3 py-2 tabular-nums text-stone-700">{formatStockQty(s.area, material.unitCode)}</td>
                    <td className="max-w-[160px] truncate px-3 py-2 text-stone-500">{s.binPath || s.warehouseName || '—'}</td>
                    <td className="px-3 py-2 text-stone-500">{s.lot || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        {data?.hasMore && (
          <p className="mt-1.5 text-2xs text-stone-400">Showing the largest {CANDIDATE_LIMIT} — search to narrow the list.</p>
        )}

        {failureMessage && <p role="alert" className="mt-3 text-xs text-destructive">{failureMessage}</p>}

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-stone-600" aria-live="polite">
            <span className="font-semibold tabular-nums">{formatStockQty(selectedArea, material.unitCode)}</span> selected
            {selected.size > 0 && ` (${selected.size} ${selected.size === 1 ? 'slab' : 'slabs'})`}
            {material.shortfall > EPSILON && (
              stillShort > EPSILON
                ? <span className="text-amber-700"> · {formatStockQty(stillShort, material.unitCode)} still short</span>
                : <span className="text-emerald-700"> · covers what is needed</span>
            )}
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={allocate.isPending}
              className="rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-xs font-medium text-stone-600 hover:bg-stone-50 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => allocate.mutate([...selected])}
              disabled={selected.size === 0 || allocate.isPending}
              className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-3 py-1.5 text-xs font-semibold text-stone-900 hover:bg-brand-hover disabled:opacity-50 active:scale-95 transition-all"
            >
              {allocate.isPending && <Loader2 className="size-3 animate-spin" aria-hidden="true" />}
              {allocate.isPending ? 'Allocating…' : allocateLabel}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
