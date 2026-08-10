import { describe, it, expect } from 'vitest';
import {
  getDefaultWidgetIds,
  createDefaultRoleAllocation,
  effectiveRoleIds,
  getAllocatedWidgetIds,
  getVisibleWidgetIds,
  isSuperAdminGrants,
  rankTopCustomers,
  bucketInvoicesByAge,
} from './dashboardWidgets';
import type { WidgetDefinition, RoleWidgetAllocation } from '@/types/dashboardWidgets';

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

describe('createDefaultRoleAllocation', () => {
  it('seeds a role with the catalog defaults', () => {
    expect(createDefaultRoleAllocation('role-1', CATALOG)).toEqual({
      roleId: 'role-1',
      allocated: ['a', 'b'],
    });
  });
});

describe('effectiveRoleIds', () => {
  it.each([
    [['r1', 'r2'], '', ['r1', 'r2']],
    [['r1', 'r2'], 'r2', ['r2']],
    [[], '', []],
  ])(
    'narrows to the active role when set, otherwise unions all assigned roles',
    (userRoleIds, activeRoleId, expected) => {
      expect(effectiveRoleIds(userRoleIds, activeRoleId)).toEqual(expected);
    },
  );
});

describe('getAllocatedWidgetIds', () => {
  const allocations: RoleWidgetAllocation[] = [
    { roleId: 'sales-rep', allocated: ['a', 'c'] },
    { roleId: 'accountant', allocated: ['b'] },
  ];

  it('unions allocations across every assigned role when no role is active', () => {
    const result = getAllocatedWidgetIds(allocations, ['sales-rep', 'accountant'], '');
    expect(result.sort()).toEqual(['a', 'b', 'c']);
  });

  it('narrows to only the active role', () => {
    const result = getAllocatedWidgetIds(allocations, ['sales-rep', 'accountant'], 'accountant');
    expect(result).toEqual(['b']);
  });

  it('de-duplicates widget ids allocated to more than one assigned role', () => {
    const overlapping: RoleWidgetAllocation[] = [
      { roleId: 'sales-rep', allocated: ['a'] },
      { roleId: 'accountant', allocated: ['a', 'b'] },
    ];
    const result = getAllocatedWidgetIds(overlapping, ['sales-rep', 'accountant'], '');
    expect(result.sort()).toEqual(['a', 'b']);
  });

  it('returns [] when the user has no roles with a matching allocation', () => {
    expect(getAllocatedWidgetIds(allocations, ['ops-lead'], '')).toEqual([]);
  });
});

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
