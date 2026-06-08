import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Users, Plus } from 'lucide-react';
import { prospectService } from '@/services/prospectService';
import { apiErrorMessage } from '@/api/tenantClient';
import { ProspectTable } from './components/ProspectTable';

export default function ProspectListPage() {
  const navigate = useNavigate();
  const prospectsQ = useQuery({ queryKey: ['prospects'], queryFn: prospectService.list });
  const prospects = prospectsQ.data ?? [];

  return (
    <div className="flex flex-1 flex-col min-h-0">
      <div className="flex flex-1 flex-col min-h-0 bg-white p-6">

        {/* Page header */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand/20 text-brand-dark">
              <Users className="size-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-stone-900">Prospects</h1>
              <p className="text-sm text-stone-500">Active sales opportunities. Create and track prospects.</p>
            </div>
          </div>

          <button
            onClick={() => navigate('/prospects/new')}
            className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-brand px-3 py-2 text-xs font-semibold text-stone-950 shadow-sm transition hover:bg-brand/50"
          >
            <Plus className="size-3.5" />
            New Prospect
          </button>
        </div>

        {/* Error state */}
        {prospectsQ.isError && (
          <p className="mt-4 text-xs text-red-500">
            {apiErrorMessage(prospectsQ.error, 'Failed to load prospects.')}
          </p>
        )}

        {/* Table */}
        <div className="mt-5 flex flex-1 flex-col min-h-0 border-t border-stone-100 pt-4">
          <ProspectTable
            prospects={prospects}
            isLoading={prospectsQ.isLoading}
          />
        </div>
      </div>
    </div>
  );
}
