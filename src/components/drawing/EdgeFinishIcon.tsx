// The side-on picture of one 3D finish: the slab's edge as a dark shape. `none`
// is a plain square edge.

import type { EdgeFinish } from '@/types/drawing';
import { EDGE_FINISH_PROFILES, EDGE_PROFILE_VIEWBOX } from '@/lib/drawing/edgeFinishProfiles';

/** The square edge: the same slab as the profiles, cut straight across. */
const SQUARE_EDGE = { x: 8, y: 32, width: 80, height: 36 };

export function EdgeFinishIcon({ finish, className }: { finish: EdgeFinish; className?: string }) {
  return (
    <svg viewBox={`0 0 ${EDGE_PROFILE_VIEWBOX} ${EDGE_PROFILE_VIEWBOX}`} aria-hidden="true" className={className}>
      {finish === 'none'
        ? <rect {...SQUARE_EDGE} className="fill-stone-800" />
        : <polygon points={EDGE_FINISH_PROFILES[finish]} className="fill-stone-800" />}
    </svg>
  );
}
