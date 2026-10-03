const BYTES_PER_MB = 1024 * 1024;

export const MAX_DOCUMENT_UPLOAD_MB = 10;
export const MAX_DOCUMENT_UPLOAD_BYTES = MAX_DOCUMENT_UPLOAD_MB * BYTES_PER_MB;

// A Sales Order / Purchase Order / Vendor Bill document: a PDF or a Word
// (.docx) file. Scanned images aren't supported yet. The extension is checked
// as well as the MIME type because browsers/OSes inconsistently report a type
// (or leave it empty) for some files.
export const ACCEPTED_DOCUMENT_EXTENSIONS = ['.pdf', '.docx'];
const PDF_MIME = 'application/pdf';
const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
export const ACCEPTED_DOCUMENT_MIME_TYPES = [PDF_MIME, DOCX_MIME];

/** The file input's `accept` value for a document picker. */
export const DOCUMENT_ACCEPT_ATTRIBUTE = [...ACCEPTED_DOCUMENT_EXTENSIONS, ...ACCEPTED_DOCUMENT_MIME_TYPES].join(',');

const MIME_BY_EXTENSION: Record<string, string> = { '.pdf': PDF_MIME, '.docx': DOCX_MIME };
// Types a browser/OS reports when it doesn't know the file — the extension decides then.
const GENERIC_MIME_TYPES = ['', 'application/octet-stream'];

/** The content type to register and upload with. A known type is kept; an
 *  empty/generic one is derived from the extension, so the presigned PUT and
 *  the server's stored type agree (a mismatch makes R2 reject the upload). */
export function documentContentType(file: File): string {
  if (!GENERIC_MIME_TYPES.includes(file.type)) return file.type;
  const name = file.name.toLowerCase();
  const ext = ACCEPTED_DOCUMENT_EXTENSIONS.find((e) => name.endsWith(e));
  return ext ? MIME_BY_EXTENSION[ext] : file.type;
}

/** The same file re-typed with documentContentType, or the file itself when
 *  its type is already right (no copy). */
export function withDocumentContentType(file: File): File {
  const type = documentContentType(file);
  return type === file.type ? file : new File([file], file.name, { type, lastModified: file.lastModified });
}

/** Client-side pre-check for an uploaded document, so a bad file is rejected
 *  before it reaches the network. Returns an error message, or null when valid. */
export function validateDocumentFile(file: File): string | null {
  const name = file.name.toLowerCase();
  const hasAcceptedExtension = ACCEPTED_DOCUMENT_EXTENSIONS.some((ext) => name.endsWith(ext));
  if (!ACCEPTED_DOCUMENT_MIME_TYPES.includes(file.type) && !hasAcceptedExtension) {
    return file.type.startsWith('image/')
      ? `${file.name} is an image — scanned images aren't supported yet. Upload the original PDF or Word (.docx) file.`
      : `${file.name} isn't a PDF or Word (.docx) file. Save it as a PDF or .docx and try again.`;
  }
  if (file.size === 0) {
    return `${file.name} is empty — choose a file with content.`;
  }
  if (file.size > MAX_DOCUMENT_UPLOAD_BYTES) {
    return `${file.name} is larger than ${MAX_DOCUMENT_UPLOAD_MB} MB — split it or enter the order manually.`;
  }
  return null;
}
