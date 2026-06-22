import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Building2, Plus } from 'lucide-react';
import { crmService } from '@/services/crmService';
import { CustomerTable } from './components/CustomerTable';

export default function CustomerListPage() {
  const navigate = useNavigate();

  const { data: records = [], isLoading, isError } = useQuery({
    queryKey: ['crm-records', 'customer'],
    queryFn: () => crmService.listRecords('customer'),
  });

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="p-6 xl:p-8 2xl:p-10 flex-1 flex flex-col min-h-0">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent ring-1 ring-accent-foreground/10 shrink-0">
              <Building2 className="size-5 text-accent-foreground" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-stone-900">Customers</h1>
              <p className="text-sm text-stone-500">Closed deals and active customer accounts.</p>
            </div>
          </div>
          <button
            onClick={() => navigate('/crm/customer/new')}
            className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-brand text-stone-950 py-2 px-4 text-sm font-semibold shadow-sm transition hover:bg-brand-hover active:scale-95"
          >
            <Plus className="size-3.5" />
            New Customer
          </button>
        </div>

        {isError && (
          <p className="mt-4 text-xs text-red-500">Failed to load customers. Is the backend running?</p>
        )}

        <div className="mt-5 border-t border-stone-100 pt-4 flex-1 flex flex-col min-h-0">
          <CustomerTable records={records} isLoading={isLoading} />
        </div>
      </div>
    </div>
  );
}
