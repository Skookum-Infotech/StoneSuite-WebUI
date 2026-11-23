import { describe, expect, it } from 'vitest';
import { isValidEmail } from './emailValidation';

describe('isValidEmail', () => {
  it.each([
    ['a@b.co', true],
    ['  a@b.co  ', true],
    ['', false],
    ['plain', false],
    ['a@b', false],
    ['a b@c.com', false],
  ])('%j -> %s', (input, expected) => {
    expect(isValidEmail(input)).toBe(expected);
  });
});
