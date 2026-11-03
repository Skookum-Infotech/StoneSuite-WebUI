import { describe, it, expect } from 'vitest';
import { RESOURCE_QUERY_KEYS } from './useProposedActions';

describe('RESOURCE_QUERY_KEYS defaults', () => {
  it.each([
    ['customer', [['crm-records', 'customer'], ['customer-picker']]],
    ['vendor', [['vendors'], ['vendor-picker']]],
    ['inventory_item', [['inventory-items'], ['inventory-item-picker']]],
  ])('registers %s', (resource, keys) => {
    expect(RESOURCE_QUERY_KEYS[resource]).toEqual(keys);
  });
});
