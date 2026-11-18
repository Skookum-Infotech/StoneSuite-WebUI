import { Link } from 'react-router-dom';
import { fmtQty } from '@/lib/replenishment';
import type { OpenOrder } from '@/types/replenishment';

/** The purchase orders already counted towards an item's "on open POs" figure. */
export function OpenOrdersNote({ orders, unit }: { orders: ReadonlyArray<OpenOrder>; unit: string }) {
  if (orders.length === 0) return null;
  return (
    <p className="mt-3 type-helper">
      Already on order:{' '}
      {orders.map((o, i) => (
        <span key={o.id}>
          {i > 0 && ' · '}
          <Link
            to={`/purchases/purchase_order/${o.id}`}
            className="font-medium text-ink underline-offset-2 hover:underline"
            aria-label={`Open purchase order ${o.number || 'draft'}`}
          >
            {o.number || 'Draft PO'}
          </Link>{' '}
          ({fmtQty(o.remaining)} {unit} left, {o.status})
        </span>
      ))}
    </p>
  );
}
