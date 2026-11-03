import { describe, expect, it } from 'vitest';
import { formatLength, LengthParseError, parseLength } from './units';

describe('parseLength', () => {
  it.each([
    ['25.5', 647.7],
    ['25 1/2', 647.7],
    ['25-1/2', 647.7],
    ['25 1/2"', 647.7],
    ['25 1/2 in', 647.7],
    ['25 1/2in', 647.7],
    ['1/2', 12.7],
    ['648mm', 648],
    ['648 mm', 648],
    ['648MM', 648],
    ['0', 0],
  ])('parses %s to %smm', (input, expectedMm) => {
    expect(parseLength(input)).toBeCloseTo(expectedMm, 5);
  });

  it.each([[''], ['   '], ['banana'], ['25 1/0'], ['25/']])('rejects %j', (input) => {
    expect(() => parseLength(input)).toThrow(LengthParseError);
  });
});

describe('formatLength', () => {
  it.each([
    [647.7, 32 as const, '25 1/2"'],
    [3055.975, 32 as const, '120 5/16"'],
    [0, 32 as const, '0"'],
    [-647.7, 32 as const, '-25 1/2"'],
    [12.7, 32 as const, '1/2"'],
  ])('formats %smm at 1/%s to %s', (mm, denominator, expected) => {
    expect(formatLength(mm, 'in', denominator)).toBe(expected);
  });

  it('rounds up to the next whole inch when the fraction reduces to 1', () => {
    // 25.4mm short of 26" rounds to 25 31/32", not 25 32/32".
    expect(formatLength(25 * 25.4 + 25.4 - 25.4 / 64, 'in', 32)).toBe('26"');
  });

  it('formats mm to one decimal place', () => {
    expect(formatLength(648.26, 'mm')).toBe('648.3mm');
  });

  it('round-trips inch -> mm -> inch exactly at 1/32"', () => {
    for (let thirtySeconds = 1; thirtySeconds < 32; thirtySeconds++) {
      const inches = `25 ${thirtySeconds}/32"`;
      const mm = parseLength(inches);
      expect(formatLength(mm, 'in', 32)).toBe(simplify(inches));
    }
  });
});

// formatLength reduces a fraction (e.g. 16/32 -> 1/2); parseLength's test
// inputs are already in lowest terms except where this helper is used.
function simplify(inches: string): string {
  const match = /^(\d+) (\d+)\/(\d+)"$/.exec(inches);
  if (!match) return inches;
  const [, whole, numerator, denominator] = match;
  const num = Number(numerator);
  const den = Number(denominator);
  const divisor = gcd(num, den);
  return `${whole} ${num / divisor}/${den / divisor}"`;
}

function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b);
}
