// A piece's seams as thin dark lines on its top face.

import { Line } from '@react-three/drei';
import { COUNTER_HEIGHT_MM, SEAM_COLOR } from '@/lib/drawing/three/constants';
import type { Segment } from '@/lib/drawing/three/seamLines';

/** Lifts the line off the stone so the two do not flicker against each other. */
const SEAM_LIFT_MM = 0.5;
const SEAM_LINE_WIDTH = 2;

export function SeamLines({ seams }: { seams: Segment[] }) {
  // The drawing's y becomes depth (-z) once the scene is laid flat.
  return (
    <>
      {seams.map(([a, b], i) => (
        <Line
          // Seams have no id of their own and the list is replaced wholesale when it changes.
          key={i}
          points={[[a.x, COUNTER_HEIGHT_MM + SEAM_LIFT_MM, -a.y], [b.x, COUNTER_HEIGHT_MM + SEAM_LIFT_MM, -b.y]]}
          color={SEAM_COLOR}
          lineWidth={SEAM_LINE_WIDTH}
        />
      ))}
    </>
  );
}
