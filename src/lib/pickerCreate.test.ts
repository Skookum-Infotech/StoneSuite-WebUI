import { describe, it, expect } from 'vitest';
import {
  accountUnavailableReason, createDrawerFromParams, findExistingMatch, nameKey, newAccountHref, newInventoryItemHref,
} from './pickerCreate';

describe('nameKey', () => {
  it.each([
    ['Acme Stone', 'acme stone'],
    ['  Acme Stone  ', 'acme stone'],
    ['Acme   Stone', 'acme stone'],
    ['ACME\tSTONE', 'acme stone'],
    ['   ', ''],
    ['Acme Stone, Inc.', 'acme stone, inc.'],
  ])('%j -> %j', (input, expected) => {
    expect(nameKey(input)).toBe(expected);
  });
});

describe('findExistingMatch', () => {
  const records = [
    { id: '1', name: 'Carrara White', sku: 'CAR-W' },
    { id: '2', name: 'Nero Marquina', sku: 'NER-M' },
  ];
  const keys = (r: (typeof records)[number]) => [r.name, r.sku];

  it.each([
    ['Nero Marquina', '2'],
    ['  NERO   marquina ', '2'],
    ['car-w', '1'],
  ])('finds %j by name or SKU', (term, id) => {
    expect(findExistingMatch(records, term, keys)?.id).toBe(id);
  });

  it.each([['Nero'], ['Marquina Black'], ['']])('does not match %j — only an exact name/SKU counts', (term) => {
    expect(findExistingMatch(records, term, keys)).toBeNull();
  });
});

describe('newInventoryItemHref', () => {
  it.each([
    ['Nero Marquina', '/inventory/item/new?name=Nero+Marquina'],
    ['  Nero  ', '/inventory/item/new?name=Nero'],
    ['A & B / 3cm', '/inventory/item/new?name=A+%26+B+%2F+3cm'],
    ['   ', '/inventory/item/new'],
  ])('%j -> %s', (name, href) => {
    expect(newInventoryItemHref(name)).toBe(href);
  });
});

describe('newAccountHref', () => {
  it.each([
    ['Petty Cash', undefined, '/finance/chart-of-accounts?new=1&name=Petty+Cash'],
    ['Petty Cash', 'cash' as const, '/finance/chart-of-accounts?new=1&name=Petty+Cash&type=cash'],
    ['', 'bank' as const, '/finance/chart-of-accounts?new=1&type=bank'],
  ])('%j / %s -> %s', (name, type, href) => {
    expect(newAccountHref(name, type)).toBe(href);
  });
});

describe('createDrawerFromParams — reads back what newAccountHref wrote', () => {
  it('opens the drawer with the typed name and type', () => {
    const params = new URLSearchParams('new=1&name=Petty+Cash&type=cash');
    expect(createDrawerFromParams(params)).toEqual({ mode: 'create', initialName: 'Petty Cash', initialType: 'cash' });
  });

  it('opens it bare when only new=1 is present', () => {
    expect(createDrawerFromParams(new URLSearchParams('new=1'))).toEqual({ mode: 'create' });
  });

  it('ignores an unknown account type', () => {
    expect(createDrawerFromParams(new URLSearchParams('new=1&name=X&type=bogus'))).toEqual({ mode: 'create', initialName: 'X' });
  });

  it.each([[''], ['name=Petty+Cash'], ['new=0'], ['new=true']])('stays closed for %j', (search) => {
    expect(createDrawerFromParams(new URLSearchParams(search))).toBeNull();
  });
});

describe('accountUnavailableReason', () => {
  it.each([
    [{ isActive: false, isPostable: true, isVisible: true }, 'Inactive'],
    [{ isActive: true, isPostable: false, isVisible: true }, 'A header account — not postable'],
    [{ isActive: true, isPostable: true, isVisible: false }, 'Hidden'],
    [{ isActive: true, isPostable: true, isVisible: true }, 'Not available for this field'],
    // Inactive wins over the other reasons — it is the one a user can act on.
    [{ isActive: false, isPostable: false, isVisible: false }, 'Inactive'],
  ])('%j -> %s', (account, reason) => {
    expect(accountUnavailableReason(account)).toBe(reason);
  });
});
