import { describe, it, expect } from 'vitest';
import { AxiosError, type AxiosResponse } from 'axios';
import { formatStockQty, stockShortagesFrom } from './stockShortage';
import type { StockShortage } from '@/types/salesOrder';

const SHORT: StockShortage = {
  itemId: 'item-1', sku: 'GRAN-001', name: 'Absolute Black', unitCode: 'SQFT', requested: 60, available: 45.208, short: 14.792,
};

function httpError(status: number, data: unknown): AxiosError {
  const response = { status, data, statusText: '', headers: {}, config: {} } as AxiosResponse;
  return new AxiosError('failed', String(status), undefined, undefined, response);
}

describe('stockShortagesFrom', () => {
  it('returns the short items from the server\'s not-enough-stock 409', () => {
    const err = httpError(409, { success: false, code: 'insufficient_stock', message: 'Not enough stock', shortages: [SHORT] });

    expect(stockShortagesFrom(err)).toEqual([SHORT]);
  });

  it.each([
    ['a different 409', httpError(409, { success: false, message: 'Duplicate' })],
    ['a 409 with another code', httpError(409, { code: 'something_else', shortages: [SHORT] })],
    ['the right code with no shortages', httpError(409, { code: 'insufficient_stock', shortages: [] })],
    ['the right code with a non-list', httpError(409, { code: 'insufficient_stock', shortages: 'nope' })],
    ['a 400', httpError(400, { code: 'insufficient_stock', shortages: [SHORT] })],
    ['a 500', httpError(500, undefined)],
    ['a plain Error', new Error('boom')],
    ['nothing', undefined],
  ])('is null for %s', (_name, err) => {
    expect(stockShortagesFrom(err)).toBeNull();
  });
});

describe('formatStockQty', () => {
  it.each([
    [45.208, 'SQFT', '45.208 sq ft'],
    [12, 'EA', '12 each'],
    [12, 'SQM', '12 sq m'],
    [1234.5, 'SQFT', '1,234.5 sq ft'],
    [0.0004, 'SQFT', '0 sq ft'],
    [7, undefined, '7'],
    [7, '', '7'],
  ])('%s %s → %s', (value, code, want) => {
    expect(formatStockQty(value, code)).toBe(want);
  });
});
