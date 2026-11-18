// The steel bowl you see through a sink opening: walls and a floor hanging below the slab.

import { useEffect, useMemo } from 'react';
import { DoubleSide } from 'three';
import type { Point } from '@/types/drawing';
import { SINK_BOWL_COLOR, SINK_BOWL_DEPTH_MM } from '@/lib/drawing/three/constants';
import { bowlGeometry } from './slabGeometry';

const BOWL_ROUGHNESS = 0.35;
const BOWL_METALNESS = 0.4;

/** `baseMm` is the underside of the slab the opening is cut in. */
export function SinkBowl({ outline, baseMm }: { outline: Point[]; baseMm: number }) {
  const geometry = useMemo(() => bowlGeometry(outline, SINK_BOWL_DEPTH_MM), [outline]);
  useEffect(() => () => geometry.dispose(), [geometry]);

  return (
    <mesh geometry={geometry} position={[0, baseMm, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <meshStandardMaterial color={SINK_BOWL_COLOR} roughness={BOWL_ROUGHNESS} metalness={BOWL_METALNESS} side={DoubleSide} />
    </mesh>
  );
}
