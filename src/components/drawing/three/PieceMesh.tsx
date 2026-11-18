// One piece as a slab of stone: its outline extruded by its thickness, with its cutouts
// punched through, plus its backsplash/waterfall walls and seams. Built in the drawing's own
// millimetres; the scene scales it down. When the piece sits on a photographed slab, the top
// face shows that stone; the underside is always a dark, plain face.

import { useEffect, useMemo } from 'react';
import { DoubleSide, Float32BufferAttribute, FrontSide, type Texture } from 'three';
import { Edges } from '@react-three/drei';
import type { PieceSolid } from '@/lib/drawing/three/solids';
import { STONE_COLOR, UNDERSIDE_COLOR } from '@/lib/drawing/three/constants';
import { slabUv } from '@/lib/drawing/three/slabTexture';
import { PanelMesh } from './PanelMesh';
import { SeamLines } from './SeamLines';
import { SinkBowl } from './SinkBowl';
import { profiledSlabGeometry } from './slabGeometry';
import { extrudeOutline, FACE_BOTTOM, FACE_SIDE, FACE_TOP, groupFaces } from './shapes';

/** Edge lines are drawn only where faces meet at more than this angle (degrees). */
const EDGE_LINE_THRESHOLD_DEG = 15;
const EDGE_LINE_COLOR = '#8a8478';
const STONE_ROUGHNESS = 0.35;
const STONE_METALNESS = 0.05;
const UNDERSIDE_ROUGHNESS = 0.9;

/** `photo` is the slab's texture once loaded, or null (plain stone). */
export function PieceMesh({ solid, photo }: { solid: PieceSolid; photo: Texture | null }) {
  const { texture: slab } = solid;
  // The finished-edge mesh has no consistent winding, so its faces are drawn from both sides.
  const faceSide = solid.segmentFinishes ? DoubleSide : FrontSide;

  const geometry = useMemo(() => {
    // A piece with finished edges is built slice by slice; a square-edged one is a plain extrusion.
    let built;
    if (solid.segmentFinishes) {
      built = profiledSlabGeometry(solid);
    } else {
      built = extrudeOutline(solid.outline, solid.holes, solid.thicknessMm);
      groupFaces(built, solid.thicknessMm);
    }
    if (slab) {
      // Planar mapping from above: right for the top face, the only one that shows the photo.
      const positions = built.getAttribute('position');
      const uvs: number[] = [];
      for (let i = 0; i < positions.count; i += 1) uvs.push(...slabUv({ x: positions.getX(i), y: positions.getY(i) }, slab));
      built.setAttribute('uv', new Float32BufferAttribute(uvs, 2));
    }
    return built;
  }, [solid, slab]);
  useEffect(() => () => geometry.dispose(), [geometry]);

  // Laying the shape flat (-90 degrees about X) sends its y to -z and its extrusion up, so the
  // extrusion's far face is the top. Its three material slots are top, underside and sides.
  return (
    <group>
      <mesh geometry={geometry} position={[0, solid.baseMm, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        {photo ? (
          // The photo is shown as it is, unlit and untoned: lights and tone mapping would
          // wash it out or tint it, and a flat top face gains nothing from shading anyway.
          <meshBasicMaterial attach={`material-${FACE_TOP}`} map={photo} toneMapped={false} side={faceSide} />
        ) : (
          <meshStandardMaterial attach={`material-${FACE_TOP}`} color={STONE_COLOR} roughness={STONE_ROUGHNESS} metalness={STONE_METALNESS} side={faceSide} />
        )}
        <meshStandardMaterial attach={`material-${FACE_BOTTOM}`} color={UNDERSIDE_COLOR} roughness={UNDERSIDE_ROUGHNESS} side={faceSide} />
        <meshStandardMaterial attach={`material-${FACE_SIDE}`} color={STONE_COLOR} roughness={STONE_ROUGHNESS} metalness={STONE_METALNESS} side={faceSide} />
        <Edges threshold={EDGE_LINE_THRESHOLD_DEG} color={EDGE_LINE_COLOR} />
      </mesh>
      {solid.bowls.map((outline, i) => <SinkBowl key={i} outline={outline} baseMm={solid.baseMm} />)}
      {solid.panels.map((panel) => <PanelMesh key={panel.id} panel={panel} />)}
      <SeamLines seams={solid.seams} />
    </group>
  );
}
