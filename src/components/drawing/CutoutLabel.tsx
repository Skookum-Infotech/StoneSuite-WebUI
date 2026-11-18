// The text in the middle of a cutout: its name, with its Length x Height
// under it. Either line can be turned off in the Cutout dialog (the two Hide
// boxes). Drawn in the piece's local group, so it is counter-flipped upright,
// and sized by the zoom so it stays readable at any scale. Not interactive —
// clicks fall through to the cutout.

import type { Cutout } from '@/types/drawing';
import { CUTOUT_TYPE_LABELS, cutoutSize } from '@/lib/drawing/cutouts';
import { uprightTransform } from '@/lib/drawing/svgText';
import { formatLength } from '@/lib/drawing/units';
import { useDrawingEditor } from './DrawingEditorContext';

const FONT_SIZE_PX = 11;
/** Gap between the name and size lines, as a multiple of the font size. */
const LINE_OFFSET_EM = 0.65;
const HALO_PX = 3;

export function CutoutLabel({ cutout, rotationDeg }: { cutout: Cutout; rotationDeg: number }) {
  const { state } = useDrawingEditor();
  const { displayUnit, fractionDenominator } = state.present;
  const showName = !cutout.hideName;
  const showSize = !cutout.hideMeasurements;
  if (!showName && !showSize) return null;

  const { lengthMm, heightMm } = cutoutSize(cutout);
  const size = `${formatLength(lengthMm, displayUnit, fractionDenominator)} x ${formatLength(heightMm, displayUnit, fractionDenominator)}`;
  const name = cutout.label || CUTOUT_TYPE_LABELS[cutout.type];
  const font = FONT_SIZE_PX / state.zoom;
  const both = showName && showSize;
  // A white halo behind the glyphs keeps them legible over the cutout's tint
  // and over any line passing behind them.
  const textProps = {
    textAnchor: 'middle',
    dominantBaseline: 'middle',
    fontSize: font,
    strokeWidth: HALO_PX / state.zoom,
    strokeLinejoin: 'round',
    paintOrder: 'stroke',
  } as const;

  return (
    <g aria-hidden="true" pointerEvents="none" transform={uprightTransform(cutout.center, rotationDeg)}>
      {showName && (
        <text y={both ? -font * LINE_OFFSET_EM : 0} className="fill-stone-900 stroke-white font-semibold" {...textProps}>{name}</text>
      )}
      {showSize && (
        <text y={both ? font * LINE_OFFSET_EM : 0} className="fill-stone-700 stroke-white" {...textProps}>{size}</text>
      )}
    </g>
  );
}
