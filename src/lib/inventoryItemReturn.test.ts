import { describe, it, expect, beforeEach } from 'vitest';
import type { InventoryItem } from '@/types/inventory';
import {
  INVENTORY_RETURN_STATE_KEY,
  applyReturnedLine,
  clearReturnStash,
  hasExactItemName,
  isSafeReturnPath,
  newInventoryItemPath,
  readReturnStash,
  resolveInventoryReturn,
  returnRouterState,
  writeReturnStash,
} from './inventoryItemReturn';

const ITEM = { id: 'item-1', name: 'Calacatta Gold', sku: 'CG-01', unitPrice: 120 } as InventoryItem;

interface Line { itemName: string; quantity: string; inventoryItemUuid?: string }
const EMPTY_LINE: Line = { itemName: '', quantity: '' };
const applyItem = (draft: Line, item: InventoryItem): Line => ({ ...draft, itemName: item.name, inventoryItemUuid: item.id });

describe('isSafeReturnPath', () => {
  it.each([
    ['/sales/quote/new', true],
    ['/sales/quote/new?fromEstimate=abc', true],
    ['//evil.example.com', false],
    ['/\\evil.example.com', false],
    ['https://evil.example.com', false],
    ['sales/quote/new', false],
    ['', false],
    [null, false],
  ])('%s → %s', (path, expected) => {
    expect(isSafeReturnPath(path)).toBe(expected);
  });
});

describe('newInventoryItemPath', () => {
  it('carries the return path and the trimmed item name', () => {
    const url = new URL(newInventoryItemPath('/sales/quote/new?fromEstimate=e1', '  Calacatta Gold '), 'http://x');
    expect(url.pathname).toBe('/inventory/item/new');
    expect(url.searchParams.get('returnTo')).toBe('/sales/quote/new?fromEstimate=e1');
    expect(url.searchParams.get('name')).toBe('Calacatta Gold');
  });

  it('omits the name param when nothing was typed', () => {
    const url = new URL(newInventoryItemPath('/sales/quote/new', '   '), 'http://x');
    expect(url.searchParams.has('name')).toBe(false);
  });
});

describe('return stash', () => {
  beforeEach(() => sessionStorage.clear());

  it('round-trips a stash through sessionStorage', () => {
    const stash = { returnTo: '/sales/quote/new', page: { data: { a: 1 } }, line: { draft: EMPTY_LINE, editId: null } };
    expect(writeReturnStash(stash)).toBe(true);
    expect(readReturnStash()).toEqual(stash);
    clearReturnStash();
    expect(readReturnStash()).toBeNull();
  });

  it.each([
    ['not JSON', '{oops'],
    ['missing returnTo', JSON.stringify({ page: {}, line: null })],
    ['non-object', JSON.stringify('hello')],
  ])('ignores a corrupt stash (%s)', (_label, raw) => {
    sessionStorage.setItem('stonesuite:inventory-item-return', raw);
    expect(readReturnStash()).toBeNull();
  });
});

describe('resolveInventoryReturn', () => {
  const stash = { returnTo: '/sales/quote/new', page: { data: { a: 1 } }, line: { draft: EMPTY_LINE, editId: null } };

  it('restores with the created item when the New Item page sends the user back', () => {
    const result = resolveInventoryReturn(stash, '/sales/quote/new', returnRouterState(ITEM), false);
    expect(result).toEqual({ page: stash.page, line: stash.line, createdItem: ITEM });
  });

  it('restores without an item when the user cancelled out of New Item', () => {
    const result = resolveInventoryReturn(stash, '/sales/quote/new', returnRouterState(null), false);
    expect(result?.createdItem).toBeNull();
    expect(result?.page).toEqual(stash.page);
  });

  it('restores on a browser back/forward (POP) even without router state', () => {
    expect(resolveInventoryReturn(stash, '/sales/quote/new', null, true)?.page).toEqual(stash.page);
  });

  it('does not restore on a fresh in-app visit to the same page', () => {
    expect(resolveInventoryReturn(stash, '/sales/quote/new', null, false)).toBeNull();
  });

  it('does not restore a stash that belongs to a different page', () => {
    expect(resolveInventoryReturn(stash, '/sales/estimate/new', returnRouterState(ITEM), false)).toBeNull();
  });

  it('does not restore when there is no stash', () => {
    expect(resolveInventoryReturn(null, '/sales/quote/new', returnRouterState(ITEM), true)).toBeNull();
  });

  it('treats a malformed created item as no item', () => {
    const state = { [INVENTORY_RETURN_STATE_KEY]: { createdItem: { name: 'no id' } } };
    expect(resolveInventoryReturn(stash, '/sales/quote/new', state, false)?.createdItem).toBeNull();
  });
});

describe('applyReturnedLine', () => {
  it('returns null when there is nothing to re-open', () => {
    expect(applyReturnedLine(null, null, EMPTY_LINE, applyItem)).toBeNull();
  });

  it('re-opens the in-progress add row with the created item picked', () => {
    const line = { draft: { itemName: 'Calacatta', quantity: '3' }, editId: null };
    expect(applyReturnedLine(line, ITEM, EMPTY_LINE, applyItem)).toEqual({
      draft: { itemName: 'Calacatta Gold', quantity: '3', inventoryItemUuid: 'item-1' },
      editId: null,
      isAdding: true,
    });
  });

  it('re-opens the line that was being edited', () => {
    const line = { draft: { itemName: 'Calacatta', quantity: '2' }, editId: 'li-4' };
    expect(applyReturnedLine(line, ITEM, EMPTY_LINE, applyItem)).toMatchObject({ editId: 'li-4', isAdding: false });
  });

  it('keeps the typed draft unpicked when the user came back without creating the item', () => {
    const line = { draft: { itemName: 'Calacatta', quantity: '2' }, editId: null };
    expect(applyReturnedLine(line, null, EMPTY_LINE, applyItem)?.draft).toEqual(line.draft);
  });

  it('starts a fresh add row for the created item when no line draft was stashed', () => {
    expect(applyReturnedLine(null, ITEM, EMPTY_LINE, applyItem)).toEqual({
      draft: { itemName: 'Calacatta Gold', quantity: '', inventoryItemUuid: 'item-1' },
      editId: null,
      isAdding: true,
    });
  });
});

describe('hasExactItemName', () => {
  it.each([
    ['calacatta gold', true],
    ['  Calacatta Gold  ', true],
    ['Calacatta', false],
    ['', false],
  ])('%s → %s', (term, expected) => {
    expect(hasExactItemName([ITEM], term)).toBe(expected);
  });
});
