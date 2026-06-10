import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Building2, Plus, Search, X, Pencil } from 'lucide-react';
import { crmService } from '@/services/crmService';
import { DeleteRecordDialog } from '@/components/crm/DeleteRecordDialog';
import { Badge } from '@/components/tenant/ui';
import type { WorkflowRecord, StatusInfo } from '@/types/tenant';

export default function CustomerListPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [nameFilter, setNameFilter]     = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const { data: records = [], isLoading, isError } = useQuery({
    queryKey: ['crm-records', 'customer'],
    queryFn: () => crmService.listRecords('customer'),
  });

  const { data: statusData } = useQuery({
    queryKey: ['crm-statuses-workflow', 'customer'],
    queryFn: () => crmService.getWorkflowStatuses('customer'),
  });

  const customerStatuses = useMemo(
    () => statusData?.statuses ?? [],
    [statusData],
  );

  const statusMap = useMemo(
    () => new Map<string, StatusInfo>(customerStatuses.map((s) => [s.stateId, s])),
    [customerStatuses],
  );

  const filtered = useMemo(() => {
    return records.filter((r: WorkflowRecord) => {
      const company = String(r.coreFields.company_name ?? '').toLowerCase();
      if (nameFilter && !company.includes(nameFilter.toLowerCase())) return false;
      if (statusFilter && r.currentStateId !== statusFilter) return false;
      return true;
    });
  }, [records, nameFilter, statusFilter]);

  const hasFilters = nameFilter || statusFilter;

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="bg-white p-6 flex-1 flex flex-col min-h-0">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand/20 text-brand-dark">
              <Building2 className="size-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-stone-900">Customers</h1>
              <p className="text-sm text-stone-500">Closed deals and active customer accounts.</p>
            </div>
          </div>
          <button
            onClick={() => navigate('/crm/customer/new')}
            className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-brand text-stone-950 py-2 px-3 text-xs font-semibold shadow-sm transition hover:bg-brand/50"
          >
            <Plus className="size-3.5" />
            New Customer
          </button>
        </div>

        {isError && (
          <p className="mt-4 text-xs text-red-500">Failed to load customers. Is the backend running?</p>
        )}

        <div className="mt-5 border-t border-stone-100 pt-4 flex-1 flex flex-col min-h-0">
          {/* Filter bar */}
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 size-3 text-stone-400" />
              <input
                type="text"
                placeholder="Company name…"
                value={nameFilter}
                onChange={(e) => setNameFilter(e.target.value)}
                className="h-8 w-44 rounded-md border border-stone-200 bg-white pl-7 pr-2.5 text-xs text-stone-800 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-brand/40 focus:border-brand"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="h-8 rounded-md border border-stone-200 bg-white px-2.5 text-xs text-stone-700 focus:outline-none focus:ring-2 focus:ring-brand/40 focus:border-brand"
              aria-label="Filter by status"
            >
              <option value="">All Statuses</option>
              {customerStatuses.map((s) => (
                <option key={s.stateId} value={s.stateId}>{s.statusLabel}</option>
              ))}
            </select>
            <div className="ml-auto flex items-center gap-2">
              {hasFilters && (
                <button
                  onClick={() => { setNameFilter(''); setStatusFilter(''); }}
                  className="flex items-center gap-1 rounded-md border border-stone-200 px-2 py-1 text-2xs text-stone-500 hover:bg-stone-50 transition-colors"
                >
                  <X className="size-2.5" />
                  Clear
                </button>
              )}
              <span className="text-2xs text-stone-400">
                {filtered.length} result{filtered.length !== 1 ? 's' : ''}
              </span>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-hidden rounded-md border border-stone-200 bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-brand/20 text-2xs uppercase tracking-wide text-brand-dark">
                  <tr>
                    <th className="px-3 py-2.5 font-semibold">Company Name</th>
                    <th className="px-3 py-2.5 font-semibold">Status</th>
                    <th className="px-3 py-2.5 font-semibold">Created</th>
                    <th className="px-3 py-2.5 font-semibold sr-only">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {filtered.map((record) => {
                    const statusInfo = statusMap.get(record.currentStateId);
                    const company = String(record.coreFields.company_name ?? '(unnamed)');
                    const label = `Customer — ${company}`;
                    return (
                      <tr key={record.id} className="hover:bg-stone-50/70 transition-colors">
                        <td className="px-3 py-2">
                          <span className="font-semibold text-stone-900">{company}</span>
                        </td>
                        <td className="px-3 py-2">
                          {statusInfo ? (
                            <Badge color={statusInfo.color}>{statusInfo.statusLabel}</Badge>
                          ) : (
                            <span className="text-stone-400">—</span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-stone-400">
                          {new Date(record.createdAt).toLocaleDateString(undefined, {
                            year: 'numeric', month: 'short', day: 'numeric',
                          })}
                        </td>
                        <td className="px-3 py-2">
                          <div className="flex items-center gap-1 justify-end">
                            <button
                              type="button"
                              onClick={() => navigate(`/crm/customer/${record.id}/edit`)}
                              aria-label={`Edit ${label}`}
                              className="rounded p-1 text-stone-400 transition hover:bg-stone-100 hover:text-stone-700"
                            >
                              <Pencil className="size-3.5" />
                            </button>
                            <DeleteRecordDialog
                              recordId={record.id}
                              label={label}
                              onDeleted={() =>
                                queryClient.invalidateQueries({ queryKey: ['crm-records', 'customer'] })
                              }
                            />
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {isLoading && (
              <div className="flex h-32 items-center justify-center text-xs text-stone-400">
                Loading customers…
              </div>
            )}
            {!isLoading && records.length === 0 && (
              <div className="flex h-32 items-center justify-center text-xs text-stone-400">
                No customers yet.
              </div>
            )}
            {!isLoading && records.length > 0 && filtered.length === 0 && (
              <div className="flex h-32 items-center justify-center text-xs text-stone-400">
                No customers match the current filters.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
