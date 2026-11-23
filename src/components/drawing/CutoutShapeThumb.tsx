// A small drawing of one cutout shape, for the Shape box and the picker. A
// picture draws from the same recipe as the board (cutoutShapes.ts) at its
// typical size, so what you pick is what you get. With no picture it is the
// plain outline of `geometry` — the rectangle, arc or ellipse the opening has.

import type { CutoutShape } from '@/types/drawing';
import { buildShapeDrawing, shapeSizeMm, type CutoutShapeDef } from '@/lib/drawing/cutoutShapes';
import { cutoutOutline } from '@/lib/drawing/cutouts';

const PLAIN_BOX_MM = { lengthMm: 600, heightMm: 400 };
const PADDING_FRACTION = 0.06;
const STROKE_PX = 1.5;
const NO_PICTURE_LABEL = 'No picture';

const GEOMETRY_NAMES: Partial<Record<CutoutShape, string>> = { arc: 'arc', ellipse: 'ellipse', stadium: 'oval' };

export function CutoutShapeThumb({ shape, geometry = 'rect', className }: {
  shape: CutoutShapeDef | null; geometry?: CutoutShape; className?: string;
}) {
  const { lengthMm, heightMm } = shape ? shapeSizeMm(shape) : PLAIN_BOX_MM;
  const pad = Math.max(lengthMm, heightMm) * PADDING_FRACTION;
  const box = { id: 'thumb', type: shape?.type ?? 'other', center: { x: 0, y: 0 }, widthMm: lengthMm, depthMm: heightMm } as const;
  const drawing = shape ? buildShapeDrawing({ ...box, shape: 'rect', shapeCode: shape.code }) : null;
  // A rectangle picture draws its own rim; every other outline is drawn here.
  const outlineGeometry = shape?.geometry ?? geometry;
  const outline = !shape || shape.geometry !== 'rect' ? cutoutOutline({ ...box, shape: outlineGeometry }) : [];
  const stroke = { vectorEffect: 'non-scaling-stroke' } as const;
  const label = shape ? shape.name : `${NO_PICTURE_LABEL}${GEOMETRY_NAMES[geometry] ? `, ${GEOMETRY_NAMES[geometry]}` : ''}`;

  return (
    <svg
      viewBox={`${-lengthMm / 2 - pad} ${-heightMm / 2 - pad} ${lengthMm + pad * 2} ${heightMm + pad * 2}`}
      className={className}
      role="img"
      aria-label={label}
    >
      {/* Local coordinates run y-up; the picture is turned the right way round. */}
      <g transform="scale(1,-1)" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth={STROKE_PX} className="stroke-stone-900">
        {outline.length > 0 && <polygon points={outline.map((p) => `${p.x},${p.y}`).join(' ')} {...stroke} />}
        {drawing && (
          <>
            {drawing.paths.map((d, i) => <path key={i} d={d} {...stroke} />)}
            {drawing.lines.map((l, i) => <line key={i} {...l} {...stroke} />)}
            {drawing.circles.map((c, i) => <circle key={i} {...c} {...stroke} />)}
          </>
        )}
      </g>
    </svg>
  );
}
