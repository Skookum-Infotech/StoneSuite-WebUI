// A cabinet as a plain box under the counter, from the floor up, for context.

import { useEffect, useMemo } from 'react';
import { CABINET_COLOR } from '@/lib/drawing/three/constants';
import type { CabinetSolid } from '@/lib/drawing/three/solids';
import { extrudeOutline } from './shapes';

export function CabinetMesh({ cabinet }: { cabinet: CabinetSolid }) {
  const geometry = useMemo(() => extrudeOutline(cabinet.outline, [], cabinet.heightMm), [cabinet]);
  useEffect(() => () => geometry.dispose(), [geometry]);

  return (
    <mesh geometry={geometry} rotation={[-Math.PI / 2, 0, 0]}>
      <meshStandardMaterial color={CABINET_COLOR} roughness={0.8} />
    </mesh>
  );
}
