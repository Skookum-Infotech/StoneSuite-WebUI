import { describe, it, expect } from 'vitest';
import { isInvalidPhoneValue, firstInvalidPhoneLabel } from './phoneValidation';

describe('isInvalidPhoneValue', () => {
  it('treats an empty value as not invalid', () => {
    expect(isInvalidPhoneValue('')).toBe(false);
  });

  it('treats whitespace-only as not invalid', () => {
    expect(isInvalidPhoneValue('   ')).toBe(false);
  });

  it('accepts a valid US number with a country code', () => {
    expect(isInvalidPhoneValue('+1 415 555 2671')).toBe(false);
  });

  it('accepts a valid US number with formatting punctuation', () => {
    expect(isInvalidPhoneValue('+1 (415) 555-2671')).toBe(false);
  });

  it('accepts a code-less legacy value that is a valid US number', () => {
    expect(isInvalidPhoneValue('4155552671')).toBe(false);
  });

  it('accepts a valid number for a non-US country', () => {
    expect(isInvalidPhoneValue('+91 98765 43210')).toBe(false);
  });

  it('accepts a valid UK number, which is not 10 digits', () => {
    expect(isInvalidPhoneValue('+44 20 7183 8750')).toBe(false);
  });

  it('rejects a US number that is too short', () => {
    expect(isInvalidPhoneValue('+1 415 555 267')).toBe(true);
  });

  it('rejects a code-less legacy value that is too short for the US', () => {
    expect(isInvalidPhoneValue('98765432')).toBe(true);
  });

  it('rejects non-numeric garbage', () => {
    expect(isInvalidPhoneValue('abc')).toBe(true);
  });
});

describe('firstInvalidPhoneLabel', () => {
  const fields = [
    { key: 'bill_phone', label: 'Bill Phone', type: 'tel' },
    { key: 'bill_fax', label: 'Bill Fax', type: 'tel' },
    { key: 'bill_city', label: 'City', type: 'text' },
  ];

  it('returns null when every tel field is valid', () => {
    const values = { bill_phone: '+1 415 555 2671', bill_fax: '', bill_city: 'anything' };
    expect(firstInvalidPhoneLabel(fields, values)).toBeNull();
  });

  it('returns the label of the first invalid tel field', () => {
    const values = { bill_phone: '123', bill_fax: '+1 415 555 2671' };
    expect(firstInvalidPhoneLabel(fields, values)).toBe('Bill Phone');
  });

  it('ignores non-tel fields entirely, even with garbage values', () => {
    const values = { bill_city: 'not-a-phone-number-123' };
    expect(firstInvalidPhoneLabel(fields, values)).toBeNull();
  });

  it('ignores a non-string value rather than throwing', () => {
    const values = { bill_phone: 12345 };
    expect(firstInvalidPhoneLabel(fields, values)).toBeNull();
  });
});
