import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useQuery } from '@tanstack/react-query';
import { Search, Package, Inbox, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { fieldCls } from '@/components/crm/formUtils';
import { useModalDialog } from '@/hooks/useModalDialog';
import { purchaseOrderService } from '@/services/purchaseOrderService';
import { PO_STATUS_COLORS } from '@/lib/purchaseOrderForm';
import { RECEIVABLE_PO_STATUS_CODES } from '@/lib/itemReceiptForm';

const RESULT_LIMIT = 15;
const SEARCH_DEBOUNCE_MS = 300;

// Entry point for "New Receipt": a purchase order must be finalized (SENT or
// PART) to receive against (itemreceipt/store.go receivableStatusCodes), so the
// picker asks the server for only those — any other order would be a dead row.
// `status_code` (purchaseorder/resolver.go) filters on the status's stable code;
// the plain `status` key is an internal lkp_record_status id no client can look
// up. When nothing matches, `onCreatePurchaseOrder` (only passed to users who
// may create one) offers to start the order that isn't there yet.
export function PurchaseOrderPickerDialog({ onClose, onSelect, onCreatePurchaseOrder }: {
  onClose: () => void;
  onSelect: (purchaseOrderId: string) => void;
  onCreatePurchaseOrder?: () => void;
}) {
  const [term, setTerm] = useState('');
  const [debounced, setDebounced] = useState('');
  const contentRef = useModalDialog(onClose);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(term.trim()), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [term]);

  const { data, isLoading } = useQuery({
    queryKey: ['po-picker', debounced],
    queryFn: () => purchaseOrderService.searchPurchaseOrders({
      search: debounced || undefined,
      filters: [{ field: 'status_code', op: 'in', value: RECEIVABLE_PO_STATUS_CODES }],
      sort: [{ field: 'updated_at', dir: 'desc' }],
      limit: RESULT_LIMIT,
    }),
  });
  const records = data?.records ?? [];

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="po-picker-dialog-title"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div ref={contentRef} tabIndex={-1} className="mx-4 flex max-h-[80vh] w-full max-w-lg flex-col rounded-xl bg-white shadow-2xl outline-none">
        <div className="shrink-0 border-b border-stone-200 px-5 py-4">
          <h3 id="po-picker-dialog-title" className="text-sm font-bold text-stone-900">Receive against a purchase order</h3>
          <p className="mt-0.5 text-xs text-stone-400">Only Sent or Partially Received orders can be received against.</p>
          <div className="relative mt-3">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-stone-400" />
            <input
              type="text"
              autoFocus
              value={term}
              onChange={(e) => setTerm(e.target.value)}
              placeholder="Search PO #, vendor…"
              className={cn(fieldCls, 'pl-8')}
              aria-label="Search purchase orders"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto modal-scrollbar px-2 py-2">
          {isLoading ? (
            <div className="space-y-1.5 p-2">
              {Array.from({ length: 4 }, (_, i) => (
                <div key={i} className="h-12 animate-pulse rounded-lg bg-stone-100" />
              ))}
            </div>
          ) : records.length === 0 ? (
            <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
              <Inbox className="size-6 text-stone-300" aria-hidden="true" />
              <p className="text-xs font-medium text-stone-500">
                {debounced ? `No open purchase orders match "${debounced}".` : 'No purchase orders are open for receiving.'}
              </p>
              <p className="text-2xs text-stone-400">
                {debounced
                  ? 'It may not exist yet, or may not have been sent to the vendor.'
                  : 'Send a purchase order to the vendor first, or create a new one.'}
              </p>
              {onCreatePurchaseOrder && (
                <button
                  type="button"
                  onClick={onCreatePurchaseOrder}
                  aria-label="Create purchase order"
                  className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-brand px-3 py-1.5 text-xs font-semibold text-stone-950 shadow-sm transition hover:bg-brand-hover active:scale-95"
                >
                  <Plus className="size-3.5" aria-hidden="true" />
                  Create purchase order
                </button>
              )}
            </div>
          ) : (
            <ul className="space-y-1">
              {records.map((po) => {
                const color = PO_STATUS_COLORS[po.statusCode] ?? '#a8a29e';
                return (
                  <li key={po.id}>
                    <button
                      type="button"
                      onClick={() => onSelect(po.id)}
                      aria-label={`Receive against ${po.purchaseOrderNumber}`}
                      className="flex w-full cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-accent/10"
                    >
                      <Package className="size-4 shrink-0 text-stone-400" aria-hidden="true" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-semibold text-stone-800">{po.purchaseOrderNumber || '—'}</p>
                        <p className="truncate text-2xs text-stone-400">{po.vendor?.name ?? '—'}</p>
                      </div>
                      <span
                        className="inline-flex shrink-0 items-center gap-1.5 rounded-md px-2 py-0.5 text-2xs font-semibold text-stone-600 whitespace-nowrap"
                        style={{ backgroundColor: `${color}18` }}
                      >
                        <span className="size-1.5 shrink-0 rounded-full" style={{ backgroundColor: color }} aria-hidden="true" />
                        {po.status}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="flex shrink-0 justify-end border-t border-stone-200 px-5 py-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-xs font-medium text-stone-600 hover:bg-stone-50"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
