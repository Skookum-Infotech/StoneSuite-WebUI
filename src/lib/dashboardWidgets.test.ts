import { describe, it, expect } from 'vitest';
import {
  getDefaultWidgetIds,
  createDefaultSettings,
  applyAllocation,
  applyPreference,
  getVisibleWidgetIds,
  rankTopCustomers,
  bucketInvoicesByAge,
} from './dashboardWidgets';
import type { WidgetDefinition, UserWidgetSettings } from '@/types/dashboardWidgets';

const CATALOG: WidgetDefinition[] = [
  { id: 'a', title: 'A', description: '', category: 'core', size: 'full', defaultEnabled: true },
  { id: 'b', title: 'B', description: '', category: 'core', size: 'half', defaultEnabled: true },
  { id: 'c', title: 'C', description: '', category: 'sales', size: 'half', defaultEnabled: false },
];

describe('getDefaultWidgetIds', () => {
  it.each([
    [CATALOG, ['a', 'b']],
    [[], []],
  ])('returns the ids marked defaultEnabled', (catalog, expected) => {
    expect(getDefaultWidgetIds(catalog)).toEqual(expected);
  });
});

describe('createDefaultSettings', () => {
  it('seeds a new user with the catalog defaults as both allocated and enabled', () => {
    expect(createDefaultSettings('u1', CATALOG)).toEqual({
      userId: 'u1',
      allocated: ['a', 'b'],
      enabled: ['a', 'b'],
    });
  });
});

describe('applyAllocation', () => {
  const base: UserWidgetSettings = { userId: 'u1', allocated: ['a', 'b'], enabled: ['a'] };

  it('replaces the allocated list with the given ids', () => {
    expect(applyAllocation(base, ['a', 'c']).allocated).toEqual(['a', 'c']);
  });

  it('auto-enables a newly allocated widget so it shows up immediately', () => {
    const result = applyAllocation(base, ['a', 'b', 'c']);
    expect(result.enabled).toEqual(['a', 'c']);
  });

  it('does not change enabled for a widget that was already allocated', () => {
    const result = applyAllocation(base, ['a', 'b']);
    expect(result.enabled).toEqual(['a']);
  });

  it('leaves enabled untouched when revoking allocation', () => {
    const result = applyAllocation(base, ['a']);
    expect(result.enabled).toEqual(['a']);
  });
});

describe('applyPreference', () => {
  const base: UserWidgetSettings = { userId: 'u1', allocated: ['a', 'b'], enabled: ['a'] };

  it('sets enabled to the given ids', () => {
    expect(applyPreference(base, ['a', 'b']).enabled).toEqual(['a', 'b']);
  });

  it('ignores ids the user is not allocated', () => {
    expect(applyPreference(base, ['a', 'c']).enabled).toEqual(['a']);
  });
});

describe('getVisibleWidgetIds', () => {
  it.each([
    [{ userId: 'u1', allocated: ['a', 'b'], enabled: ['a'] }, ['a']],
    [{ userId: 'u1', allocated: [], enabled: ['a'] }, []],
    [{ userId: 'u1', allocated: ['a'], enabled: [] }, []],
  ])('is the intersection of allocated and enabled', (settings, expected) => {
    expect(getVisibleWidgetIds(settings as UserWidgetSettings)).toEqual(expected);
  });
});

describe('rankTopCustomers', () => {
  it('sorts descending by value and caps at the limit', () => {
    const customers = [
      { id: '1', name: 'Low', value: 100 },
      { id: '2', name: 'High', value: 900 },
      { id: '3', name: 'Mid', value: 500 },
    ];
    const result = rankTopCustomers(customers, 2);
    expect(result.map((c) => c.id)).toEqual(['2', '3']);
  });

  it('scales proportion relative to the top-ranked value', () => {
    const customers = [
      { id: '1', name: 'High', value: 200 },
      { id: '2', name: 'Half', value: 100 },
    ];
    const result = rankTopCustomers(customers, 5);
    expect(result[0].proportion).toBe(1);
    expect(result[1].proportion).toBe(0.5);
  });

  it('returns an empty array without dividing by zero when all values are 0', () => {
    const customers = [{ id: '1', name: 'Zero', value: 0 }];
    const result = rankTopCustomers(customers, 5);
    expect(result[0].proportion).toBe(0);
  });

  it('returns [] for an empty input', () => {
    expect(rankTopCustomers([], 5)).toEqual([]);
  });
});

describe('bucketInvoicesByAge', () => {
  it('sums invoice amounts into the 0-30/31-60/61-90/90+ buckets', () => {
    const invoices = [
      { id: '1', invoiceNumber: 'INV-1', customer: 'A', amount: 100, daysPastDue: 0 },
      { id: '2', invoiceNumber: 'INV-2', customer: 'B', amount: 200, daysPastDue: 30 },
      { id: '3', invoiceNumber: 'INV-3', customer: 'C', amount: 300, daysPastDue: 45 },
      { id: '4', invoiceNumber: 'INV-4', customer: 'D', amount: 400, daysPastDue: 75 },
      { id: '5', invoiceNumber: 'INV-5', customer: 'E', amount: 500, daysPastDue: 120 },
    ];
    expect(bucketInvoicesByAge(invoices)).toEqual([
      { label: '0-30', amount: 300 },
      { label: '31-60', amount: 300 },
      { label: '61-90', amount: 400 },
      { label: '90+', amount: 500 },
    ]);
  });

  it('returns zeroed buckets for an empty input', () => {
    expect(bucketInvoicesByAge([])).toEqual([
      { label: '0-30', amount: 0 },
      { label: '31-60', amount: 0 },
      { label: '61-90', amount: 0 },
      { label: '90+', amount: 0 },
    ]);
  });
});
