import { describe, it, expect } from 'vitest';
import { isHttpUrl } from './safeExternalUrl';

describe('isHttpUrl', () => {
  it.each([
    ['https://example.com/policy', true],
    ['http://example.com', true],
    ['javascript:alert(1)', false],
    ['data:text/html,<b>x</b>', false],
    ['example.com', false],
    ['', false],
    [undefined, false],
  ])('%s -> %s', (input, expected) => {
    expect(isHttpUrl(input)).toBe(expected);
  });
});
