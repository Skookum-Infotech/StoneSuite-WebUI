import { ShoppingCart, Plus } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { SalesOrderTable } from './components/SalesOrderTable';
import { crmService } from '@/services/crmService';

export default function SalesOrderListPage() {
  const navigate = useNavigate();

  const { data: records = [], isLoading, isError } = useQuery({
    queryKey: ['crm-records', 'sales_order'],
    queryFn: () => crmService.listRecords('sales_order'),
  });

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="bg-white p-6 flex-1 flex flex-col min-h-0">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand/20 text-brand-dark">
              <ShoppingCart className="size-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-stone-900">Sales Orders</h1>
              <p className="text-sm text-stone-500">Manage and track all customer sales orders.</p>
            </div>
          </div>
          <button
            onClick={() => navigate('/sales/sales_order/new')}
            className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-brand text-stone-950 py-2 px-3 text-xs font-semibold shadow-sm transition hover:bg-brand/50 cursor-pointer"
          >
            <Plus className="size-3.5" />
            New Sales Order
          </button>
        </div>

        <div className="mt-5 border-t border-stone-100 pt-4 flex-1 flex flex-col min-h-0">
          {isError && (
            <p className="text-xs text-red-500 mb-3">
              Failed to load sales orders. Is the backend running?
            </p>
          )}
          <SalesOrderTable records={records} isLoading={isLoading} />
        </div>
      </div>
    </div>
  );
}
