import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Inbox } from 'lucide-react';
import { Spinner } from '@/components/tenant/ui';
import { itemReceiptService } from '@/services/itemReceiptService';
import { IR_STATUS_COLORS } from '@/lib/itemReceiptForm';

function fmtDate(iso?: string): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

// GET /api/tenant/purchase-orders/{uuid}/receipts — every item receipt ever
// raised against this order (spec §4), gated by the order's own read
// permission + IDOR, not item_receipt's.
export function PurchaseOrderReceiptsTab({ purchaseOrderId }: { purchaseOrderId?: string }) {
  const navigate = useNavigate();
  const { data: receipts = [], isLoading, error } = useQuery({
    queryKey: ['purchase-order-receipts', purchaseOrderId],
    queryFn: () => itemReceiptService.forPurchaseOrder(purchaseOrderId!),
    enabled: Boolean(purchaseOrderId),
  });

  if (!purchaseOrderId) {
    return <p className="py-12 text-center text-sm text-stone-400">Receipts will be available after saving the purchase order.</p>;
  }
  if (isLoading) return <div className="py-6 flex justify-center"><Spinner label="Loading receipts…" /></div>;
  if (error) return <p className="py-6 text-center text-xs text-destructive/70 italic">Failed to load item receipts.</p>;
  if (receipts.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 py-12 text-center">
        <Inbox className="size-6 text-stone-300" aria-hidden="true" />
        <p className="text-sm text-stone-400">No goods have been received against this order yet.</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-stone-200 bg-white">
      <table className="w-full text-left text-xs">
        <thead className="bg-stone-50 border-b border-stone-200">
          <tr>
            {['Receipt #', 'Status', 'Receipt Date', 'Warehouse', 'Posted', 'Voided'].map((h) => (
              <th key={h} className="px-3 py-2.5 text-2xs font-semibold uppercase tracking-wide text-stone-500 whitespace-nowrap">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-stone-100">
          {receipts.map((r) => {
            const color = IR_STATUS_COLORS[r.statusCode] ?? '#a8a29e';
            return (
              <tr key={r.id} className="hover:bg-stone-50/50 transition-colors">
                <td className="px-3 py-2.5">
                  <button
                    type="button"
                    onClick={() => navigate(`/purchases/item_receipt/${r.id}`)}
                    className="font-mono text-xs font-semibold text-stone-900 hover:text-accent-foreground transition-colors"
                  >
                    {r.itemReceiptNumber || '—'}
                  </button>
                </td>
                <td className="px-3 py-2.5">
                  <span
                    className="inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-2xs font-semibold text-stone-600 whitespace-nowrap"
                    style={{ backgroundColor: `${color}18` }}
                  >
                    <span className="size-1.5 shrink-0 rounded-full" style={{ backgroundColor: color }} aria-hidden="true" />
                    {r.status}
                  </span>
                </td>
                <td className="px-3 py-2.5 text-stone-500 tabular-nums whitespace-nowrap">{fmtDate(r.receiptDate)}</td>
                <td className="px-3 py-2.5 text-stone-500">{r.warehouseName || '—'}</td>
                <td className="px-3 py-2.5 text-stone-400 tabular-nums whitespace-nowrap">{fmtDate(r.postedAt)}</td>
                <td className="px-3 py-2.5 text-stone-400 tabular-nums whitespace-nowrap">{fmtDate(r.voidedAt)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
