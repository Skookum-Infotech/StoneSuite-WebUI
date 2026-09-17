import { describe, it, expect } from 'vitest';
import { parseNumberFieldValue, sanitizePhoneInput } from './formUtils';

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

describe('sanitizePhoneInput', () => {
  it('returns the empty string unchanged', () => {
    expect(sanitizePhoneInput('')).toBe('');
  });

  it('leaves a fully-formatted phone number untouched', () => {
    expect(sanitizePhoneInput('+1 (555) 123-4567')).toBe('+1 (555) 123-4567');
  });

  it('leaves dot-separated digits untouched', () => {
    expect(sanitizePhoneInput('555.123.4567')).toBe('555.123.4567');
  });

  it('strips letters typed into an otherwise numeric value', () => {
    expect(sanitizePhoneInput('555abc1234')).toBe('5551234');
  });

  it('strips every letter from a vanity number, keeping the digits and dashes', () => {
    expect(sanitizePhoneInput('1-800-FLOWERS')).toBe('1-800-');
  });

  it('strips a value with no digits at all down to nothing', () => {
    expect(sanitizePhoneInput('abc')).toBe('');
  });
});
