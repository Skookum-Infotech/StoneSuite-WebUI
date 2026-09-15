import { describe, it, expect } from 'vitest';
import { companyProfileSchema, MAX_FIELD_LENGTH } from './companyProfileForm';

describe('companyProfileSchema', () => {
  const address = {
    line1: '123 Main St',
    line2: 'Suite 400',
    suite: '400',
    city: 'Springfield',
    country: 'United States',
    state: 'IL',
    zip: '62704',
  };

  const valid = {
    companyName: 'Acme Stone Co.',
    legalName: 'Acme Stone Company LLC',
    industry: 'Fabrication',
    website: 'https://acmestone.example',
    country: 'United States',
    currency: 'USD',
    timezone: 'America/Chicago',
    taxId: '12-3456789',
    billingAddress: address,
    shippingAddress: address,
    returnAddress: address,
  };

  it('accepts a fully populated profile', () => {
    expect(companyProfileSchema.safeParse(valid).success).toBe(true);
  });

  it('accepts a profile with only the required company name', () => {
    const result = companyProfileSchema.safeParse({ companyName: 'Acme Stone Co.' });
    expect(result.success).toBe(true);
  });

  it('defaults every address field to an empty string when omitted', () => {
    const result = companyProfileSchema.safeParse({ companyName: 'Acme Stone Co.' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.billingAddress).toEqual({
        line1: '', line2: '', suite: '', city: '', country: '', state: '', zip: '',
      });
    }
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
    const name = 'a'.repeat(MAX_FIELD_LENGTH);
    expect(companyProfileSchema.safeParse({ ...valid, companyName: name }).success).toBe(true);
  });

  it('rejects a company name over the max length', () => {
    const name = 'a'.repeat(MAX_FIELD_LENGTH + 1);
    expect(companyProfileSchema.safeParse({ ...valid, companyName: name }).success).toBe(false);
  });

  it('rejects a website over the max length', () => {
    const website = 'a'.repeat(MAX_FIELD_LENGTH + 1);
    expect(companyProfileSchema.safeParse({ ...valid, website }).success).toBe(false);
  });

  it('accepts a billing address line1 at the max length', () => {
    const line1 = 'a'.repeat(MAX_FIELD_LENGTH);
    expect(companyProfileSchema.safeParse({ ...valid, billingAddress: { ...address, line1 } }).success).toBe(true);
  });

  it('rejects a billing address line1 over the max length', () => {
    const line1 = 'a'.repeat(MAX_FIELD_LENGTH + 1);
    expect(companyProfileSchema.safeParse({ ...valid, billingAddress: { ...address, line1 } }).success).toBe(false);
  });

  it('rejects a shipping address city over the max length', () => {
    const city = 'a'.repeat(MAX_FIELD_LENGTH + 1);
    expect(companyProfileSchema.safeParse({ ...valid, shippingAddress: { ...address, city } }).success).toBe(false);
  });
});
