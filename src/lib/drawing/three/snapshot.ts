// Saving the 3D view as a PNG picture.

/** Longest area name kept in a file name. */
const MAX_NAME_LENGTH = 40;

/** "Kitchen Island!" -> "kitchen-island-3d.png"; an unnamed area is just "drawing-3d.png". */
export function snapshotFileName(areaName: string): string {
  const slug = areaName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, MAX_NAME_LENGTH)
    .replace(/-+$/g, '');
  return `${slug || 'drawing'}-3d.png`;
}

export function downloadBlob(fileName: string, blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
