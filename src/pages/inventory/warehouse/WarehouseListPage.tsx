import { Warehouse as LocationIcon, Building2 } from 'lucide-react';
import { apiErrorMessage } from '@/api/tenantClient';
import { useInventoryLookups } from '@/hooks/useInventoryLookups';
import { Spinner, ErrorNote } from '@/components/tenant/ui';
import { LocationCard } from '@/pages/config/company-profile/components/LocationCard';

// Inventory → Locations: the tenant's Company Info locations, read-only, laid
// out exactly like Configuration → Company Info → Locations. A location is the
// place stock is held, but it is created, edited, made the default and deleted
// only in Company Info, so there is nothing to add or change here.
export default function WarehouseListPage() {
  const { lookups, isLoading, error } = useInventoryLookups();
  const locations = lookups?.warehouses ?? [];

  return (
    <div className="flex flex-1 flex-col min-h-0 bg-stone-50/60">
      <div className="bg-background border-b border-stone-200 px-4 py-3 sm:px-5 sm:py-4">
        <div className="flex items-center gap-3.5">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand/15 text-brand-dark">
            <LocationIcon className="size-6" strokeWidth={2.5} />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-stone-900 dark:text-white">Locations</h1>
            <p className="text-sm text-stone-500 mt-0.5">The places your stock is held.</p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        <div className="mx-auto w-full max-w-[1500px] 3xl:max-w-[1800px] 4xl:max-w-full px-6 py-6">
          {isLoading ? (
            <div className="flex items-center justify-center h-40">
              <Spinner label="Loading locations…" />
            </div>
          ) : error ? (
            <div className="max-w-lg">
              <ErrorNote>{apiErrorMessage(error, 'Failed to load locations.')}</ErrorNote>
            </div>
          ) : (
            <div className="w-full space-y-4 sm:space-y-5">
              {locations.map((location) => (
                <LocationCard key={location.id} location={location} />
              ))}

              {locations.length === 0 && (
                <div className="w-full rounded-2xl border border-dashed border-stone-200 bg-white overflow-hidden">
                  <div className="px-5 py-4 sm:px-6 sm:py-5">
                    <div className="flex items-center gap-2">
                      <Building2 className="size-4 text-stone-400" />
                      <h3 className="text-sm font-bold text-stone-900">No locations yet</h3>
                    </div>
                    <p className="mt-2 text-xs text-stone-500">
                      Locations are set up in Company Info. Once one is added it appears here and in every location dropdown.
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
