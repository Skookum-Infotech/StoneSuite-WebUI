// Piece-level geometry validation: is this outline something a fabricator
// could actually cut, and do the piece's cutouts still fit inside it.

import type { Piece, Point } from '@/types/drawing';
import { MAX_DIMENSION_MM, MIN_EDGE_LENGTH_MM } from './constants';
import { validateCutouts } from './cutouts';
import { area, distance } from './geometry';
import { isSimplePolygon } from './polygon';

const MIN_OUTLINE_POINTS = 3;

/** Problems with a bare outline, one plain-language message each. Empty means
 *  the outline is a usable simple polygon. */
export function validateOutline(outline: Point[]): string[] {
  if (outline.length < MIN_OUTLINE_POINTS) return [`A piece needs at least ${MIN_OUTLINE_POINTS} corners.`];
  if (outline.some((p) => !Number.isFinite(p.x) || !Number.isFinite(p.y))) return ['A corner has an invalid position.'];

  const issues: string[] = [];
  const tooLarge = outline.some((p) => Math.abs(p.x) > MAX_DIMENSION_MM || Math.abs(p.y) > MAX_DIMENSION_MM);
  if (tooLarge) issues.push('The piece is larger than the maximum supported size.');

  const shortEdge = outline.findIndex((p, i) => distance(p, outline[(i + 1) % outline.length]) < MIN_EDGE_LENGTH_MM);
  if (shortEdge >= 0) issues.push(`Side ${shortEdge + 1} is too short — two corners are on top of each other.`);

  if (area(outline) <= 0) issues.push('The piece has no area.');
  else if (shortEdge < 0 && !isSimplePolygon(outline)) issues.push('The sides cross each other.');
  return issues;
}

/** Everything wrong with a piece as a whole: its outline, its thickness, and
 *  where its cutouts sit relative to that outline. */
export function validatePiece(piece: Pick<Piece, 'outline' | 'thicknessMm' | 'cutouts'>): string[] {
  const issues = validateOutline(piece.outline);
  if (!(piece.thicknessMm > 0)) issues.push('Thickness must be above zero.');
  if (issues.length === 0) issues.push(...validateCutouts(piece).map((i) => i.message));
  return issues;
}
