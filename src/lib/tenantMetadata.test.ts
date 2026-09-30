import { describe, it, expect } from 'vitest';
import { describeTenantMetadata } from './tenantMetadata';

describe('describeTenantMetadata', () => {
  it('returns empty values for a tenant with no metadata', () => {
    expect(describeTenantMetadata(undefined)).toEqual({
      contactEmail: '',
      phone: '',
      industry: '',
      website: '',
      extra: [],
    });
  });

  it.each([
    ['super_admin_email wins over the fallbacks', { super_admin_email: 'a@x.com', contact_email: 'b@x.com', email: 'c@x.com' }, 'a@x.com'],
    ['falls back to contact_email', { contact_email: 'b@x.com', email: 'c@x.com' }, 'b@x.com'],
    ['falls back to email', { email: 'c@x.com' }, 'c@x.com'],
    ['skips an empty primary key', { super_admin_email: '', contact_email: 'b@x.com' }, 'b@x.com'],
  ])('contact email: %s', (_name, meta, expected) => {
    expect(describeTenantMetadata(meta).contactEmail).toBe(expected);
  });

  it('reads phone, industry and website from their alias keys', () => {
    expect(
      describeTenantMetadata({ contact_phone: '+1 555', business_type: 'Quarry', company_website: 'acme.test' }),
    ).toMatchObject({ phone: '+1 555', industry: 'Quarry', website: 'acme.test' });
  });

  it('lists every other non-empty string field, in order, as extra', () => {
    const summary = describeTenantMetadata({
      company_name: 'Acme',
      super_admin_email: 'a@x.com',
      city: 'Austin',
      country: 'US',
      notes: '',
      employees: 12,
      nested: { a: 1 },
      tax_id: '99-123',
    });

    expect(summary.extra).toEqual([
      ['city', 'Austin'],
      ['country', 'US'],
      ['tax_id', '99-123'],
    ]);
  });

  it('never repeats a field already surfaced as a primary value', () => {
    const summary = describeTenantMetadata({
      company_name: 'Acme',
      super_admin_email: 'a@x.com',
      contact_email: 'b@x.com',
      email: 'c@x.com',
      phone: '1',
      contact_phone: '2',
      industry: 'i',
      business_type: 'b',
      website: 'w',
      company_website: 'cw',
    });

    expect(summary.extra).toEqual([]);
  });
});
