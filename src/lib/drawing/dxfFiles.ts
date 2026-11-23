// What the upload path and the Drawing tab need to know about a .dxf file,
// apart from its contents.

/** Matches the backend's attachment allowlist (controllers/attachments.go). */
export const DXF_CONTENT_TYPE = 'application/dxf';

/** Matches maxFileSizeBytes in the backend's controllers/attachments.go. */
export const MAX_DXF_UPLOAD_BYTES = 25 * 1024 * 1024;
/** Larger files stay downloadable; drawing them in the page would freeze it. */
export const MAX_DXF_PREVIEW_BYTES = 10 * 1024 * 1024;

const DXF_EXTENSION = '.dxf';

export function isDxfFileName(fileName: string): boolean {
  return fileName.toLowerCase().endsWith(DXF_EXTENSION);
}

/** A copy of a .dxf carrying the canonical type (browsers usually report none,
 *  and the presigned PUT is signed against the type). Other files pass through. */
export function withDxfContentType(file: File): File {
  if (!isDxfFileName(file.name) || file.type === DXF_CONTENT_TYPE) return file;
  return new File([file], file.name, { type: DXF_CONTENT_TYPE, lastModified: file.lastModified });
}

/** Sub-tab label per attachment id. A re-upload adds a tab rather than
 *  replacing one, so repeats of a name get a number, in the order given. */
export function dxfTabLabels(files: ReadonlyArray<{ id: string; fileName: string }>): Record<string, string> {
  const seen = new Map<string, number>();
  const labels: Record<string, string> = {};
  for (const { id, fileName } of files) {
    const count = (seen.get(fileName) ?? 0) + 1;
    seen.set(fileName, count);
    labels[id] = count === 1 ? fileName : `${fileName} (${count})`;
  }
  return labels;
}
