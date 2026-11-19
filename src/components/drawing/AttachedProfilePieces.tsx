// Renders every side a piece has painted with the Profiles tool as its own
// unfolded rectangle next to the parent edge — labeled and dimensioned (one
// real DimensionLine for its length, one for its width) — the way the C1
// Lamination-B / C1 Backsplash-C reference mock lays them out. It is a real
// piece in its own right (an unfinished stone shape), so only the attached
// part is tinted in the type's colour: a band along the near edge (shared
// with the parent) and the matching stretch of the parent's own border. An
// arrow bridges the gap between the two, but only while the Profiles tool
// itself is armed — not all the time a side happens to be painted. Nothing
// here is stored: the rectangle, the bands, the arrow and the label are all
// derived from PieceEdge.attachedProfile via attachedProfilePieces() every
// render, the same way PieceEdgeColors derives Edges' paint colour.
// Presentational, except for two things: while the Material tab has a slab
// armed for picking, each rectangle becomes its own clickable target too
// (PieceShape's own pickingSlab branch, one layer further), so a profile
// piece can be laid on a slab independently of its parent piece; and once
// one is laid on a slab with a photo, that photo shows through it exactly
// like it does for a real piece (PieceSlabTexture, one layer further again).

import { memo, useMemo } from 'react';
import type { Piece, Point } from '@/types/drawing';
import { attachedProfileLocalOutline, attachedProfilePieces } from '@/lib/drawing/attachedProfileGeometry';
import { DIMENSION_FONT_SIZE_PX, DIMENSION_OFFSET_PX, MIN_READABLE_TEXT_PX } from '@/lib/drawing/constants';
import { layoutDimension } from '@/lib/drawing/dimensions';
import { othersOnSlab, placedOutline, slabFit } from '@/lib/drawing/slabs';
import { profilePlaceableId, slabPlaceables } from '@/lib/drawing/slabPlaceables';
import { canvasTextScaleDivisor } from '@/lib/drawing/textScale';
import { AttachedProfileSlabTexture } from './AttachedProfileSlabTexture';
import { useAttachedProfileTypeList } from './AttachedProfileTypesContext';
import { DimensionLine } from './DimensionLine';
import { useDrawingEditor } from './DrawingEditorContext';
import { useMaterialPicker } from './MaterialPickerContext';

const LABEL_FONT_SIZE_PX = 12;
const LABEL_GAP_PX = 6;
const STROKE_OPACITY = 0.9;
/** How far the mitered-corner accent line reaches into the rectangle. */
const MITER_MARK_FRACTION = 0.4;
/** Weight of the coloured band along the attached edge — on both the profile
 *  piece's near side and the matching stretch of the parent's own border —
 *  matching PieceEdgeColors' own band weight so the two read as one system. */
const ATTACH_BAND_STROKE_PX = 4;
/** Length and half-width of the arrowhead connecting the parent border to
 *  the profile piece across the gap. */
const ARROW_HEAD_LENGTH_PX = 9;
const ARROW_HEAD_HALF_WIDTH_PX = 4;

const toScreen = (p: Point): Point => ({ x: p.x, y: -p.y });

const midpoint = (a: Point, b: Point): Point => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });

/** A triangle's points, in screen space, for an arrowhead whose tip sits at
 *  `to` and points back along the line from `from`. */
function arrowheadPoints(from: Point, to: Point, headLength: number, halfWidth: number): string {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len;
  const uy = dy / len;
  const backX = to.x - ux * headLength;
  const backY = to.y - uy * headLength;
  const perpX = -uy * halfWidth;
  const perpY = ux * halfWidth;
  return `${to.x},${to.y} ${backX + perpX},${backY + perpY} ${backX - perpX},${backY - perpY}`;
}

