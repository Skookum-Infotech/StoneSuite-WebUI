import { describe, it, expect } from 'vitest';
import { filterWorkflows, groupWorkflows, WORKFLOW_GROUPS } from './workflowGroups';

interface Wf {
  key: string;
  name?: string;
  description?: string;
}

const wf = (key: string, name = key, description = ''): Wf => ({ key, name, description });

describe('groupWorkflows', () => {
  it('splits the seeded workflows into CRM, Sales, Purchases and Finance', () => {
    const all = WORKFLOW_GROUPS.flatMap((g) => g.keys).map((k) => wf(k));

    const sections = groupWorkflows(all);

    expect(sections.map((s) => s.group.id)).toEqual(['crm', 'sales', 'purchases', 'finance']);
    expect(sections.map((s) => s.workflows.length)).toEqual([3, 8, 8, 1]);
  });

  it('orders each module by its declared keys, not the server order', () => {
    const [section] = groupWorkflows([wf('customer'), wf('prospect'), wf('lead')]);

    expect(section.workflows.map((w) => w.key)).toEqual(['lead', 'prospect', 'customer']);
  });

  it('omits modules that have no workflows', () => {
    const sections = groupWorkflows([wf('lead'), wf('vendor')]);

    expect(sections.map((s) => s.group.id)).toEqual(['crm', 'purchases']);
  });

  it('collects unclaimed workflows into the Other module, in server order', () => {
    const sections = groupWorkflows([wf('zeta'), wf('lead'), wf('alpha')]);

    expect(sections.map((s) => s.group.id)).toEqual(['crm', 'other']);
    expect(sections[1].workflows.map((w) => w.key)).toEqual(['zeta', 'alpha']);
  });

  it('matches module keys case-insensitively', () => {
    const [section] = groupWorkflows([wf('Sales_Order')]);

    expect(section.group.id).toBe('sales');
  });

  it('returns no sections for an empty list', () => {
    expect(groupWorkflows([])).toEqual([]);
  });
});

describe('filterWorkflows', () => {
  const all = [
    wf('sales_order', 'Sales Order', 'Confirmed customer orders.'),
    wf('purchase_order', 'Purchase Order', 'Purchase orders sent to vendors.'),
    wf('lead', 'Lead', 'Unqualified inbound interest.'),
  ];

  it.each([
    ['', ['sales_order', 'purchase_order', 'lead']],
    ['   ', ['sales_order', 'purchase_order', 'lead']],
    ['sales', ['sales_order']],
    ['ORDER', ['sales_order', 'purchase_order']],
    ['purchase_', ['purchase_order']],
    ['vendors', ['purchase_order']],
    ['nothing here', []],
  ])('filterWorkflows(all, %p) -> %p', (query, expected) => {
    expect(filterWorkflows(all, query).map((w) => w.key)).toEqual(expected);
  });
});
