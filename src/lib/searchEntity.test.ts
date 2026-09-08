import { describe, it, expect } from 'vitest';
import { entityLabel, compareEntityTypes, hasDetailRoute, hitRoute } from './searchEntity';
import type { SearchHit } from '@/types/search';

function hit(over: Partial<SearchHit>): SearchHit {
  return {
    type: 'invoice',
    id: 'id-1',
    displayName: 'Invoice INV-001',
    updatedAt: '2026-09-01T00:00:00Z',
    domain: 'sales',
    module: 'invoice',
    ...over,
  };
}

describe('entityLabel', () => {
  it('uses the curated plural label', () => {
    expect(entityLabel('sales_order')).toBe('Sales Orders');
    expect(entityLabel('cash_transfer')).toBe('Journal Entries');
    expect(entityLabel('inventory_unit')).toBe('Slabs');
    expect(entityLabel('user')).toBe('Team Members');
  });

  it('falls back to a title-cased key for an unknown type', () => {
    expect(entityLabel('widget_thing')).toBe('Widget Thing');
  });
});

describe('compareEntityTypes', () => {
  it('orders by the curated sequence, unknowns last', () => {
    const sorted = ['user', 'invoice', 'zzz_unknown', 'customer'].sort(compareEntityTypes);
    expect(sorted).toEqual(['customer', 'invoice', 'user', 'zzz_unknown']);
  });
});

describe('hitRoute / hasDetailRoute', () => {
  it('builds /{domain}/{module}/{id} for a normal record', () => {
    expect(hitRoute(hit({ domain: 'sales', module: 'installation', id: 'j1' }))).toBe('/sales/installation/j1');
    expect(hasDetailRoute('fabrication_job')).toBe(true);
  });

  it('routes an activity hit to its parent customer (backend pre-resolves domain/module)', () => {
    const h = hit({ type: 'crm_activity', domain: 'crm', module: 'customer', id: 'cust-9' });
    expect(hitRoute(h)).toBe('/crm/customer/cust-9');
  });

  it('deep-links the list page for a type with no detail route', () => {
    expect(hasDetailRoute('user')).toBe(false);
    expect(hitRoute(hit({ type: 'user', domain: 'config', module: 'users', id: 'u1' }))).toBe('/config/users');
  });
});
