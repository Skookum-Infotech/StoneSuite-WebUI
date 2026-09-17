import { describe, it, expect } from 'vitest';
import { applyCountryCode, parseNumberFieldValue, sanitizePhoneInput, stripCountryCode } from './formUtils';

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

describe('applyCountryCode', () => {
  it('returns the empty string unchanged', () => {
    expect(applyCountryCode('+1', '')).toBe('');
  });

  it('prepends the selected code to a fresh, code-less value', () => {
    expect(applyCountryCode('+1', '5551234567')).toBe('+1 5551234567');
  });

  it('does not double up when the value already starts with a code', () => {
    expect(applyCountryCode('+1', '+91 9876543210')).toBe('+91 9876543210');
  });

  it('sanitizes before deciding whether to prepend', () => {
    expect(applyCountryCode('+44', '555abc1234')).toBe('+44 5551234');
  });

  it('leaves a bare "+" mid-type without adding a second code', () => {
    expect(applyCountryCode('+1', '+')).toBe('+');
  });
});

describe('stripCountryCode', () => {
  it('strips a leading code and the joining space', () => {
    expect(stripCountryCode('+1', '+1 5551234567')).toBe('5551234567');
  });

  it('returns the value unchanged when it does not start with the code', () => {
    expect(stripCountryCode('+1', '+91 9876543210')).toBe('+91 9876543210');
  });

  it('returns an unprefixed legacy value unchanged', () => {
    expect(stripCountryCode('+1', '555-0100')).toBe('555-0100');
  });

  it('returns the empty string unchanged', () => {
    expect(stripCountryCode('+1', '')).toBe('');
  });

  it('round-trips with applyCountryCode', () => {
    const merged = applyCountryCode('+44', '5551234567');
    expect(stripCountryCode('+44', merged)).toBe('5551234567');
  });
});
