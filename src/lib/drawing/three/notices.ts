// The short notes the 3D view shows when something on the board cannot be drawn as it is in
// 2D — most usefully, why a piece shows plain stone instead of its slab photo.

import type { AreaSolids } from './solids';

const plural = (count: number, one: string, many: string): string => (count === 1 ? one : many);

/** `failedPhotos` is how many slab photos the browser could not load as textures. */
export function viewerNotices(solids: AreaSolids, failedPhotos: number): string[] {
  const count = (status: string) => solids.pieces.filter((p) => p.slabPhoto === status).length;
  const notices: string[] = [];
  if (solids.skipped > 0) {
    notices.push(`${solids.skipped} ${plural(solids.skipped, 'piece', 'pieces')} can't be shown in 3D because the outline crosses itself.`);
  }
  const misfit = count('misfit');
  if (misfit > 0) {
    notices.push(`${misfit} ${plural(misfit, 'piece is', 'pieces are')} not fully inside the slab (or overlap${plural(misfit, 's', '')} another piece), so ${plural(misfit, 'it shows', 'they show')} plain stone.`);
  }
  const missing = count('missing');
  if (missing > 0) {
    notices.push(`${missing} ${plural(missing, 'piece is', 'pieces are')} on a slab with no photo, so ${plural(missing, 'it shows', 'they show')} plain stone.`);
  }
  if (failedPhotos > 0) {
    notices.push("A slab photo couldn't be loaded into the 3D view. If it shows in 2D, the file storage is probably not allowing this site's address (CORS).");
  }
  return notices;
}
