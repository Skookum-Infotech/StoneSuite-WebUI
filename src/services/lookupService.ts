import { tenantClient } from '@/api/tenantClient';

export interface LookupItem {
  id: number;
  code: string;
  name: string;
}

export interface StateLookupItem extends LookupItem {
  countryId: number;
}

export interface CrmLookups {
  customerTypes: LookupItem[];
  arStatuses: LookupItem[];
  paymentTerms: LookupItem[];
  currencies: LookupItem[];
  countries: LookupItem[];
  states: StateLookupItem[];
  leadSources: LookupItem[];
  contactMethods: LookupItem[];
}

export const lookupService = {
  getCrmLookups: (): Promise<CrmLookups> =>
    tenantClient
      .get<{ success: boolean; lookups: CrmLookups }>('/tenant/crm/lookups')
      .then((r) => r.data.lookups),
};
