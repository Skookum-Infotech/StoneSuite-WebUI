// A small rounded square in an edge type's colour. Drawn as an SVG so the colour
// can come from data (an attribute) without an inline style.

import { cn } from '@/lib/utils';

const SWATCH_BOX = 10;
const SWATCH_RADIUS = 2;
const SWATCH_OUTLINE = 0.75;

export function ColorSwatch({ color, className }: { color: string; className?: string }) {
  return (
    <svg viewBox={`0 0 ${SWATCH_BOX} ${SWATCH_BOX}`} aria-hidden="true" className={cn('h-4 w-4 shrink-0', className)}>
      <rect width={SWATCH_BOX} height={SWATCH_BOX} rx={SWATCH_RADIUS} fill={color} className="stroke-black/30" strokeWidth={SWATCH_OUTLINE} />
    </svg>
  );
}
