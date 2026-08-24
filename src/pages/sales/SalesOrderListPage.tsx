import { useNavigate } from 'react-router-dom';
import { ShoppingCart, Plus } from 'lucide-react';
import { useAuthStore } from '@/store/useAuthStore';
import { SalesOrderTable } from './components/SalesOrderTable';

export default function SalesOrderListPage() {
  const navigate = useNavigate();
  // A customer-portal session reads this same page (see CLAUDE.md's
  // merged-login design) but never creates a sales order — the backend has
  // no such endpoint under /api/portal/*, so the button would always 404.
  const isCustomer = useAuthStore((s) => s.kind === 'portal');

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="p-4 sm:p-6 3xl:p-10 4xl:p-14 flex-1 flex flex-col min-h-0">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent ring-1 ring-accent-foreground/10 shrink-0">
              <ShoppingCart className="size-5 text-accent-foreground" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-stone-900">Sales Orders</h1>
              <p className="text-sm text-stone-500">Confirmed customer orders ready for fulfillment.</p>
            </div>
          </div>
          {!isCustomer && (
            <button
              onClick={() => navigate('/sales/sales_order/new')}
              className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-brand text-stone-950 py-2 px-4 text-sm font-semibold shadow-sm transition hover:bg-brand-hover active:scale-95"
            >
              <Plus className="size-3.5" />
              New Sales Order
            </button>
          )}
        </div>

        <div className="mt-5 border-t border-stone-100 pt-4 flex-1 flex flex-col min-h-0">
          <SalesOrderTable />
        </div>
      </div>
    </div>
  );
}
