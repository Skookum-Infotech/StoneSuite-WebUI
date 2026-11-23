// The slab's photo drawn inside a profile piece that fits on it: exactly the
// part of the stone it would be cut from, clipped to the profile's own
// rectangle — PieceSlabTexture.tsx's own idea, one layer further. The profile
// piece is always a plain rectangle (no arcs), so this needs none of
// PieceSlabTexture's curved-outline branch.
//
// `localOutline` is the profile's rectangle in the PARENT piece's local space
// (lib/drawing/attachedProfileGeometry.ts's attachedProfileLocalOutline) — the
// same space Piece.outline itself lives in — so it sits correctly inside the
// same translate/rotate/flip group PieceShape already wraps the parent in.

import { useId } from 'react';
import type { Piece, Point, SlabPlacement } from '@/types/drawing';
import { slabOffset } from '@/lib/drawing/slabs';
import type { SlabTexture } from './MaterialPickerContext';

interface AttachedProfileSlabTextureProps {
  /** Only its position/rotation on the board are needed — the same group the
   *  parent piece itself is drawn in. */
  piece: Pick<Piece, 'position' | 'rotationDeg'>;
  localOutline: Point[];
  /** Where the profile piece is laid on the slab (its own `attachedProfile.slab`). */
  placement: SlabPlacement;
  texture: SlabTexture;
}

export function AttachedProfileSlabTexture({ piece, localOutline, placement, texture }: AttachedProfileSlabTextureProps) {
  const clipId = `profile-slab-texture-${useId().replace(/:/g, '')}`;
  const offset = slabOffset({ outline: localOutline }, placement);

  return (
    <g
      aria-hidden="true"
      data-testid="profile-slab-texture"
      transform={`translate(${piece.position.x},${-piece.position.y}) rotate(${piece.rotationDeg}) scale(1,-1)`}
      className="pointer-events-none"
    >
      <defs>
        <clipPath id={clipId}>
          <polygon points={localOutline.map((p) => `${p.x},${p.y}`).join(' ')} />
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
