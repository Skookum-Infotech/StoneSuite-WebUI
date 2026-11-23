import { describe, it, expect } from 'vitest';
import { formatBytes, formatPeriod, formatTokenCount, groupTokenSources, usagePercent } from './usageFormat';

describe('formatBytes', () => {
  it.each([
    [0, '0 B'],
    [512, '512 B'],
    [1024, '1 KB'],
    [1536, '1.5 KB'],
    [5 * 1024 * 1024, '5 MB'],
    [3.42 * 1024 ** 3, '3.4 GB'],
    [150 * 1024 ** 3, '150 GB'],
    [2 * 1024 ** 4, '2 TB'],
    [5000 * 1024 ** 4, '5000 TB'],
    [-1, '—'],
    [Number.NaN, '—'],
  ])('%s → %s', (bytes, expected) => {
    expect(formatBytes(bytes)).toBe(expected);
  });
});

describe('formatTokenCount', () => {
  it.each([
    [0, '0'],
    [950, '950'],
    [1000, '1K'],
    [12_400, '12.4K'],
    [842_000, '842K'],
    [1_280_000, '1.3M'],
    [2_000_000_000, '2B'],
    [-5, '—'],
  ])('%s → %s', (n, expected) => {
    expect(formatTokenCount(n)).toBe(expected);
  });
});

describe('usagePercent', () => {
  it.each([
    [10, null, null],
    [10, 0, null],
    [0, 100, 0],
    [7, 100, 7],
    [1_280_000, 2_000_000, 64],
    [300, 200, 100],
  ])('used %s of %s → %s', (used, limit, expected) => {
    expect(usagePercent(used, limit)).toBe(expected);
  });
});

describe('formatPeriod', () => {
  it.each([
    ['2026-11-01', '2026-12-01', '01 Nov – 30 Nov 2026'],
    ['2026-10-20', '2026-11-20', '20 Oct – 19 Nov 2026'],
    ['2026-12-20', '2027-01-20', '20 Dec 2026 – 19 Jan 2027'],
    ['nope', '2026-12-01', ''],
  ])('%s..%s → %s', (start, end, expected) => {
    expect(formatPeriod(start, end)).toBe(expected);
  });
});

describe('groupTokenSources', () => {
  it('merges ask and route into one row and sorts largest first', () => {
    expect(groupTokenSources([
      { source: 'doc_extract', totalTokens: 300 },
      { source: 'ask', totalTokens: 200 },
      { source: 'route', totalTokens: 150 },
      { source: 'mystery', totalTokens: 5 },
    ])).toEqual([
      { label: 'Assistant chat', totalTokens: 350 },
      { label: 'Document extraction', totalTokens: 300 },
      { label: 'mystery', totalTokens: 5 },
    ]);
  });
});
