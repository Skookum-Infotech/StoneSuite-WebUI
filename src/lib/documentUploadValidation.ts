const BYTES_PER_MB = 1024 * 1024;

export const MAX_DOCUMENT_UPLOAD_MB = 10;
export const MAX_DOCUMENT_UPLOAD_BYTES = MAX_DOCUMENT_UPLOAD_MB * BYTES_PER_MB;

// A Sales Order / Purchase Order / Vendor Bill document: a PDF or a Word
// (.docx) file. Scanned images aren't supported yet. The extension is checked
// as well as the MIME type because browsers/OSes inconsistently report a type
// (or leave it empty) for some files.
export const ACCEPTED_DOCUMENT_EXTENSIONS = ['.pdf', '.docx'];
export const ACCEPTED_DOCUMENT_MIME_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];

/** Client-side pre-check for an uploaded document, so a bad file is rejected
 *  before it reaches the network. Returns an error message, or null when valid. */
export function validateDocumentFile(file: File): string | null {
  const name = file.name.toLowerCase();
  const hasAcceptedExtension = ACCEPTED_DOCUMENT_EXTENSIONS.some((ext) => name.endsWith(ext));
  if (!ACCEPTED_DOCUMENT_MIME_TYPES.includes(file.type) && !hasAcceptedExtension) {
    return `${file.name} is not a PDF or Word (.docx) file — scanned images aren't supported yet.`;
  }
  if (file.size === 0) {
    return `${file.name} is empty — choose a file with content.`;
  }
  if (file.size > MAX_DOCUMENT_UPLOAD_BYTES) {
    return `${file.name} is larger than ${MAX_DOCUMENT_UPLOAD_MB} MB — split it or enter the order manually.`;
  }
  return null;
}
