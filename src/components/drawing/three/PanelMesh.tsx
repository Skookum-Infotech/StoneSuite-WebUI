// One backsplash or waterfall wall: its footprint extruded up from where it
// starts. When its own painted side was laid on a photographed slab (the
// Material tab, same as a real piece), its visible (outer) face shows that
// stone instead of the plain colour — unfolded onto it the way the 2D board
// already draws this same profile piece (panelTexture.ts's panelSlabUv).

import { useEffect, useMemo } from 'react';
import { Float32BufferAttribute, type Texture } from 'three';
import { Edges } from '@react-three/drei';
import type { PanelSolid } from '@/lib/drawing/three/panels';
import { panelSlabUv } from '@/lib/drawing/three/panelTexture';
import { STONE_COLOR } from '@/lib/drawing/three/constants';
import { extrudeOutline, FACE_BOTTOM, FACE_SIDE, FACE_TOP, groupFaces } from './shapes';

const EDGE_LINE_THRESHOLD_DEG = 15;
const EDGE_LINE_COLOR = '#8a8478';
const STONE_ROUGHNESS = 0.35;
const STONE_METALNESS = 0.05;

export function PanelMesh({ panel, photo }: { panel: PanelSolid; photo: Texture | null }) {
  const texture = photo && panel.texture ? panel.texture : null;

  const geometry = useMemo(() => {
    const built = extrudeOutline(panel.footprint, [], panel.heightMm);
    groupFaces(built, panel.heightMm);
    if (texture) {
      // The visible face runs along footprint[0] -> footprint[1] (the
      // painted side itself, see panels.ts's `wall`); every vertex's distance
      // along that line (clamped — the inner face and the end caps share the
      // same mapping, which is a close enough stand-in since they are barely
      // visible) gives its length-fraction, and its own extruded depth
      // (0..heightMm) gives its height-fraction.
      const [a, b] = panel.footprint;
      const abx = b.x - a.x;
      const aby = b.y - a.y;
      const lengthSq = abx * abx + aby * aby || 1;
      const positions = built.getAttribute('position');
      const uvs: number[] = [];
      for (let i = 0; i < positions.count; i += 1) {
        const x = positions.getX(i);
        const y = positions.getY(i);
        const z = positions.getZ(i);
        const t = Math.min(1, Math.max(0, ((x - a.x) * abx + (y - a.y) * aby) / lengthSq));
        const h = panel.heightMm > 0 ? z / panel.heightMm : 0;
        uvs.push(...panelSlabUv(t, h, texture));
      }
      built.setAttribute('uv', new Float32BufferAttribute(uvs, 2));
    }
    return built;
  }, [panel, texture]);
  useEffect(() => () => geometry.dispose(), [geometry]);

  return (
    <mesh geometry={geometry} position={[0, panel.baseMm, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <meshStandardMaterial attach={`material-${FACE_TOP}`} color={STONE_COLOR} roughness={STONE_ROUGHNESS} metalness={STONE_METALNESS} />
      <meshStandardMaterial attach={`material-${FACE_BOTTOM}`} color={STONE_COLOR} roughness={STONE_ROUGHNESS} metalness={STONE_METALNESS} />
      {texture ? (
        // Same reasoning as PieceMesh's own top face: unlit and untoned, so
        // the photo reads as itself instead of being washed out by lighting.
        <meshBasicMaterial attach={`material-${FACE_SIDE}`} map={photo} toneMapped={false} />
      ) : (
        <meshStandardMaterial attach={`material-${FACE_SIDE}`} color={STONE_COLOR} roughness={STONE_ROUGHNESS} metalness={STONE_METALNESS} />
      )}
      <Edges threshold={EDGE_LINE_THRESHOLD_DEG} color={EDGE_LINE_COLOR} />
    </mesh>
  );
}
