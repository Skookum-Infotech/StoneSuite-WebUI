const BYTES_PER_MB = 1024 * 1024;

// 25 MB is the cap the app's other uploads (record attachments, imports,
// feedback) use — align it with the backend's limit once its upload endpoint
// for these documents exists.
export const MAX_DOCUMENT_UPLOAD_BYTES = 25 * BYTES_PER_MB;

// A scanned or emailed Sales Order / Purchase Order / Vendor Bill: a PDF, or a
// photo of one. The extension is checked as well as the MIME type because
// browsers/OSes inconsistently report a type (or leave it empty) for some files.
export const ACCEPTED_DOCUMENT_EXTENSIONS = ['.pdf', '.png', '.jpg', '.jpeg'];
export const ACCEPTED_DOCUMENT_MIME_TYPES = ['application/pdf', 'image/png', 'image/jpeg'];

/** Client-side pre-check for an uploaded document, so a bad file is rejected
 *  before it reaches the network. Returns an error message, or null when valid. */
export function validateDocumentFile(file: File): string | null {
  const name = file.name.toLowerCase();
  const hasAcceptedExtension = ACCEPTED_DOCUMENT_EXTENSIONS.some((ext) => name.endsWith(ext));
  if (!ACCEPTED_DOCUMENT_MIME_TYPES.includes(file.type) && !hasAcceptedExtension) {
    return `"${file.name}" isn't a supported file type — upload a PDF, PNG, or JPG.`;
  }
  if (file.size === 0) {
    return `"${file.name}" is empty.`;
  }
  if (file.size > MAX_DOCUMENT_UPLOAD_BYTES) {
    return `"${file.name}" is larger than the ${MAX_DOCUMENT_UPLOAD_BYTES / BYTES_PER_MB} MB limit.`;
  }
  return null;
}
