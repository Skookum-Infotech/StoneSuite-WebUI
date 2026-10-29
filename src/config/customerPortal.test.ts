import { describe, it, expect } from 'vitest';
import { isCustomerAllowedPath } from './customerPortal';

describe('isCustomerAllowedPath', () => {
  it.each([
    ['/sales/sales_order', true],
    ['/sales/sales_order/abc', true],
    ['/sales/invoice/abc', true],
    ['/account/settings', true],
    ['/sales/sales_order_internal', false],
    ['/sales/invoices', false],
    ['/dashboard', false],
    ['/config/users', false],
  ])('%s -> %s', (path, expected) => {
    expect(isCustomerAllowedPath(path)).toBe(expected);
  });
});
