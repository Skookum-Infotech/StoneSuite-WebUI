import { Link } from 'react-router-dom';
import { Truck } from 'lucide-react';
import { useUserPermissions } from '@/hooks/useUserPermissions';
import { UNIT_STATUS_ON_ORDER, type InventoryUnit } from '@/types/inventory';

// A strip under the slab page's header, on every tab, for a slab that has been
// ordered but has not arrived: it is not stock yet, and the purchase order that
// put it on order is one click away. Renders nothing for any other slab.
export function UnitOnOrderBanner({ unit }: { unit: InventoryUnit }) {
  const { hasPermission, isLoading } = useUserPermissions();
  if (unit.status !== UNIT_STATUS_ON_ORDER) return null;

  const number = unit.purchaseOrderNumber || 'purchase order';
  // Opening the order needs its own read grant; without it the number is plain text.
  const canOpenOrder = Boolean(unit.purchaseOrderId) && (isLoading || hasPermission('purchase_order', 'read'));

  return (
    <div
      role="region"
      aria-label="Slab on order"
      className="shrink-0 flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-violet-200 bg-violet-50 px-5 py-2.5 3xl:px-12 4xl:px-16"
    >
      <span className="flex items-center gap-1.5 text-xs font-semibold text-violet-800">
        <Truck className="size-3.5 shrink-0" aria-hidden="true" />
        On order
      </span>
      {canOpenOrder ? (
        <Link
          to={`/purchases/purchase_order/${unit.purchaseOrderId}`}
          aria-label={`Open ${number}`}
          className="text-xs font-semibold text-violet-900 underline decoration-violet-300 underline-offset-2 hover:decoration-current"
        >
          {number}
        </Link>
      ) : (
        <span className="text-xs font-semibold text-violet-900">{number}</span>
      )}
      <span className="text-xs text-violet-800">
        Not in stock yet — it arrives when an item receipt that ticks it is posted.
      </span>
    </div>
  );
}
