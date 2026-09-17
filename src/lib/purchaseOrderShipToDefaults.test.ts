import { describe, it, expect } from 'vitest';
import { purchaseOrderShipToDefaults } from './purchaseOrderShipToDefaults';
import type { CompanyLocation, CompanyProfile } from '@/types/companyProfile';

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

function companyLocation(overrides: Partial<CompanyLocation> = {}): CompanyLocation {
  return {
    id: 'loc-1',
    name: 'Downtown Warehouse',
    phone: '555-0199',
    address: {
      line1: '789 Warehouse Ave', line2: 'Dock 3', suite: '', city: 'Metropolis', country: 'United States', state: 'IL', zip: '62701',
    },
    isDefault: true,
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

  it('prefers the default location over the company profile shipping address when both exist', () => {
    const result = purchaseOrderShipToDefaults(companyProfile(), companyLocation());
    expect(result).toEqual({
      ship_name: 'Downtown Warehouse',
      ship_address1: '789 Warehouse Ave',
      ship_address2: 'Dock 3',
      ship_suite: '',
      ship_city: 'Metropolis',
      ship_zip: '62701',
      ship_phone: '555-0199',
    });
  });

  it('falls back to the company profile shipping address when no default location is given', () => {
    const result = purchaseOrderShipToDefaults(companyProfile(), undefined);
    expect(result).toEqual({
      ship_name: 'Acme Stone Co.',
      ship_address1: '456 Shop St',
      ship_address2: '',
      ship_suite: 'Bay 2',
      ship_city: 'Springfield',
      ship_zip: '62704',
    });
  });

  it('uses the default location even when there is no company profile', () => {
    const result = purchaseOrderShipToDefaults(undefined, companyLocation());
    expect(result).toEqual({
      ship_name: 'Downtown Warehouse',
      ship_address1: '789 Warehouse Ave',
      ship_address2: 'Dock 3',
      ship_suite: '',
      ship_city: 'Metropolis',
      ship_zip: '62701',
      ship_phone: '555-0199',
    });
  });
});