export const AttachedProfilePieces = memo(function AttachedProfilePieces({ piece }: { piece: Piece }) {
  const { state, tool } = useDrawingEditor();
  const { pickingSlab, pickProfile, slabTextures } = useMaterialPicker();
  const { displayUnit, fractionDenominator } = state.present;
  const types = useAttachedProfileTypeList();
  const divisor = canvasTextScaleDivisor(state.zoom, LABEL_FONT_SIZE_PX, MIN_READABLE_TEXT_PX);
  const px = (value: number) => value / divisor;
  // Stroke weights — unlike text/positions above, these must NOT also go
  // through canvasTextScaleDivisor's floor: dividing by the raw zoom is
  // already exactly cancelled by the board's own scale(zoom) transform, so
  // this alone keeps every line a constant on-screen weight at any zoom,
  // from zoomed in down to the 2% floor. (Combining this with
  // vector-effect="non-scaling-stroke" — which independently strips the
  // zoom scale back out — double-compensated in the wrong direction and
  // made every stroke balloon wider the further out you zoomed.)
  const strokePx = (value: number) => value / state.zoom;
  // Same stand-off PieceDimensions uses for a real piece's own sides, so a
  // profile's one dimension line reads at the same weight as the rest of the
  // drawing's dimensioning.
  const dimensionOffsetMm = DIMENSION_OFFSET_PX / canvasTextScaleDivisor(state.zoom, DIMENSION_FONT_SIZE_PX, MIN_READABLE_TEXT_PX);

  const pieces = useMemo(() => attachedProfilePieces(piece, types), [piece, types]);
  // For "does this profile's slab placement still fit" (below) — every piece
  // and profile piece on the board, the same list the Material tab itself
  // picks and drags against (lib/drawing/slabPlaceables.ts).
  const placeables = useMemo(() => slabPlaceables(state.present.areas, types), [state.present.areas, types]);

  return (
    <g>
      {pieces.map((p) => {
        const screen = p.outline.map(toScreen);
        const [nearA, nearB, farB, farA] = screen;
        const center = {
          x: screen.reduce((s, q) => s + q.x, 0) / screen.length,
          y: screen.reduce((s, q) => s + q.y, 0) / screen.length,
        };
        // The near edge's outward side — the label sits just beyond the far edge.
        const labelAnchor = { x: (farA.x + farB.x) / 2, y: (farA.y + farB.y) / 2 };
        const normal = { x: labelAnchor.x - center.x, y: labelAnchor.y - center.y };
        const normalLen = Math.hypot(normal.x, normal.y) || 1;
        const labelPos = {
          x: labelAnchor.x + (normal.x / normalLen) * px(LABEL_GAP_PX),
          y: labelAnchor.y + (normal.y / normalLen) * px(LABEL_GAP_PX),
        };
        const parentScreen = p.parentEdge.map(toScreen);
        const [pA, pB] = parentScreen;
        const parentMid = midpoint(pA, pB);
        const nearMid = midpoint(nearA, nearB);
        // The length dimension — the rectangle's long side, same length as the
        // parent's own painted side — gets one real dimension line, on the far
        // (outer) edge only, in the same direction the piece was already
        // extended in (world-space outline[3] -> outline[2]). Keeping it on
        // the outer edge, further out than the band/arrow/label around the
        // near edge, keeps it well clear of the parent's own dimension lines
        // instead of piling both up in the gap.
        const lengthLayout = layoutDimension(p.outline[3], p.outline[2], dimensionOffsetMm);
        // The width (the measurement chosen when it was painted) gets its own
        // line too, on the "start" end — outline[0] -> outline[3] — pushed
        // further past that end (away from the piece), clear of the arrow and
        // the length dimension's own corner.
        const widthLayout = layoutDimension(p.outline[0], p.outline[3], dimensionOffsetMm);
        // The slab (if any) this profile piece — not its parent — was laid on,
        // and whether its photo still belongs on it (not run off the slab or
        // onto something else there, same rule a real piece's texture follows).
        const placement = piece.edges.find((e) => e.index === p.index)?.attachedProfile?.slab;
        const localOutline = attachedProfileLocalOutline(piece.outline, p.index, p.widthMm);
        const slabTexture = placement && slabTextures[placement.slabId];
        const texture = localOutline && placement && slabTexture
          && slabFit(
            placedOutline({ outline: localOutline }, placement), slabTexture,
            othersOnSlab(placeables, placement.slabId, profilePlaceableId(piece.id, p.index)),
          ) === 'fits'
          ? slabTexture : null;
        return (
          <g key={p.index}>
            {texture && localOutline && placement && (
              <AttachedProfileSlabTexture piece={piece} localOutline={localOutline} placement={placement} texture={texture} />
            )}
            <g aria-hidden="true" pointerEvents="none">
              {/* The profile is a real (unfinished-stone) piece of its own, not a
                  tinted block — the same neutral fill/stroke a drawn piece gets.
                  Transparent instead, once its slab's photo is showing through. */}
              <polygon
                points={screen.map((q) => `${q.x},${q.y}`).join(' ')}
                className={texture ? 'fill-transparent stroke-stone-900' : 'fill-white/70 stroke-stone-900'}
                strokeWidth={strokePx(2)}
              />
              {/* Only the attached part is tinted: the shared edge on the
                  profile piece, and the matching stretch of the parent's own
                  border — not the whole profile piece. */}
              <line
                x1={nearA.x} y1={nearA.y} x2={nearB.x} y2={nearB.y}
                stroke={p.color} strokeOpacity={STROKE_OPACITY} strokeWidth={strokePx(ATTACH_BAND_STROKE_PX)}
              />
              <line
                x1={pA.x} y1={pA.y} x2={pB.x} y2={pB.y}
                stroke={p.color} strokeOpacity={STROKE_OPACITY} strokeWidth={strokePx(ATTACH_BAND_STROKE_PX)}
              />
              {/* The arrow bridging the gap, from the parent's border to the
                  profile piece it was attached from — only while the Profiles
                  tool itself is armed, not all the time a side is painted. */}
              {tool === 'profile' && (
                <g data-testid="profile-attach-arrow">
                  <line
                    x1={parentMid.x} y1={parentMid.y} x2={nearMid.x} y2={nearMid.y}
                    stroke={p.color} strokeOpacity={STROKE_OPACITY} strokeWidth={strokePx(2)}
                  />
                  <polygon
                    points={arrowheadPoints(parentMid, nearMid, px(ARROW_HEAD_LENGTH_PX), px(ARROW_HEAD_HALF_WIDTH_PX))}
                    fill={p.color} fillOpacity={STROKE_OPACITY}
                  />
                </g>
              )}
              {p.miteredStart && (
                <line
                  x1={nearA.x} y1={nearA.y}
                  x2={nearA.x + (farA.x - nearA.x) * MITER_MARK_FRACTION + (nearB.x - nearA.x) * MITER_MARK_FRACTION}
                  y2={nearA.y + (farA.y - nearA.y) * MITER_MARK_FRACTION + (nearB.y - nearA.y) * MITER_MARK_FRACTION}
                  stroke={p.color} strokeWidth={strokePx(2)}
                />
              )}
              {p.miteredEnd && (
                <line
                  x1={nearB.x} y1={nearB.y}
                  x2={nearB.x + (farB.x - nearB.x) * MITER_MARK_FRACTION + (nearA.x - nearB.x) * MITER_MARK_FRACTION}
                  y2={nearB.y + (farB.y - nearB.y) * MITER_MARK_FRACTION + (nearA.y - nearB.y) * MITER_MARK_FRACTION}
                  stroke={p.color} strokeWidth={strokePx(2)}
                />
              )}
              <text
                x={labelPos.x} y={labelPos.y} textAnchor="middle" dominantBaseline="middle"
                fontSize={px(LABEL_FONT_SIZE_PX)} className="fill-stone-900 font-semibold select-none"
              >
                {p.label}
              </text>
              <DimensionLine layout={lengthLayout} displayUnit={displayUnit} fractionDenominator={fractionDenominator} />
              <DimensionLine layout={widthLayout} displayUnit={displayUnit} fractionDenominator={fractionDenominator} />
            </g>
            {pickingSlab && (
              <g
                role="button"
                tabIndex={0}
                aria-label={`Lay ${p.label} on slab ${pickingSlab.serial}`}
                onPointerDown={(e) => { e.stopPropagation(); pickProfile(piece.id, p.index); }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    pickProfile(piece.id, p.index);
                  }
                }}
                className="cursor-crosshair outline-none"
              >
                <polygon points={screen.map((q) => `${q.x},${q.y}`).join(' ')} fill="transparent" />
              </g>
            )}
          </g>
        );
      })}
    </g>
  );
});
