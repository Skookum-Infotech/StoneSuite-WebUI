import { describe, expect, it } from 'vitest';
import { MAX_SLAB_PHOTO_BYTES, validateSlabPhotoFile } from './slabPhotoValidation';

function fileOf(name: string, type: string, size: number): File {
  return new File([new Uint8Array(size)], name, { type });
}

describe('validateSlabPhotoFile', () => {
  it.each([
    ['a jpeg', fileOf('slab.jpg', 'image/jpeg', 100)],
    ['a png', fileOf('slab.png', 'image/png', 100)],
    ['a webp', fileOf('slab.webp', 'image/webp', 100)],
    ['a file with no reported type but a good extension', fileOf('IMG_0042.JPEG', '', 100)],
    ['a photo exactly at the size limit', fileOf('big.jpg', 'image/jpeg', MAX_SLAB_PHOTO_BYTES)],
  ])('accepts %s', (_label, file) => {
    expect(validateSlabPhotoFile(file)).toBeNull();
  });

  it.each([
    ['a gif', fileOf('slab.gif', 'image/gif', 100), /JPG, PNG or WEBP/],
    ['an svg', fileOf('slab.svg', 'image/svg+xml', 100), /JPG, PNG or WEBP/],
    ['a pdf', fileOf('slab.pdf', 'application/pdf', 100), /JPG, PNG or WEBP/],
    ['an empty file', fileOf('slab.jpg', 'image/jpeg', 0), /empty/],
    ['a photo over the limit', fileOf('huge.jpg', 'image/jpeg', MAX_SLAB_PHOTO_BYTES + 1), /10MB/],
  ])('rejects %s', (_label, file, message) => {
    expect(validateSlabPhotoFile(file)).toMatch(message);
  });
});
