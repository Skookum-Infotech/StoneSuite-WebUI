import { describe, it, expect } from 'vitest';
import { brandingSchema } from './brandingSchema';

// Pure validation logic: the logoUrl field accepts a valid http(s) URL or an
// empty string (to clear the logo), and rejects anything else.
describe('brandingSchema', () => {
  it('accepts a valid https URL', () => {
    const result = brandingSchema.safeParse({ logoUrl: 'https://cdn.example.com/logo.png' });
    expect(result.success).toBe(true);
  });

  it('accepts a valid http URL', () => {
    const result = brandingSchema.safeParse({ logoUrl: 'http://cdn.example.com/logo.png' });
    expect(result.success).toBe(true);
  });

  it('accepts an empty string (clears the logo)', () => {
    const result = brandingSchema.safeParse({ logoUrl: '' });
    expect(result.success).toBe(true);
  });

  it('trims surrounding whitespace before validating', () => {
    const result = brandingSchema.safeParse({ logoUrl: '  https://cdn.example.com/logo.png  ' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.logoUrl).toBe('https://cdn.example.com/logo.png');
    }
  });

  it.each(['not-a-url', 'ftp://cdn.example.com/logo.png', 'javascript:alert(1)'])(
    'rejects %p',
    (value) => {
      const result = brandingSchema.safeParse({ logoUrl: value });
      expect(result.success).toBe(false);
    },
  );

  it('rejects a url longer than 2048 characters', () => {
    const longUrl = 'https://example.com/' + 'a'.repeat(2048);
    const result = brandingSchema.safeParse({ logoUrl: longUrl });
    expect(result.success).toBe(false);
  });
});
