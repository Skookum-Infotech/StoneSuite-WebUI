import type { CrmLookups } from '@/services/lookupService';
import type { OptionFlag } from '@/lib/flags';

export interface GeoPart {
  name: string;
  flag: OptionFlag;
}

export interface ResolvedGeo {
  state: GeoPart | null;
  country: GeoPart | null;
}

type GeoLookups = Pick<CrmLookups, 'countries' | 'states'>;

/** Resolves a document address's stateId/countryId to display names + flags. */
export function resolveGeo(
  lookups: GeoLookups | undefined,
  stateId: number | null | undefined,
  countryId: number | null | undefined,
): ResolvedGeo {
  const state = (stateId !== null && stateId !== undefined) ? (lookups?.states ?? []).find((s) => s.id === stateId) : undefined;
  const country = (countryId !== null && countryId !== undefined) ? (lookups?.countries ?? []).find((c) => c.id === countryId) : undefined;
  return {
    state: state ? { name: state.name, flag: { kind: 'state', code: state.code } } : null,
    country: country ? { name: country.name, flag: { kind: 'country', code: country.code } } : null,
  };
}
