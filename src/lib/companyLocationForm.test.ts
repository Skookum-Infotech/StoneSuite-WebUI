import { describe, it, expect } from 'vitest';
import { companyLocationSchema, MAX_FIELD_LENGTH } from './companyLocationForm';

describe('companyLocationSchema', () => {
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
    name: 'Main Office',
    phone: '415-555-0100',
    address,
  };

  it('accepts a fully populated location', () => {
    expect(companyLocationSchema.safeParse(valid).success).toBe(true);
  });

  it('accepts a location with only the required name', () => {
    const result = companyLocationSchema.safeParse({ name: 'Main Office' });
    expect(result.success).toBe(true);
  });

  it('defaults every address field to an empty string when omitted', () => {
    const result = companyLocationSchema.safeParse({ name: 'Main Office' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.address).toEqual({
        line1: '', line2: '', suite: '', city: '', country: '', state: '', zip: '',
      });
    }
  });

  it('defaults phone to an empty string when omitted', () => {
    const result = companyLocationSchema.safeParse({ name: 'Main Office' });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.phone).toBe('');
  });

  it('rejects a missing name', () => {
    const { name: _name, ...rest } = valid;
    expect(companyLocationSchema.safeParse(rest).success).toBe(false);
  });

  it('rejects an empty name', () => {
    expect(companyLocationSchema.safeParse({ ...valid, name: '' }).success).toBe(false);
  });

  it('rejects a whitespace-only name', () => {
    expect(companyLocationSchema.safeParse({ ...valid, name: '   ' }).success).toBe(false);
  });

  it('trims surrounding whitespace from the name', () => {
    const result = companyLocationSchema.safeParse({ ...valid, name: '  Main Office  ' });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.name).toBe('Main Office');
  });

  it('accepts a name at the max length', () => {
    const name = 'a'.repeat(MAX_FIELD_LENGTH);
    expect(companyLocationSchema.safeParse({ ...valid, name }).success).toBe(true);
  });

  it('rejects a name over the max length', () => {
    const name = 'a'.repeat(MAX_FIELD_LENGTH + 1);
    expect(companyLocationSchema.safeParse({ ...valid, name }).success).toBe(false);
  });

  it('rejects a phone over the max length', () => {
    const phone = 'a'.repeat(MAX_FIELD_LENGTH + 1);
    expect(companyLocationSchema.safeParse({ ...valid, phone }).success).toBe(false);
  });

  it('accepts an address line1 at the max length', () => {
    const line1 = 'a'.repeat(MAX_FIELD_LENGTH);
    expect(companyLocationSchema.safeParse({ ...valid, address: { ...address, line1 } }).success).toBe(true);
  });

  it('rejects an address line1 over the max length', () => {
    const line1 = 'a'.repeat(MAX_FIELD_LENGTH + 1);
    expect(companyLocationSchema.safeParse({ ...valid, address: { ...address, line1 } }).success).toBe(false);
  });

  it('rejects an address city over the max length', () => {
    const city = 'a'.repeat(MAX_FIELD_LENGTH + 1);
    expect(companyLocationSchema.safeParse({ ...valid, address: { ...address, city } }).success).toBe(false);
  });
});
