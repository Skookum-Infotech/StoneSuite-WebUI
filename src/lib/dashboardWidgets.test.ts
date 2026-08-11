import { describe, it, expect } from 'vitest';
import {
  getVisibleWidgetIds,
  toggleIds,
  resolvePresetWidgetIds,
  matchingPresetId,
  dirtyRoleIds,
  isSuperAdminGrants,
  rankTopCustomers,
  bucketInvoicesByAge,
} from './dashboardWidgets';
import type { WidgetDefinition, RoleWidgetAllocation } from '@/types/dashboardWidgets';
import type { WidgetPreset } from '@/config/dashboardWidgetPresets';

const CATALOG: WidgetDefinition[] = [
  { id: 'a', title: 'A', description: '', category: 'core', size: 'full', defaultEnabled: true },
  { id: 'b', title: 'B', description: '', category: 'core', size: 'half', defaultEnabled: true },
  { id: 'c', title: 'C', description: '', category: 'sales', size: 'half', defaultEnabled: false },
];

describe('getVisibleWidgetIds', () => {
  it.each([
    [['a', 'b'], ['a'], ['b']],
    [['a', 'b'], [], ['a', 'b']],
    [['a'], ['a'], []],
    [[], ['a'], []],
  ])('is allocated minus hidden', (allocated, hidden, expected) => {
    expect(getVisibleWidgetIds(allocated, hidden)).toEqual(expected);
  });
});

describe('toggleIds', () => {
  it.each([
    [['a'], ['b', 'c'], true, ['a', 'b', 'c']],
    [['a', 'b'], ['b'], true, ['a', 'b']],
    [['a', 'b', 'c'], ['b'], false, ['a', 'c']],
    [['a'], ['b'], false, ['a']],
  ])('adds or removes the given ids from the current set', (current, ids, next, expected) => {
    expect(toggleIds(current, ids, next)).toEqual(expected);
  });
});

describe('resolvePresetWidgetIds', () => {
  it('resolves a category-list preset to the matching catalog ids', () => {
    const preset: WidgetPreset = { id: 'essentials', label: 'Essentials', categories: ['core'] };
    expect(resolvePresetWidgetIds(preset, CATALOG)).toEqual(['a', 'b']);
  });

  it('resolves a multi-category preset by unioning categories in catalog order', () => {
    const preset: WidgetPreset = { id: 'sales-pack', label: 'Sales pack', categories: ['core', 'sales'] };
    expect(resolvePresetWidgetIds(preset, CATALOG)).toEqual(['a', 'b', 'c']);
  });

  it("resolves 'all' to every catalog id", () => {
    const preset: WidgetPreset = { id: 'everything', label: 'Everything', categories: 'all' };
    expect(resolvePresetWidgetIds(preset, CATALOG)).toEqual(['a', 'b', 'c']);
  });
});

describe('matchingPresetId', () => {
  const presets: WidgetPreset[] = [
    { id: 'essentials', label: 'Essentials', categories: ['core'] },
    { id: 'everything', label: 'Everything', categories: 'all' },
  ];

  it('returns the id of the preset whose widget set exactly matches', () => {
    expect(matchingPresetId(['a', 'b'], CATALOG, presets)).toBe('essentials');
    expect(matchingPresetId(['a', 'b', 'c'], CATALOG, presets)).toBe('everything');
  });

  it('returns null when no preset matches exactly (superset, subset, or unrelated set)', () => {
    expect(matchingPresetId(['a'], CATALOG, presets)).toBeNull();
    expect(matchingPresetId(['a', 'b', 'c', 'd'], CATALOG, presets)).toBeNull();
    expect(matchingPresetId([], CATALOG, presets)).toBeNull();
  });
});

describe('dirtyRoleIds', () => {
  const original: RoleWidgetAllocation[] = [
    { roleId: 'sales-rep', allocated: ['a', 'b'] },
    { roleId: 'accountant', allocated: ['b'] },
  ];

  it('excludes roles whose staged set matches the original, regardless of order', () => {
    expect(dirtyRoleIds({ 'sales-rep': ['b', 'a'] }, original)).toEqual([]);
  });

  it('includes roles whose staged set differs', () => {
    expect(dirtyRoleIds({ 'sales-rep': ['a'], accountant: ['b'] }, original)).toEqual(['sales-rep']);
  });

  it('treats a role with no prior allocation as dirty once anything is staged', () => {
    expect(dirtyRoleIds({ 'new-role': ['a'] }, original)).toEqual(['new-role']);
  });

  it('returns [] when nothing is staged', () => {
    expect(dirtyRoleIds({}, original)).toEqual([]);
  });
});

describe('isSuperAdminGrants', () => {
  it.each([
    [[{ resource: '*', action: '*' }], true],
    [[{ resource: 'lead', action: '*' }], false],
    [[{ resource: '*', action: 'read' }], false],
    [[{ resource: 'lead', action: 'read' }, { resource: '*', action: '*' }], true],
    [[], false],
  ])('is true only when a grant has both resource and action wildcarded', (grants, expected) => {
    expect(isSuperAdminGrants(grants)).toBe(expected);
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
