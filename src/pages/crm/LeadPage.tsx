import { Sparkles, Plus } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { LeadTable } from './components/LeadTable';
import { leadService } from '@/services/leadService';

export default function LeadPage() {
  const navigate = useNavigate();

  const { data: leads = [], isLoading, isError } = useQuery({
    queryKey: ['leads'],
    queryFn: leadService.list,
  });

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="bg-white p-6 flex-1 flex flex-col min-h-0">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand/20 text-brand-dark">
              <Sparkles className="size-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-stone-900">Leads</h1>
              <p className="text-sm text-stone-500">Track and manage your sales leads pipeline.</p>
            </div>
          </div>
          <button
            onClick={() => navigate('/crm/lead/new')}
            className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-brand text-stone-950 py-2 px-3 text-xs font-semibold shadow-sm transition hover:bg-brand/50 cursor-pointer"
          >
            <Plus className="size-3.5" />
            New Lead
          </button>
        </div>

        <div className="mt-5 border-t border-stone-100 pt-4 flex-1 flex flex-col min-h-0">
          {isError && (
            <p className="text-xs text-red-500 mb-3">Failed to load leads. Is the backend running?</p>
          )}
          <LeadTable leads={leads} isLoading={isLoading} />
        </div>
      </div>
    </div>
  );
}
