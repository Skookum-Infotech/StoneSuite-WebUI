import { describe, it, expect } from 'vitest';
import { purchaseOrderShipToDefaults } from './purchaseOrderShipToDefaults';
import type { Warehouse } from '@/types/inventory';
import type { CompanyProfile } from '@/types/companyProfile';

function warehouse(overrides: Partial<Warehouse> = {}): Warehouse {
  return {
    id: 'wh-1',
    name: 'Main Warehouse',
    code: 'MAIN',
    addrLine1: '100 Industrial Pkwy',
    addrLine2: 'Dock 3',
    addrCity: 'Springfield',
    addrStateId: 17,
    addrZip: '62704',
    isDefault: true,
    isActive: true,
    isSystem: false,
    ...overrides,
  };
}

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
  it('prefers the default warehouse when one is configured', () => {
    const result = purchaseOrderShipToDefaults([warehouse()], companyProfile());
    expect(result).toEqual({
      ship_name: 'Main Warehouse',
      ship_address1: '100 Industrial Pkwy',
      ship_address2: 'Dock 3',
      ship_city: 'Springfield',
      ship_state: '17',
      ship_zip: '62704',
    });
  });

  it('ignores a non-default warehouse', () => {
    const result = purchaseOrderShipToDefaults([warehouse({ isDefault: false })], companyProfile());
    expect(result.ship_name).toBe('Acme Stone Co.');
  });

  it('ignores an inactive default warehouse', () => {
    const result = purchaseOrderShipToDefaults([warehouse({ isActive: false })], companyProfile());
    expect(result.ship_name).toBe('Acme Stone Co.');
  });

  it('falls back to company info when no warehouses exist', () => {
    const result = purchaseOrderShipToDefaults([], companyProfile());
    expect(result).toEqual({
      ship_name: 'Acme Stone Co.',
      ship_address1: '456 Shop St',
      ship_address2: '',
      ship_suite: 'Bay 2',
      ship_city: 'Springfield',
      ship_zip: '62704',
    });
  });

  it('falls back to company info when warehouses is undefined', () => {
    const result = purchaseOrderShipToDefaults(undefined, companyProfile());
    expect(result.ship_name).toBe('Acme Stone Co.');
  });

  it('omits a warehouse with no addrStateId', () => {
    const result = purchaseOrderShipToDefaults([warehouse({ addrStateId: null })], companyProfile());
    expect(result.ship_state).toBe('');
  });

  it('returns empty when neither a default warehouse nor a company name exists', () => {
    const result = purchaseOrderShipToDefaults([], companyProfile({ companyName: '' }));
    expect(result).toEqual({});
  });

  it('returns empty when company profile is undefined and no warehouse exists', () => {
    const result = purchaseOrderShipToDefaults([], undefined);
    expect(result).toEqual({});
  });
});
