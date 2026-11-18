import { useQuery } from '@tanstack/react-query';
import { cn } from '@/lib/utils';
import { Spinner } from '@/components/tenant/ui';
import { salesOrderService } from '@/services/salesOrderService';

// Live stock/allocation data only exists once the order (and its lines) are
// persisted server-side (design §10 GET .../inventory) — orderId is undefined
// while creating a brand-new order.
//
// Saving an order reserves the stock it needs, so "Held for this order" is real
// and "Free" is what is still left to promise after every order's hold —
// including this one's. An order that holds all there is therefore shows Free 0,
// not a shortage; Free is only red if the holds add up to more than is on hand.
const HEADERS = ['SKU', 'On Hand', 'Ordered', 'Held for this order', 'Held by all orders', 'Free'];

export function SalesOrderInventoryTab({ orderId }: { orderId?: string }) {
  const { data: items = [], isLoading, error } = useQuery({
    queryKey: ['sales-order-inventory', orderId],
    queryFn: () => salesOrderService.getInventory(orderId!),
    enabled: Boolean(orderId),
  });

  if (!orderId) {
    return (
      <p className="py-8 text-center type-helper">
        Inventory data will be available after saving the order.
      </p>
    );
  }
  if (isLoading) return <div className="py-8 flex justify-center"><Spinner label="Loading inventory…" /></div>;
  if (error) return <p className="py-8 text-center type-error">Failed to load inventory.</p>;
  if (items.length === 0) {
    return (
      <p className="py-8 text-center type-helper">
        This order has no catalog-linked lines — inventory is only tracked for items picked from the catalog.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto modal-scrollbar rounded-lg border border-stone-200">
      <table className="w-full text-left type-cell">
        <thead className="bg-stone-50 border-b border-stone-200">
          <tr>
            {HEADERS.map((h) => (
              <th key={h} className="px-3 py-2.5 whitespace-nowrap type-th">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-stone-100">
          {items.map((row) => (
            <tr key={row.itemId} className="hover:bg-stone-50/50">
              <td className="px-3 py-2.5 type-record-id">{row.sku}</td>
              {row.tracked === false ? (
                <>
                  <td className="type-cell px-3 py-2.5 tabular-nums text-right">{row.salesOrderQuantity.toLocaleString()}</td>
                  <td colSpan={4} className="type-cell px-3 py-2.5">Stock is not tracked for this item.</td>
                </>
              ) : (
                <>
                  <td className="type-cell px-3 py-2.5 tabular-nums text-right">{row.onHand.toLocaleString()}</td>
                  <td className="type-cell px-3 py-2.5 tabular-nums text-right">{row.salesOrderQuantity.toLocaleString()}</td>
                  <td className="px-3 py-2.5 tabular-nums text-right text-warning-ink font-medium">
                    {(row.reservedForOrder ?? 0).toLocaleString()}
                  </td>
                  <td className="type-cell px-3 py-2.5 tabular-nums text-right">{row.allocated.toLocaleString()}</td>
                  <td className="px-3 py-2.5 tabular-nums text-right">
                    <span className={cn('font-medium', row.available < 0 ? 'text-danger-ink' : 'text-success-ink')}>
                      {row.available.toLocaleString()}
                    </span>
                  </td>
                </>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
