import { describe, it, expect } from 'vitest';
import { isSafeReturnPath } from './safeReturnPath';

describe('isSafeReturnPath', () => {
  it.each([
    ['/sales/invoice/1?tab=2', true],
    ['/', true],
    ['//evil.com', false],
    ['/\\evil.com', false],
    ['https://evil.com', false],
    ['javascript:alert(1)', false],
    ['relative/path', false],
    ['', false],
    [null, false],
    [undefined, false],
  ])('%s -> %s', (input, expected) => {
    expect(isSafeReturnPath(input)).toBe(expected);
  });
});
