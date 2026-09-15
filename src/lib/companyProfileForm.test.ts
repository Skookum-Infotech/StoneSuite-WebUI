import { describe, it, expect } from 'vitest';
import { companyProfileSchema, MAX_SHORT_FIELD_LENGTH, MAX_ADDRESS_LENGTH } from './companyProfileForm';

describe('companyProfileSchema', () => {
  const valid = {
    companyName: 'Acme Stone Co.',
    legalName: 'Acme Stone Company LLC',
    industry: 'Fabrication',
    website: 'https://acmestone.example',
    country: 'United States',
    currency: 'USD',
    timezone: 'America/Chicago',
    taxId: '12-3456789',
    billingAddress: '123 Main St, Springfield, IL 62704',
    shippingAddress: '456 Warehouse Ave, Springfield, IL 62704',
    returnAddress: '789 Returns Dock, Springfield, IL 62704',
  };

  it('accepts a fully populated profile', () => {
    expect(companyProfileSchema.safeParse(valid).success).toBe(true);
  });

  it('accepts a profile with only the required company name', () => {
    const result = companyProfileSchema.safeParse({ companyName: 'Acme Stone Co.' });
    expect(result.success).toBe(true);
  });

  it('rejects a missing company name', () => {
    const { companyName: _companyName, ...rest } = valid;
    expect(companyProfileSchema.safeParse(rest).success).toBe(false);
  });

  it('rejects an empty company name', () => {
    expect(companyProfileSchema.safeParse({ ...valid, companyName: '' }).success).toBe(false);
  });

  it('rejects a whitespace-only company name', () => {
    expect(companyProfileSchema.safeParse({ ...valid, companyName: '   ' }).success).toBe(false);
  });

  it('trims surrounding whitespace from the company name', () => {
    const result = companyProfileSchema.safeParse({ ...valid, companyName: '  Acme Stone Co.  ' });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.companyName).toBe('Acme Stone Co.');
  });

  it('accepts a company name at the max length', () => {
    const name = 'a'.repeat(MAX_SHORT_FIELD_LENGTH);
    expect(companyProfileSchema.safeParse({ ...valid, companyName: name }).success).toBe(true);
  });

  it('rejects a company name over the max length', () => {
    const name = 'a'.repeat(MAX_SHORT_FIELD_LENGTH + 1);
    expect(companyProfileSchema.safeParse({ ...valid, companyName: name }).success).toBe(false);
  });

  it('rejects a website over the max length', () => {
    const website = 'a'.repeat(MAX_SHORT_FIELD_LENGTH + 1);
    expect(companyProfileSchema.safeParse({ ...valid, website }).success).toBe(false);
  });

  it('accepts a billing address at the max length', () => {
    const billingAddress = 'a'.repeat(MAX_ADDRESS_LENGTH);
    expect(companyProfileSchema.safeParse({ ...valid, billingAddress }).success).toBe(true);
  });

  it('rejects a billing address over the max length', () => {
    const billingAddress = 'a'.repeat(MAX_ADDRESS_LENGTH + 1);
    expect(companyProfileSchema.safeParse({ ...valid, billingAddress }).success).toBe(false);
  });
});
