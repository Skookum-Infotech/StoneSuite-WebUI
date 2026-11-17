import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Repeat, Plus, Search, ChevronLeft, ChevronRight, Truck } from 'lucide-react';
import { apiErrorMessage } from '@/api/tenantClient';
import { inventoryTransferService } from '@/services/inventoryTransferService';
import { useUserPermissions } from '@/hooks/useUserPermissions';
import { Badge } from '@/components/tenant/ui';
import { docStatusLabel, DOC_STATUS_COLORS } from '@/lib/inventoryDocumentStatus';
import type { TransferSearchRequest } from '@/services/inventoryTransferService';
import { formatDateValue, LIST_DATE_OPTIONS } from '@/lib/dateUtils';

import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';
const PAGE_SIZE = 25;

function fmtDate(iso?: string): string {
  if (!iso) return '—';
  return formatDateValue(iso, undefined, LIST_DATE_OPTIONS);
}

export default function TransferListPage() {
  const navigate = useNavigate();
  const { hasPermission, isLoading } = useUserPermissions();
  const canCreate = isLoading || hasPermission('inventory_transfer', 'create');

  const [term, setTerm] = useState('');
  const [debounced, setDebounced] = useState('');
  const [cursor, setCursor] = useState('');
  const [prevCursors, setPrevCursors] = useState<string[]>([]);

  useEffect(() => {
    const t = setTimeout(() => { setDebounced(term.trim()); setCursor(''); setPrevCursors([]); }, 300);
    return () => clearTimeout(t);
  }, [term]);

  const { data: inTransit = [] } = useQuery({
    queryKey: ['inventory-transfers-in-transit'],
    queryFn: () => inventoryTransferService.listInTransit(),
  });

  const req: TransferSearchRequest = {
    search: debounced || undefined,
    sort: [{ field: 'created_at', dir: 'desc' }],
    limit: PAGE_SIZE,
    cursor: cursor || undefined,
  };

  const { data, isError, error, isLoading: loading } = useQuery({
    queryKey: ['inventory-transfers', req],
    queryFn: () => inventoryTransferService.search(req),
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
              <Repeat className="size-5 text-accent-foreground" />
            </div>
            <div>
              <h1 className="type-page-title">Transfers</h1>
              <p className="text-sm text-stone-500">Ship and receive stock between locations.</p>
            </div>
          </div>
          {canCreate && (
            <button onClick={() => navigate('/inventory/transfer/new')} className={cn(buttonVariants(), 'active:scale-95')}>
              <Plus className="size-3.5" /> New Transfer
            </button>
          )}
        </div>

        {inTransit.length > 0 && (
          <div className="mt-4 rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-3">
            <p className="flex items-center gap-2 text-xs font-semibold text-indigo-700 mb-2">
              <Truck className="size-3.5" /> {inTransit.length} transfer(s) currently in transit — stock shows in neither location until received.
            </p>
            <div className="flex flex-wrap gap-2">
              {inTransit.map((t) => (
                <button key={t.id} type="button" onClick={() => navigate(`/inventory/transfer/${t.id}`)} className={buttonVariants({ variant: 'outline', size: 'sm' })}>
                  {t.number}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="mt-5 relative w-full sm:w-64">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-stone-400" />
          <input type="text" placeholder="Search…" value={term} onChange={(e) => setTerm(e.target.value)} className="h-8 w-full rounded-lg border border-stone-200 bg-white pl-8 pr-3 placeholder:text-stone-500 focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand transition-all type-input" />
        </div>

        {isError && <p className="mt-3 type-error">{apiErrorMessage(error, 'Failed to load transfers.')}</p>}

        <div className="mt-4 flex-1 overflow-y-auto modal-scrollbar">
          <div className="overflow-hidden rounded-xl border border-stone-200 bg-white shadow-sm">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-stone-200 bg-table-header">
                <tr>
                  <th className="px-4 py-3 type-th">Number</th>
                  <th className="px-4 py-3 type-th">From</th>
                  <th className="px-4 py-3 type-th">To</th>
                  <th className="px-4 py-3 type-th">Status</th>
                  <th className="px-4 py-3 type-th">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {loading ? (
                  <tr><td colSpan={5} className="px-4 py-6 text-center text-stone-500">Loading…</td></tr>
                ) : records.length > 0 ? records.map((t) => (
                  <tr key={t.id} className="relative hover:bg-accent/10 transition-colors">
                    <td className="px-4 py-3.5 type-record-id"><Link to={`/inventory/transfer/${t.id}`} className="after:absolute after:inset-0">{t.number || '—'}</Link></td>
                    <td className="px-4 py-3.5 text-stone-700">{t.fromWarehouseName || '—'}</td>
                    <td className="px-4 py-3.5 text-stone-700">{t.toWarehouseName || '—'}</td>
                    <td className="px-4 py-3.5"><Badge color={DOC_STATUS_COLORS[t.statusCode] ?? '#a8a29e'}>{docStatusLabel(t.statusCode)}</Badge></td>
                    <td className="px-4 py-3.5 text-stone-500 tabular-nums">{fmtDate(t.date)}</td>
                  </tr>
                )) : (
                  <tr><td colSpan={5} className="py-16 text-center text-stone-500">No transfers yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>
          {records.length > 0 && (
            <div className="flex items-center justify-end gap-1.5 py-3">
              <button onClick={goPrev} disabled={!hasPrev} className={cn(buttonVariants({ variant: 'outline' }), 'flex')} aria-label="Previous page"><ChevronLeft className="size-3.5" />Previous</button>
              <button onClick={goNext} disabled={!hasMore} className={cn(buttonVariants({ variant: 'outline' }), 'flex')} aria-label="Next page">Next<ChevronRight className="size-3.5" /></button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
