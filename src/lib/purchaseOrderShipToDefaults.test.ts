import { describe, it, expect } from 'vitest';
import { purchaseOrderShipToDefaults } from './purchaseOrderShipToDefaults';
import type { CompanyProfile } from '@/types/companyProfile';

function companyProfile(overrides: Partial<CompanyProfile> = {}): CompanyProfile {
  return {
    companyName: 'Acme Stone Co.',
    legalName: '',
    industry: '',
    website: '',
    country: '',
    currency: '',
    timezone: '',
    taxId: '',
    billingAddress: { line1: '', line2: '', suite: '', city: '', country: '', state: '', zip: '' },
    shippingAddress: {
      line1: '456 Shop St', line2: '', suite: 'Bay 2', city: 'Springfield', country: 'United States', state: 'IL', zip: '62704',
    },
    returnAddress: { line1: '', line2: '', suite: '', city: '', country: '', state: '', zip: '' },
    ...overrides,
  };
}

describe('purchaseOrderShipToDefaults', () => {
  it('maps the company info shipping address onto ship_* fields', () => {
    const result = purchaseOrderShipToDefaults(companyProfile());
    expect(result).toEqual({
      ship_name: 'Acme Stone Co.',
      ship_address1: '456 Shop St',
      ship_address2: '',
      ship_suite: 'Bay 2',
      ship_city: 'Springfield',
      ship_zip: '62704',
    });
  });

  it('returns empty when no company name is set', () => {
    const result = purchaseOrderShipToDefaults(companyProfile({ companyName: '' }));
    expect(result).toEqual({});
  });

  it('returns empty when company profile is undefined', () => {
    const result = purchaseOrderShipToDefaults(undefined);
    expect(result).toEqual({});
  });
});
