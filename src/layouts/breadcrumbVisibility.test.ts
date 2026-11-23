import { describe, expect, it } from 'vitest';
import { hidesBreadcrumbs } from './breadcrumbVisibility';

describe('hidesBreadcrumbs', () => {
  it.each([
    ['/sales/sales_order/so-1/drawing', true],
    ['/sales/sales_order/so-1/drawing/', true],
    ['/sales/sales_order/so-1', false],
    ['/sales/sales_order/so-1/edit', false],
    ['/sales/sales_order', false],
    ['/sales/quote/q-1/drawing', false],
    ['/sales/sales_order/so-1/drawing/extra', false],
    ['/', false],
  ])('%s -> %s', (pathname, expected) => {
    expect(hidesBreadcrumbs(pathname)).toBe(expected);
  });
});
