// The little picture of each Border reshape — a block seen from above with the
// reshaped top side — used in the rail's flyout and the bottom bar's icon row.

import type { BorderStyle } from '@/lib/drawing/borders';

const SHAPES: Record<BorderStyle, string> = {
  fullRadiusOut: 'M4 19V12Q12 4 20 12V19Z',
  fullRadiusIn: 'M4 19V6Q12 14 20 6V19Z',
  bumpOut: 'M4 19V11H8V6H16V11H20V19Z',
  bumpIn: 'M4 19V6H8V11H16V6H20V19Z',
  arcBumpOut: 'M4 19V11H7Q12 4 17 11H20V19Z',
  arcBumpIn: 'M4 19V6H7Q12 13 17 6H20V19Z',
};

export function BorderStyleIcon({ style, className }: { style: BorderStyle; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinejoin="round" aria-hidden="true" className={className}>
      <path d={SHAPES[style]} />
    </svg>
  );
}
