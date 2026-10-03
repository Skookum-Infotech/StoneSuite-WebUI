// In-memory only: lets the review screen show the original file next to the
// form (blob preview) without persisting anything. A reload empties it, and the
// review screen then falls back to the extracted-text view.
const files = new Map<string, File>();

/** Remembers the picked file for an extraction id. */
export function setDocumentFile(extractionId: string, file: File): void {
  files.set(extractionId, file);
}

/** The picked file for an extraction id, if this tab still has it. */
export function getDocumentFile(extractionId: string): File | undefined {
  return files.get(extractionId);
}

/** Forgets the file for an extraction id. */
export function deleteDocumentFile(extractionId: string): void {
  files.delete(extractionId);
}
