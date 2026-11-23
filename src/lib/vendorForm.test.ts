import { describe, it, expect } from 'vitest';
import { validateVendorForm, vendorDefaults, vendorNameForDuplicateCheck } from './vendorForm';

describe('vendorNameForDuplicateCheck', () => {
  it('uses the legal name for an Organization', () => {
    expect(vendorNameForDuplicateCheck({ vendor_type: 'Organization', legal_name: '  Acme Stone Supply, LLC ' }))
      .toBe('Acme Stone Supply, LLC');
  });

  it('joins first and last name for a Person', () => {
    expect(vendorNameForDuplicateCheck({ vendor_type: 'Person', given_name: 'Jane', family_name: 'Doe' }))
      .toBe('Jane Doe');
  });

  it('trims and drops a missing half of a Person name', () => {
    expect(vendorNameForDuplicateCheck({ vendor_type: 'Person', given_name: ' Jane ', family_name: '' }))
      .toBe('Jane');
  });

  it('defaults to Organization when vendor_type is unset', () => {
    expect(vendorNameForDuplicateCheck({ legal_name: 'Acme Corp' })).toBe('Acme Corp');
  });

  it('returns an empty string when no name field has been filled in', () => {
    expect(vendorNameForDuplicateCheck({ vendor_type: 'Person' })).toBe('');
    expect(vendorNameForDuplicateCheck({ vendor_type: 'Organization' })).toBe('');
  });
});

describe('validateVendorForm email (required)', () => {
  const emailBase = { ...vendorDefaults(), legal_name: 'Acme' };
  const emailKeys = (d: Record<string, unknown>) => validateVendorForm(d).map((e) => e.key);
  it.each([
    ['missing', {}, ['email']],
    ['blank', { email: '  ' }, ['email']],
    ['malformed', { email: 'nope' }, ['email']],
    ['valid', { email: 'a@b.com' }, []],
    ['bad contact email', { email: 'a@b.com', contact_point_email: 'x' }, ['contact_point_email']],
    ['blank contact email ok', { email: 'a@b.com', contact_point_email: '' }, []],
  ])('%s', (_n, extra, expected) => {
    expect(emailKeys({ ...emailBase, ...extra })).toEqual(expected);
  });
});
