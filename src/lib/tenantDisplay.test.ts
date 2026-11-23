import { describe, it, expect } from 'vitest';
import { tenantInitials, formatTenantDate, formatTenantDateTime, tenantDetailPath } from './tenantDisplay';

describe('tenantInitials', () => {
  it.each([
    ['Acme Stone Co.', 'AS'],
    ['acme', 'A'],
    ['  north   wind traders ', 'NW'],
    ['Solo', 'S'],
    ['', ''],
  ])('%j → %j', (name, expected) => {
    expect(tenantInitials(name)).toBe(expected);
  });
});

describe('formatTenantDate', () => {
  it('formats a timestamp as a short date', () => {
    expect(formatTenantDate('2026-01-15T12:00:00Z')).toBe('Jan 15, 2026');
  });

  it.each([undefined, null, ''])('shows an em dash for %j', (value) => {
    expect(formatTenantDate(value)).toBe('—');
  });
});

describe('formatTenantDateTime', () => {
  it('includes the time of day', () => {
    expect(formatTenantDateTime('2026-01-15T12:00:00Z')).toMatch(/Jan 15, 2026/);
    expect(formatTenantDateTime('2026-01-15T12:00:00Z')).toMatch(/\d{1,2}:\d{2}/);
  });

  it('shows an em dash when there is no timestamp', () => {
    expect(formatTenantDateTime(undefined)).toBe('—');
  });
});

describe('tenantDetailPath', () => {
  it('points at the dedicated details page for a tenant', () => {
    expect(tenantDetailPath('t-1')).toBe('/customer/onboarding/t-1');
  });
});
