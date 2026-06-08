import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Users, Plus, ChevronRight } from 'lucide-react';
import { prospectService } from '@/services/prospectService';
import { apiErrorMessage } from '@/api/tenantClient';
import { Badge, Spinner, ErrorNote, EmptyState } from '@/components/tenant/ui';

export default function ProspectListPage() {
  const navigate = useNavigate();
  const prospectsQ = useQuery({ queryKey: ['prospects'], queryFn: prospectService.list });
  const prospects = prospectsQ.data ?? [];

  return (
    <div className="flex flex-1 flex-col min-h-0">
      <div className="flex flex-1 flex-col min-h-0 bg-white p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand/20 text-brand-dark">
              <Users className="size-4.5" />
            </div>
            <div>
              <h1 className="text-base font-bold tracking-tight text-stone-900">Prospects</h1>
              <p className="text-xs text-stone-500">Active sales opportunities. Create and track prospects.</p>
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

        <div className="mt-5 flex flex-1 flex-col min-h-0 border-t border-stone-100 pt-4">
          {prospectsQ.isLoading && <Spinner label="Loading prospects…" />}
          {prospectsQ.isError && (
            <ErrorNote>{apiErrorMessage(prospectsQ.error, 'Failed to load prospects.')}</ErrorNote>
          )}
          {!prospectsQ.isLoading && !prospectsQ.isError && prospects.length === 0 && (
            <EmptyState>No prospects yet — create your first one.</EmptyState>
          )}

          {prospects.length > 0 && (
            <div className="space-y-2">
              {prospects.map((prospect) => (
                <button
                  key={prospect.id}
                  type="button"
                  onClick={() => navigate(`/prospects/${prospect.id}`)}
                  aria-label={`View prospect ${prospect.company_name || 'unnamed'}`}
                  className="flex w-full items-center justify-between gap-3 rounded-xl border border-stone-200 px-4 py-3 text-left transition hover:bg-stone-50/60"
                >
                  <div>
                    <p className="text-sm font-bold text-stone-800">
                      {prospect.company_name || '(unnamed prospect)'}
                    </p>
                    <p className="text-label text-stone-500">
                      {prospect.email || prospect.customer_type || '—'}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    {prospect.status && <Badge>{prospect.status}</Badge>}
                    <span className="hidden text-label text-stone-400 sm:inline">
                      {prospect.created_at ? new Date(prospect.created_at).toLocaleDateString() : ''}
                    </span>
                    <ChevronRight className="size-4 text-stone-400" />
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
