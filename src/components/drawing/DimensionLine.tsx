// Renders one auto-placed edge dimension (dimensions.ts's output) on the
// SVG canvas. Purely presentational — nothing on it is interactive, so it
// stays out of the tab order and screen readers skip it entirely.

import type { DimensionLineLayout } from '@/lib/drawing/dimensions';
import { formatLength } from '@/lib/drawing/units';

export function DimensionLine(
  { layout, displayUnit, fractionDenominator }: {
    layout: DimensionLineLayout;
    displayUnit: 'in' | 'mm';
    fractionDenominator: 16 | 32;
  },
) {
  // World coordinates treat +y as "up" (geometry.ts/dimensions.ts); SVG y
  // grows downward — negate every y the moment a world Point reaches markup.
  const x1 = layout.lineFrom.x;
  const y1 = -layout.lineFrom.y;
  const x2 = layout.lineTo.x;
  const y2 = -layout.lineTo.y;
  const textX = layout.textAt.x;
  const textY = -layout.textAt.y;

  return (
    <g aria-hidden="true" className="text-stone-500">
      <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="currentColor" strokeWidth={1} />
      <text
        x={textX}
        y={textY}
        transform={`rotate(${layout.rotationDeg} ${textX} ${textY})`}
        textAnchor="middle"
        fontSize={12}
        fill="currentColor"
      >
        {formatLength(layout.lengthMm, displayUnit, fractionDenominator)}
      </text>
    </g>
  );
}
