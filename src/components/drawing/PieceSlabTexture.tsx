// The slab's photo drawn inside a piece that fits on it: exactly the part of the stone
// the piece would be cut from, clipped to the piece's outline. Drawn under the outline,
// seams, cutouts and label, which sit on top as usual.
//
// The slab photo lives in slab space (y-down mm from the slab's top-left). A placement
// puts a piece's local point p at  rotate(flipY(p)) + offset  on the slab, so inside the
// piece's own y-up local group the photo needs the inverse: subtract the offset, rotate
// back, flip y. SVG applies a transform list right to left.

import { useId } from 'react';
import type { Piece, Point, SlabPlacement } from '@/types/drawing';
import { hasArcs, outlinePath } from '@/lib/drawing/arcs';
import { slabOffset } from '@/lib/drawing/slabs';
import type { SlabTexture } from './MaterialPickerContext';

interface PieceSlabTextureProps {
  piece: Piece;
  /** Where the piece is laid on the slab (the piece's own `slab`). */
  placement: SlabPlacement;
  /** Where the piece is drawn right now (it moves with a drag preview). */
  position: Point;
  texture: SlabTexture;
}

export function PieceSlabTexture({ piece, placement, position, texture }: PieceSlabTextureProps) {
  const clipId = `slab-texture-${useId().replace(/:/g, '')}`;
  const offset = slabOffset(piece, placement);
  const curved = hasArcs(piece.edges);

  return (
    <g
      aria-hidden="true"
      data-testid="slab-texture"
      transform={`translate(${position.x},${-position.y}) rotate(${piece.rotationDeg}) scale(1,-1)`}
      className="pointer-events-none"
    >
      <defs>
        <clipPath id={clipId}>
          {curved ? (
            // Drawn in screen orientation, then mirrored back into this group's y-up space.
            <path d={outlinePath(piece.outline.map((p) => ({ x: p.x, y: -p.y })), piece.edges)} transform="scale(1,-1)" />
          ) : (
            <polygon points={piece.outline.map((p) => `${p.x},${p.y}`).join(' ')} />
          )}
        </clipPath>
      </defs>
      <g clipPath={`url(#${clipId})`}>
        <image
          href={texture.photoUrl}
          x={0}
          y={0}
          width={texture.lengthMm}
          height={texture.widthMm}
          preserveAspectRatio="none"
          transform={`scale(1,-1) rotate(${-placement.rotationDeg}) translate(${-offset.x},${-offset.y})`}
        />
      </g>
    </g>
  );
}
