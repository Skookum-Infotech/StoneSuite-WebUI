// The little picture of each Corner change — a block seen from above with its
// top-right corner changed — used in the rail's flyout and the bottom bar's
// icon row.

import type { CornerStyle } from '@/lib/drawing/corners';

const SHAPES: Record<CornerStyle, string> = {
  clip: 'M4 20V4H14L20 10V20Z',
  radius: 'M4 20V4H12Q20 4 20 12V20Z',
  radiusIn: 'M4 20V4H12Q12 12 20 12V20Z',
  bumpOut: 'M3 20V8H11L14 5L20 11L17 14V20Z',
  bumpIn: 'M3 20V4H15L12 7L18 13L21 10V20Z',
  notch: 'M4 20V4H12V12H20V20Z',
};

export function CornerStyleIcon({ style, className }: { style: CornerStyle; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinejoin="round" aria-hidden="true" className={className}>
      <path d={SHAPES[style]} />
    </svg>
  );
}
