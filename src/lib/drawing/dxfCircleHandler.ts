// dxf-parser throws away a CIRCLE's extrusion, without which a mirrored circle
// (a faucet hole in a mirrored outline, say) lands on the wrong side of the
// drawing. Replaces its CIRCLE handler; the parser offers this hook for it.

import type { ICircleEntity, IEntity } from 'dxf-parser';
import type IGeometry from 'dxf-parser/dist/entities/geomtry';

export type MirrorableCircle = ICircleEntity & { extrusionDirectionZ?: number };

const GROUP = {
  LINE_TYPE: 6, LAYER: 8, CENTER_X: 10, CENTER_Y: 20, CENTER_Z: 30, RADIUS: 40,
  VISIBILITY: 60, PAPER_SPACE: 67, EXTRUSION_Z: 230,
} as const;

export class MirrorableCircleHandler implements IGeometry {
  ForEntityName = 'CIRCLE' as const;

  parseEntity: IGeometry['parseEntity'] = (scanner, first) => {
    const entity: Partial<MirrorableCircle> = { type: String(first.value) };
    const center = { x: NaN, y: NaN, z: 0 };
    let curr = scanner.next();
    while (!scanner.isEOF() && curr.code !== 0) {
      const { code, value } = curr;
      if (code === GROUP.LINE_TYPE) entity.lineType = String(value);
      else if (code === GROUP.LAYER) entity.layer = String(value);
      else if (code === GROUP.CENTER_X) center.x = Number(value);
      else if (code === GROUP.CENTER_Y) center.y = Number(value);
      else if (code === GROUP.CENTER_Z) center.z = Number(value);
      else if (code === GROUP.RADIUS) entity.radius = Number(value);
      else if (code === GROUP.VISIBILITY) entity.visible = value === 0;
      else if (code === GROUP.PAPER_SPACE) entity.inPaperSpace = value !== 0;
      else if (code === GROUP.EXTRUSION_Z) entity.extrusionDirectionZ = Number(value);
      curr = scanner.next();
    }
    entity.center = center;
    return entity as IEntity;
  };
}
