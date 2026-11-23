import { describe, it, expect } from 'vitest';
import { validateLogoFile, MAX_LOGO_SIZE_BYTES } from './companyLogoValidation';

function makeFile(type: string, size: number): File {
  return new File([new Uint8Array(size)], 'logo', { type });
}

describe('validateLogoFile', () => {
  const cases: Array<[string, File, string | null]> = [
    ['accepts a PNG under the size limit', makeFile('image/png', 1024), null],
    ['accepts a JPEG under the size limit', makeFile('image/jpeg', 1024), null],
    ['accepts a GIF under the size limit', makeFile('image/gif', 1024), null],
    ['accepts a WEBP under the size limit', makeFile('image/webp', 1024), null],
    ['accepts an SVG under the size limit', makeFile('image/svg+xml', 1024), null],
    ['accepts a file exactly at the size limit', makeFile('image/png', MAX_LOGO_SIZE_BYTES), null],
    [
      'accepts a dragged SVG with an empty type, by extension',
      new File([new Uint8Array(1024)], 'logo.svg', { type: '' }),
      null,
    ],
    [
      'rejects a non-image type',
      makeFile('application/pdf', 1024),
      'Logo must be a PNG, JPG, GIF, WEBP, or SVG image.',
    ],
    [
      'rejects an unsupported image type',
      makeFile('image/bmp', 1024),
      'Logo must be a PNG, JPG, GIF, WEBP, or SVG image.',
    ],
    [
      'rejects a file over the size limit',
      makeFile('image/png', MAX_LOGO_SIZE_BYTES + 1),
      `Logo exceeds the ${MAX_LOGO_SIZE_BYTES / 1024 / 1024}MB limit.`,
    ],
  ];

  it.each(cases)('%s', (_label, file, expected) => {
    expect(validateLogoFile(file)).toBe(expected);
  });
});
