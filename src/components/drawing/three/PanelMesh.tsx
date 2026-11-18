// One backsplash or waterfall wall: its footprint extruded up from where it starts.

import { useEffect, useMemo } from 'react';
import { Edges } from '@react-three/drei';
import type { PanelSolid } from '@/lib/drawing/three/panels';
import { STONE_COLOR } from '@/lib/drawing/three/constants';
import { extrudeOutline } from './shapes';

const EDGE_LINE_THRESHOLD_DEG = 15;
const EDGE_LINE_COLOR = '#8a8478';

export function PanelMesh({ panel }: { panel: PanelSolid }) {
  const geometry = useMemo(() => extrudeOutline(panel.footprint, [], panel.heightMm), [panel]);
  useEffect(() => () => geometry.dispose(), [geometry]);

  return (
    <mesh geometry={geometry} position={[0, panel.baseMm, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <meshStandardMaterial color={STONE_COLOR} roughness={0.35} metalness={0.05} />
      <Edges threshold={EDGE_LINE_THRESHOLD_DEG} color={EDGE_LINE_COLOR} />
    </mesh>
  );
}
