import { useQuery } from '@tanstack/react-query';
import { cn } from '@/lib/utils';
import { Spinner } from '@/components/tenant/ui';
import { salesOrderService } from '@/services/salesOrderService';

// Live stock/allocation data only exists once the order (and its lines) are
// persisted server-side (design §10 GET .../inventory) — orderId is undefined
// while creating a brand-new order.
export function SalesOrderInventoryTab({ orderId }: { orderId?: string }) {
  const { data: items = [], isLoading, error } = useQuery({
    queryKey: ['sales-order-inventory', orderId],
    queryFn: () => salesOrderService.getInventory(orderId!),
    enabled: Boolean(orderId),
  });

  if (!orderId) {
    return (
      <p className="py-8 text-center text-xs text-stone-400">
        Inventory data will be available after saving the order.
      </p>
    );
  }
  if (isLoading) return <div className="py-8 flex justify-center"><Spinner label="Loading inventory…" /></div>;
  if (error) return <p className="py-8 text-center text-xs text-destructive/70">Failed to load inventory.</p>;
  if (items.length === 0) {
    return (
      <p className="py-8 text-center text-xs text-stone-400">
        This order has no catalog-linked lines — inventory is only tracked for items picked from the catalog.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto modal-scrollbar rounded-lg border border-stone-200">
      <table className="w-full text-left text-xs">
        <thead className="bg-stone-50 border-b border-stone-200">
          <tr>
            {['SKU', 'On Hand', 'Available', 'SO Qty', 'Allocated'].map((h) => (
              <th key={h} className="px-3 py-2.5 text-2xs font-semibold uppercase tracking-wide text-stone-500 whitespace-nowrap">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-stone-100">
          {items.map((row) => (
            <tr key={row.itemId} className="hover:bg-stone-50/50">
              <td className="px-3 py-2.5 font-mono text-2xs text-stone-500">{row.sku}</td>
              <td className="px-3 py-2.5 tabular-nums text-right text-stone-700">{row.onHand.toLocaleString()}</td>
              <td className="px-3 py-2.5 tabular-nums text-right">
                <span className={cn('font-medium', row.available > 0 ? 'text-emerald-700' : 'text-red-600')}>
                  {row.available.toLocaleString()}
                </span>
              </td>
              <td className="px-3 py-2.5 tabular-nums text-right text-stone-700">{row.salesOrderQuantity.toLocaleString()}</td>
              <td className="px-3 py-2.5 tabular-nums text-right text-amber-700 font-medium">{row.allocated.toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
