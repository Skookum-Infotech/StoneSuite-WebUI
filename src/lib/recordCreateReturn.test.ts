import { describe, it, expect, beforeEach } from 'vitest';
import {
  RECORD_CREATE_STATE_KEY,
  clearStash,
  hasExactName,
  isSafeReturnPath,
  newRecordCreatePath,
  readStash,
  resolveRecordCreateReturn,
  returnRouterState,
  writeStash,
} from './recordCreateReturn';

const CUSTOMER_REF = { id: 'cust-1', name: 'Acme Corp' };
const VENDOR_REF = { id: 'vend-1', name: 'Acme Stone Supply' };

describe('isSafeReturnPath', () => {
  it.each([
    ['/sales/quote/new', true],
    ['//evil.example.com', false],
    ['/\\evil.example.com', false],
    ['https://evil.example.com', false],
    ['', false],
    [null, false],
  ])('%s → %s', (path, expected) => {
    expect(isSafeReturnPath(path)).toBe(expected);
  });
});

describe('newRecordCreatePath', () => {
  it('carries the return path and the trimmed name', () => {
    const url = new URL(newRecordCreatePath('/crm/customer/new', '/sales/quote/new', '  Acme Corp '), 'http://x');
    expect(url.pathname).toBe('/crm/customer/new');
    expect(url.searchParams.get('returnTo')).toBe('/sales/quote/new');
    expect(url.searchParams.get('name')).toBe('Acme Corp');
  });

  it('omits the name param when nothing was typed', () => {
    const url = new URL(newRecordCreatePath('/purchases/vendor/new', '/purchases/purchase_order/new', '   '), 'http://x');
    expect(url.searchParams.has('name')).toBe(false);
  });
});

describe('stash', () => {
  beforeEach(() => sessionStorage.clear());

  it('round-trips a stash through sessionStorage', () => {
    const stash = { kind: 'customer' as const, returnTo: '/sales/quote/new', page: { a: 1 } };
    expect(writeStash(stash)).toBe(true);
    expect(readStash()).toEqual(stash);
    clearStash();
    expect(readStash()).toBeNull();
  });

  it.each([
    ['not JSON', '{oops'],
    ['missing returnTo', JSON.stringify({ kind: 'vendor', page: {} })],
    ['missing kind', JSON.stringify({ returnTo: '/x', page: {} })],
    ['non-object', JSON.stringify('hello')],
  ])('ignores a corrupt stash (%s)', (_label, raw) => {
    sessionStorage.setItem('stonesuite:record-create-return', raw);
    expect(readStash()).toBeNull();
  });
});

describe('resolveRecordCreateReturn', () => {
  const stash = { kind: 'customer' as const, returnTo: '/sales/quote/new', page: { a: 1 } };

  it('restores with the created ref when the Add page sends the user back', () => {
    const result = resolveRecordCreateReturn(stash, 'customer', '/sales/quote/new', returnRouterState(CUSTOMER_REF), false);
    expect(result).toEqual({ page: stash.page, createdRef: CUSTOMER_REF });
  });

  it('restores without a ref when the user cancelled out of the Add page', () => {
    const result = resolveRecordCreateReturn(stash, 'customer', '/sales/quote/new', returnRouterState(null), false);
    expect(result?.createdRef).toBeNull();
    expect(result?.page).toEqual(stash.page);
  });

  it('restores on a browser back/forward (POP) even without router state', () => {
    expect(resolveRecordCreateReturn(stash, 'customer', '/sales/quote/new', null, true)?.page).toEqual(stash.page);
  });

  it('does not restore on a fresh in-app visit to the same page', () => {
    expect(resolveRecordCreateReturn(stash, 'customer', '/sales/quote/new', null, false)).toBeNull();
  });

  it('does not restore a stash for a different kind (customer vs vendor)', () => {
    expect(resolveRecordCreateReturn(stash, 'vendor', '/sales/quote/new', returnRouterState(CUSTOMER_REF), false)).toBeNull();
  });

  it('does not restore a stash that belongs to a different page', () => {
    expect(resolveRecordCreateReturn(stash, 'customer', '/sales/estimate/new', returnRouterState(CUSTOMER_REF), false)).toBeNull();
  });

  it('does not restore when there is no stash', () => {
    expect(resolveRecordCreateReturn(null, 'customer', '/sales/quote/new', returnRouterState(CUSTOMER_REF), true)).toBeNull();
  });

  it('treats a malformed created ref as no ref', () => {
    const state = { [RECORD_CREATE_STATE_KEY]: { createdRef: { name: 'no id' } } };
    expect(resolveRecordCreateReturn(stash, 'customer', '/sales/quote/new', state, false)?.createdRef).toBeNull();
  });

  it('works identically for the vendor kind', () => {
    const vendorStash = { kind: 'vendor' as const, returnTo: '/purchases/purchase_order/new', page: { b: 2 } };
    const result = resolveRecordCreateReturn(
      vendorStash, 'vendor', '/purchases/purchase_order/new', returnRouterState(VENDOR_REF), false,
    );
    expect(result).toEqual({ page: vendorStash.page, createdRef: VENDOR_REF });
  });
});

describe('hasExactName', () => {
  it.each([
    ['acme corp', true],
    ['  Acme Corp  ', true],
    ['Acme', false],
    ['', false],
  ])('%s → %s', (term, expected) => {
    expect(hasExactName([CUSTOMER_REF], term)).toBe(expected);
  });
});
