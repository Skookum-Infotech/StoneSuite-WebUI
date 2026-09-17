import { describe, it, expect } from 'vitest';
import { parseNumberFieldValue } from './formUtils';

describe('parseNumberFieldValue', () => {
  it('returns the empty string for an empty input', () => {
    expect(parseNumberFieldValue('')).toBe('');
  });

  it('parses a valid integer', () => {
    expect(parseNumberFieldValue('42')).toBe(42);
  });

  it('parses a valid decimal', () => {
    expect(parseNumberFieldValue('19.99')).toBe(19.99);
  });

  it('parses a negative number as-is — range limits are enforced separately', () => {
    expect(parseNumberFieldValue('-5')).toBe(-5);
  });

  it('returns the empty string for an unparseable value instead of NaN', () => {
    expect(parseNumberFieldValue('abc')).toBe('');
  });

  it('returns the empty string for a bare sign or decimal point', () => {
    expect(parseNumberFieldValue('-')).toBe('');
    expect(parseNumberFieldValue('.')).toBe('');
  });
});
