export const MAX_SLAB_PHOTO_BYTES = 10 * 1024 * 1024;
const BYTES_PER_MB = 1024 * 1024;

// GIF and SVG are left out on purpose: the photo is laid under the drawing's
// pieces and later wrapped on the 3D slab, so it must be a real raster picture.
export const ACCEPTED_SLAB_PHOTO_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
export const ACCEPTED_SLAB_PHOTO_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp'];

/** Mirrors the backend's checkUnitPhoto (StoneSuite-Backend's
 *  controllers/inventory_unit_photo.go) so a bad file is rejected before it
 *  reaches the network. Returns an error message, or null when valid. */
export function validateSlabPhotoFile(file: File): string | null {
  const name = file.name.toLowerCase();
  const hasAcceptedExtension = ACCEPTED_SLAB_PHOTO_EXTENSIONS.some((ext) => name.endsWith(ext));
  if (!ACCEPTED_SLAB_PHOTO_MIME_TYPES.includes(file.type) && !hasAcceptedExtension) {
    return 'The slab photo must be a JPG, PNG or WEBP image.';
  }
  if (file.size === 0) return 'That file is empty.';
  if (file.size > MAX_SLAB_PHOTO_BYTES) {
    return `The slab photo exceeds the ${MAX_SLAB_PHOTO_BYTES / BYTES_PER_MB}MB limit.`;
  }
  return null;
}
