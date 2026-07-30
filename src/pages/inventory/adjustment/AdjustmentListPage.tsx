import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ClipboardEdit, Plus, Search, ChevronLeft, ChevronRight } from 'lucide-react';
import { apiErrorMessage } from '@/api/tenantClient';
import { inventoryAdjustmentService } from '@/services/inventoryAdjustmentService';
import { useUserPermissions } from '@/hooks/useUserPermissions';
import { Badge } from '@/components/tenant/ui';
import { docStatusLabel, DOC_STATUS_COLORS } from '@/lib/inventoryDocumentStatus';
import type { AdjustmentSearchRequest } from '@/services/inventoryAdjustmentService';

const PAGE_SIZE = 25;

function fmtDate(iso?: string): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString(undefined, { year: '2-digit', month: 'short', day: 'numeric' });
}

export default function AdjustmentListPage() {
  const navigate = useNavigate();
  const { hasPermission, isLoading } = useUserPermissions();
  const canCreate = isLoading || hasPermission('inventory_adjustment', 'create');

  const [term, setTerm] = useState('');
  const [debounced, setDebounced] = useState('');
  const [cursor, setCursor] = useState('');
  const [prevCursors, setPrevCursors] = useState<string[]>([]);

  useEffect(() => {
    const t = setTimeout(() => { setDebounced(term.trim()); setCursor(''); setPrevCursors([]); }, 300);
    return () => clearTimeout(t);
  }, [term]);

  const req: AdjustmentSearchRequest = {
    search: debounced || undefined,
    sort: [{ field: 'date', dir: 'desc' }],
    limit: PAGE_SIZE,
    cursor: cursor || undefined,
  };

  const { data, isError, error, isLoading: loading } = useQuery({
    queryKey: ['inventory-adjustments', req],
    queryFn: () => inventoryAdjustmentService.search(req),
    placeholderData: (prev) => prev,
  });

  const records = data?.records ?? [];
  const hasMore = data?.hasMore ?? false;
  const hasPrev = prevCursors.length > 0;

  function goNext() { if (!data?.nextCursor) return; setPrevCursors((p) => [...p, cursor]); setCursor(data.nextCursor); }
  function goPrev() { const prev = prevCursors[prevCursors.length - 1] ?? ''; setPrevCursors((p) => p.slice(0, -1)); setCursor(prev); }

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="p-4 sm:p-6 3xl:p-10 4xl:p-14 flex-1 flex flex-col min-h-0">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent ring-1 ring-accent-foreground/10 shrink-0">
              <ClipboardEdit className="size-5 text-accent-foreground" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-stone-900">Adjustments</h1>
              <p className="text-sm text-stone-500">Manual stock corrections — damage, shrinkage, recounts.</p>
            </div>
          </div>
          {canCreate && (
            <button onClick={() => navigate('/inventory/adjustment/new')} className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-brand text-stone-950 py-2 px-4 text-sm font-semibold shadow-sm transition hover:bg-brand-hover active:scale-95">
              <Plus className="size-3.5" /> New Adjustment
            </button>
          )}
        </div>

        <div className="mt-5 relative w-full sm:w-64">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-stone-400" />
          <input type="text" placeholder="Search…" value={term} onChange={(e) => setTerm(e.target.value)} className="h-8 w-full rounded-lg border border-stone-200 bg-white pl-8 pr-3 text-xs text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand transition-all" />
        </div>

        {isError && <p className="mt-3 text-xs text-red-500">{apiErrorMessage(error, 'Failed to load adjustments.')}</p>}

        <div className="mt-4 flex-1 overflow-y-auto modal-scrollbar">
          <div className="overflow-hidden rounded-xl border border-stone-200 bg-white shadow-sm">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-stone-200 bg-table-header">
                <tr>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-stone-500">Number</th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-stone-500">Warehouse</th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-stone-500">Status</th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-stone-500">Date</th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-stone-500 text-right">Net Delta</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {loading ? (
                  <tr><td colSpan={5} className="px-4 py-6 text-center text-stone-400">Loading…</td></tr>
                ) : records.length > 0 ? records.map((a) => (
                  <tr key={a.id} className="hover:bg-accent/10 transition-colors cursor-pointer" onClick={() => navigate(`/inventory/adjustment/${a.id}`)}>
                    <td className="px-4 py-3.5 font-mono font-semibold text-stone-900">{a.number || '—'}</td>
                    <td className="px-4 py-3.5 text-stone-700">{a.warehouseName || '—'}</td>
                    <td className="px-4 py-3.5"><Badge color={DOC_STATUS_COLORS[a.statusCode] ?? '#a8a29e'}>{docStatusLabel(a.statusCode)}</Badge></td>
                    <td className="px-4 py-3.5 text-stone-500 tabular-nums">{fmtDate(a.date)}</td>
                    <td className={`px-4 py-3.5 tabular-nums text-right font-semibold ${a.netDelta < 0 ? 'text-destructive' : 'text-emerald-600'}`}>{a.netDelta > 0 ? '+' : ''}{a.netDelta.toFixed(2)}</td>
                  </tr>
                )) : (
                  <tr><td colSpan={5} className="py-16 text-center text-stone-400">No adjustments yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>
          {records.length > 0 && (
            <div className="flex items-center justify-end gap-1.5 py-3">
              <button onClick={goPrev} disabled={!hasPrev} className="flex items-center gap-1.5 h-8 px-3 rounded-lg border border-stone-200 bg-white text-xs font-medium text-stone-600 hover:bg-stone-50 disabled:opacity-40 disabled:cursor-not-allowed" aria-label="Previous page"><ChevronLeft className="size-3.5" />Previous</button>
              <button onClick={goNext} disabled={!hasMore} className="flex items-center gap-1.5 h-8 px-3 rounded-lg border border-stone-200 bg-white text-xs font-medium text-stone-600 hover:bg-stone-50 disabled:opacity-40 disabled:cursor-not-allowed" aria-label="Next page">Next<ChevronRight className="size-3.5" /></button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
