// Mirrors controllers/import.go's importAllowedExt / maxImportFileSizeBytes —
// keep these two in sync so a client-side rejection matches what the
// presign endpoint would reject anyway, and a client-side acceptance never
// surprises the caller with a 400 it could have caught locally.
export const IMPORT_ALLOWED_EXT: Record<string, string> = {
  '.csv': 'text/csv',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.pdf': 'application/pdf',
};

export const MAX_IMPORT_FILE_SIZE_BYTES = 25 * 1024 * 1024;

export function importFileExt(fileName: string): string {
  const idx = fileName.lastIndexOf('.');
  return idx === -1 ? '' : fileName.slice(idx).toLowerCase();
}

/** Client-side pre-check mirroring the presign endpoint's own validation, so
 *  a bad file is rejected immediately rather than after a round trip. */
export function validateImportFile(file: File): string | null {
  const ext = importFileExt(file.name);
  if (!(ext in IMPORT_ALLOWED_EXT)) {
    return `File type "${ext || file.name}" is not supported (allowed: csv, xlsx, docx, pdf).`;
  }
  if (file.size <= 0 || file.size > MAX_IMPORT_FILE_SIZE_BYTES) {
    return `File must be between 1 byte and ${MAX_IMPORT_FILE_SIZE_BYTES / 1024 / 1024} MB.`;
  }
  return null;
}
