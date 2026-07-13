import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Building, Plus, Inbox, User, Building2 } from 'lucide-react';
import { vendorService } from '@/services/vendorService';
import { VENDOR_STATUS_COLORS } from '@/types/vendor';

export default function VendorListPage() {
  const navigate = useNavigate();

  const { data, isLoading, isError } = useQuery({
    queryKey: ['vendors'],
    queryFn: () => vendorService.searchVendors({ sort: [{ field: 'created_at', dir: 'desc' }], limit: 25 }),
  });
  const vendors = data?.records ?? [];

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="p-4 sm:p-6 3xl:p-10 4xl:p-14 flex-1 flex flex-col min-h-0">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent ring-1 ring-accent-foreground/10 shrink-0">
              <Building className="size-5 text-accent-foreground" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-stone-900">Vendors</h1>
              <p className="text-sm text-stone-500">Suppliers and contractors your business orders from.</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => navigate('/purchases/vendor/new')}
            aria-label="Create a new vendor"
            className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-brand text-stone-950 py-2 px-4 text-sm font-semibold shadow-sm transition hover:bg-brand-hover active:scale-95"
          >
            <Plus className="size-3.5" />
            New Vendor
          </button>
        </div>

        <div className="mt-5 border-t border-stone-100 pt-4 flex-1 flex flex-col min-h-0">
          {isError && (
            <p className="mb-3 text-xs text-red-500">Failed to load vendors. Please try again.</p>
          )}

          <div className="overflow-hidden rounded-xl border border-stone-200 bg-white shadow-sm">
            <div className="overflow-x-auto modal-scrollbar">
              <table className="w-full min-w-[640px] text-left text-xs">
                <thead className="border-b border-stone-200 bg-table-header">
                  <tr>
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-stone-500">Vendor #</th>
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-stone-500">Name</th>
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-stone-500">Type</th>
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-stone-500">Status</th>
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-stone-500">Email</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {isLoading ? (
                    Array.from({ length: 5 }, (_, i) => (
                      <tr key={i}>
                        <td className="px-4 py-3"><div className="animate-pulse h-3 rounded bg-stone-100 w-16" /></td>
                        <td className="px-4 py-3"><div className="animate-pulse h-3 rounded bg-stone-100 w-36" /></td>
                        <td className="px-4 py-3"><div className="animate-pulse h-3 rounded bg-stone-100 w-20" /></td>
                        <td className="px-4 py-3"><div className="animate-pulse h-3 rounded bg-stone-100 w-16" /></td>
                        <td className="px-4 py-3"><div className="animate-pulse h-3 rounded bg-stone-100 w-32" /></td>
                      </tr>
                    ))
                  ) : vendors.length > 0 ? (
                    vendors.map((vendor) => {
                      const TypeIcon = vendor.vendorType === 'Person' ? User : Building2;
                      const statusColor = VENDOR_STATUS_COLORS[vendor.status] ?? '#a8a29e';
                      return (
                        <tr key={vendor.id} className="group hover:bg-accent/10 transition-colors duration-150">
                          <td className="px-4 py-3.5 font-mono text-xs font-semibold text-stone-900">
                            {vendor.vendorNumber || '—'}
                          </td>
                          <td className="px-4 py-3.5 text-xs text-stone-700 truncate max-w-[240px]">
                            {vendor.displayName}
                          </td>
                          <td className="px-4 py-3.5">
                            <span className="inline-flex items-center gap-1.5 rounded-md bg-stone-100 px-2.5 py-1 text-xs font-medium text-stone-600 whitespace-nowrap">
                              <TypeIcon className="size-3" />
                              {vendor.vendorType}
                            </span>
                          </td>
                          <td className="px-4 py-3.5">
                            <span
                              className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-semibold text-stone-600 whitespace-nowrap"
                              style={{ backgroundColor: `${statusColor}18` }}
                            >
                              <span className="size-1.5 shrink-0 rounded-full" style={{ backgroundColor: statusColor }} aria-hidden="true" />
                              {vendor.status}
                            </span>
                          </td>
                          <td className="px-4 py-3.5 text-xs text-stone-400 whitespace-nowrap">
                            {vendor.email || '—'}
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={5} className="py-16 text-center">
                        <div className="flex flex-col items-center gap-3">
                          <div className="rounded-2xl bg-stone-100 p-4">
                            <Inbox className="size-6 text-stone-400" />
                          </div>
                          <p className="text-sm font-semibold text-stone-700">No vendors added yet.</p>
                          <p className="text-xs text-stone-400">Create your first vendor to get started.</p>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
