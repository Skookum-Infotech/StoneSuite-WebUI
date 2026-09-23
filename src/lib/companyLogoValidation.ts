export const MAX_LOGO_SIZE_BYTES = 2 * 1024 * 1024;
// SVG is accepted by extension/type but isn't image.Decode-able server-side —
// the backend sniffs it separately and rasterizes it (StoneSuite-Backend's
// controllers/company_profile.go). image/svg+xml is the standard MIME type,
// but browsers/OSes inconsistently report a bare "image/svg" or leave a
// dragged-and-dropped file's type empty, so the extension is checked too.
export const ACCEPTED_LOGO_MIME_TYPES = ['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/svg+xml', 'image/svg'];
export const ACCEPTED_LOGO_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg'];

/** Mirrors the backend's decodeLogoAsPNG constraints (StoneSuite-Backend's
 *  controllers/company_profile.go) so a bad file is rejected before it ever
 *  reaches the network. Returns an error message, or null when valid. */
export function validateLogoFile(file: File): string | null {
  const hasAcceptedExtension = ACCEPTED_LOGO_EXTENSIONS.some((ext) =>
    file.name.toLowerCase().endsWith(ext),
  );
  if (!ACCEPTED_LOGO_MIME_TYPES.includes(file.type) && !hasAcceptedExtension) {
    return 'Logo must be a PNG, JPG, GIF, WEBP, or SVG image.';
  }
  if (file.size > MAX_LOGO_SIZE_BYTES) {
    return `Logo exceeds the ${MAX_LOGO_SIZE_BYTES / 1024 / 1024}MB limit.`;
  }
  return null;
}
