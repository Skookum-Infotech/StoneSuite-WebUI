import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Users, Plus } from 'lucide-react';
import { crmService } from '@/services/crmService';
import { apiErrorMessage } from '@/api/tenantClient';
import { ProspectTable } from './components/ProspectTable';

export default function ProspectListPage() {
  const navigate = useNavigate();
  const prospectsQ = useQuery({
    queryKey: ['crm-records', 'prospect'],
    queryFn: () => crmService.listRecords('prospect'),
  });
  const records = prospectsQ.data ?? [];

  return (
    <div className="flex flex-1 flex-col min-h-0">
      <div className="flex flex-1 flex-col min-h-0 p-4 sm:p-6 3xl:p-10 4xl:p-14">

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent ring-1 ring-accent-foreground/10 shrink-0">
              <Users className="size-5 text-accent-foreground" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-stone-900">Prospects</h1>
              <p className="text-sm text-stone-500">Active sales opportunities. Create and track prospects.</p>
            </div>
          </div>

          <button
            onClick={() => navigate('/crm/prospect/new')}
            className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-stone-950 shadow-sm transition hover:bg-brand-hover active:scale-95"
          >
            <Plus className="size-3.5" />
            New Prospect
          </button>
        </div>

        {prospectsQ.isError && (
          <p className="mt-4 text-xs text-red-500">
            {apiErrorMessage(prospectsQ.error, 'Failed to load prospects.')}
          </p>
        )}

        <div className="mt-5 flex flex-1 flex-col min-h-0 border-t border-stone-100 pt-4">
          <ProspectTable records={records} isLoading={prospectsQ.isLoading} />
        </div>
      </div>
    </div>
  );
}
