import { useQuery } from '@tanstack/react-query';
import { Flag } from '@/components/ui/Flag';
import { resolveGeo, type GeoPart } from '@/lib/addressGeo';
import { lookupService } from '@/services/lookupService';
import { isPortalSession } from '@/store/useAuthStore';

const LOOKUPS_STALE_MS = 10 * 60 * 1000;

function GeoName({ part }: { part: GeoPart }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <Flag {...part.flag} />
      {part.name}
    </span>
  );
}

// "[flag] Texas  [flag] United States" for a document address's state/country
// ids. Shares the ['crm-lookups'] cache the detail pages already populate, and
// renders nothing until (or unless) the ids resolve. A portal session never
// asks: its token is confined to /api/portal/*, which has no lookups endpoint
// (the backend answers 403 and logs a security event), so no flag is shown there.
export function AddressGeoLine({ stateId, countryId }: { stateId?: number | null; countryId?: number | null }) {
  const { data: lookups } = useQuery({
    queryKey: ['crm-lookups'],
    queryFn: lookupService.getCrmLookups,
    staleTime: LOOKUPS_STALE_MS,
    enabled: !isPortalSession(),
  });
  const { state, country } = resolveGeo(lookups, stateId, countryId);
  if (!state && !country) return null;
  return (
    <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-stone-600">
      {state && <GeoName part={state} />}
      {country && <GeoName part={country} />}
    </p>
  );
}
