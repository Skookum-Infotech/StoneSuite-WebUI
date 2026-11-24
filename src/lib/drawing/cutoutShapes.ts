// The shapes a cutout can take (Cutout dialog > Shape > Change). Two layers:
//
// - A tab is the outline of the opening itself — rectangle, arc or ellipse —
//   and each tab's "No Picture" is just that outline. Which tabs a cutout type
//   offers is `tabsForType`.
// - A picture (a farmhouse sink, a burner layout, a flame) is drawn inside the
//   opening on top of its outline. Pictures belong to one tab and set the
//   opening's outline to theirs; the bowls, drains and lines are decoration,
//   not extra cuts.
//
// A picture is a recipe in proportions of the opening's box — x and y run 0..1
// from its left and top, a radius is a fraction of its shorter side — so it
// stretches to whatever size the cutout is. `buildShapeDrawing` turns a recipe
// into drawable paths for a cutout, in the piece's local coordinates; the board
// and the picker thumbnails both draw from it, so they always match.

import type { Cutout, CutoutShape, CutoutType, Point } from '@/types/drawing';
import { MM_PER_INCH } from './constants';
import { rotatePoint } from './geometry';
import { cutoutSize } from './cutouts';

type Pt = [number, number];
type Seg = ['M', Pt] | ['L', Pt] | ['C', Pt, Pt, Pt] | ['Z'];

export type ShapePart =
  | { k: 'poly'; pts: Pt[]; r: number }
  | { k: 'circle'; at: Pt; r: number }
  | { k: 'plus'; at: Pt; r: number }
  | { k: 'line'; a: Pt; b: Pt }
  | { k: 'curve'; segs: Seg[] };

export type ShapeTab = 'rectangle' | 'arc' | 'ellipse';

/** The outline each tab gives the opening when it has no picture. */
export const SHAPE_TABS: Record<ShapeTab, { label: string; geometry: CutoutShape }> = {
  rectangle: { label: 'Rectangle', geometry: 'rect' },
  arc: { label: 'Arc', geometry: 'arc' },
  ellipse: { label: 'Ellipse', geometry: 'ellipse' },
};

/** The tabs each type offers, in order; the first is what a new cutout opens on.
 *  A type with one tab shows no tab strip. Faucet has no shapes yet. */
const TABS_BY_TYPE: Partial<Record<CutoutType, ShapeTab[]>> = {
  sink: ['rectangle'],
  cooktop: ['rectangle'],
  fireplace: ['arc', 'rectangle'],
  bathtub: ['ellipse', 'rectangle'],
  other: ['arc', 'rectangle', 'ellipse'],
};

export const tabsForType = (type: CutoutType): ShapeTab[] => TABS_BY_TYPE[type] ?? [];

/** The tab an opening of this outline sits under (an oval is an ellipse). */
export function tabOfGeometry(geometry: CutoutShape | undefined): ShapeTab {
  if (geometry === 'arc') return 'arc';
  if (geometry === 'ellipse' || geometry === 'stadium') return 'ellipse';
  return 'rectangle';
}

export interface CutoutShapeDef {
  code: string;
  name: string;
  type: CutoutType;
  tab: ShapeTab;
  /** The outline the opening takes when this picture is chosen. */
  geometry: CutoutShape;
  /** The size a cutout of this shape starts at, in inches (length x height). */
  sizeIn: { length: number; height: number };
  parts: ShapePart[];
}

// ── recipe helpers ──────────────────────────────────────────────────────────

const rect = (x: number, y: number, w: number, h: number, r = 0): ShapePart => ({
  k: 'poly', r, pts: [[x, y], [x + w, y], [x + w, y + h], [x, y + h]],
});
const drain = (x: number, y: number, r = 0.045): ShapePart => ({ k: 'circle', at: [x, y], r });
const line = (a: Pt, b: Pt): ShapePart => ({ k: 'line', a, b });
/** Evenly spread flat lines across x1..x2 at each y. */
const flatLines = (x1: number, x2: number, ys: number[]): ShapePart[] => ys.map((y) => line([x1, y], [x2, y]));
/** Evenly spread upright lines at each x from y1 to y2. */
const grooves = (xs: number[], y1: number, y2: number): ShapePart[] => xs.map((x) => line([x, y1], [x, y2]));

const mirrorPt = ([x, y]: Pt): Pt => [1 - x, y];
/** The same picture the other way round (a left drainboard from a right one). */
const mirror = (parts: ShapePart[]): ShapePart[] => parts.map((part) => {
  if (part.k === 'poly') return { ...part, pts: part.pts.map(mirrorPt) };
  if (part.k === 'circle' || part.k === 'plus') return { ...part, at: mirrorPt(part.at) };
  if (part.k === 'line') return { ...part, a: mirrorPt(part.a), b: mirrorPt(part.b) };
  return part;
});

/** An outline whose top-right is stepped down, for the 60/40 sinks. */
const stepped = (stepX: number, stepY: number, r: number): ShapePart => ({
  k: 'poly', r, pts: [[0, 0], [stepX, 0], [stepX, stepY], [1, stepY], [1, 1], [0, 1]],
});

/** A curve drawn in its own 0..1 box, shrunk into the (x, y, w, h) part of the opening. */
const curve = (segs: Seg[], x: number, y: number, w: number, h: number): ShapePart => {
  const at = ([u, v]: Pt): Pt => [x + u * w, y + v * h];
  return {
    k: 'curve',
    segs: segs.map((seg): Seg => {
      if (seg[0] === 'M' || seg[0] === 'L') return [seg[0], at(seg[1])];
      if (seg[0] === 'C') return ['C', at(seg[1]), at(seg[2]), at(seg[3])];
      return ['Z'];
    }),
  };
};

const DRAIN_ROW_YS = [0.19, 0.32, 0.46, 0.6, 0.74];

// ── sinks ───────────────────────────────────────────────────────────────────

const rightDrainboard: ShapePart[] = [
  rect(0, 0, 1, 1, 0.08), rect(0.07, 0.19, 0.61, 0.55, 0.1), drain(0.37, 0.46),
];
const rightGrooved = [...rightDrainboard, ...grooves([0.76, 0.82, 0.88, 0.94], 0.19, 0.74)];
const rightFlat = [...rightDrainboard, ...flatLines(0.74, 0.93, DRAIN_ROW_YS)];
const rightWide: ShapePart[] = [
  rect(0, 0, 1, 1, 0.08), rect(0.07, 0.28, 0.4, 0.46, 0.1), drain(0.27, 0.51),
  ...flatLines(0.53, 0.9, [0.27, 0.39, 0.51, 0.62, 0.74]),
];
const doubleRight: ShapePart[] = [
  rect(0, 0, 1, 1, 0.07),
  rect(0.06, 0.22, 0.3, 0.6, 0.1), rect(0.4, 0.22, 0.3, 0.6, 0.1),
  drain(0.21, 0.52), drain(0.55, 0.52),
  ...grooves([0.76, 0.82, 0.88, 0.94], 0.22, 0.82),
];

const sink = (code: string, name: string, length: number, height: number, parts: ShapePart[]): CutoutShapeDef => ({
  code: `sink.${code}`, name, type: 'sink', tab: 'rectangle', geometry: 'rect', sizeIn: { length, height }, parts,
});

export const SINK_SHAPES: CutoutShapeDef[] = [
  sink('farmhouse', 'Farmhouse', 36, 18, [
    rect(0, 0, 1, 1, 0.05), rect(0.06, 0.06, 0.88, 0.86, 0.01),
    line([0.06, 0.06], [0.94, 0.92]), line([0.94, 0.06], [0.06, 0.92]),
    { k: 'circle', at: [0.5, 0.49], r: 0.08 },
  ]),
  sink('double-bowl-60-40', 'Double bowl 60/40', 42, 20, [
    stepped(0.58, 0.19, 0.1), rect(0.06, 0.11, 0.48, 0.78, 0.09), rect(0.6, 0.3, 0.3, 0.59, 0.09),
    drain(0.3, 0.49), drain(0.75, 0.6),
  ]),
  sink('double-bowl-70-30', 'Double bowl 70/30', 46, 20, [
    stepped(0.54, 0.19, 0.1), rect(0.06, 0.11, 0.44, 0.78, 0.09), rect(0.55, 0.3, 0.39, 0.59, 0.09),
    drain(0.28, 0.49), drain(0.75, 0.6),
  ]),
  sink('double-bowl-rectangle', 'Double bowl rectangle', 36, 18, [
    rect(0, 0, 1, 1, 0.07), rect(0.02, 0.04, 0.96, 0.92, 0.06),
    rect(0.07, 0.18, 0.4, 0.66, 0.08), rect(0.09, 0.22, 0.36, 0.58, 0.06),
    rect(0.53, 0.18, 0.4, 0.66, 0.08), rect(0.55, 0.22, 0.36, 0.58, 0.06),
    drain(0.27, 0.52), drain(0.73, 0.52), drain(0.5, 0.05, 0.025),
  ]),
  sink('double-bowl', 'Double bowl', 36, 18, [
    rect(0, 0, 1, 1, 0.07), rect(0.06, 0.1, 0.43, 0.8, 0.1), rect(0.51, 0.1, 0.43, 0.8, 0.1),
    drain(0.27, 0.5), drain(0.73, 0.5),
  ]),
  sink('bar', 'Bar', 15, 15, [
    rect(0, 0, 1, 1, 0.18), rect(0.12, 0.12, 0.76, 0.76, 0.14), drain(0.5, 0.5, 0.06),
  ]),
  sink('single-bowl-rectangle', 'Single bowl rectangle', 24, 20, [
    rect(0, 0, 1, 1, 0.08), rect(0.1, 0.25, 0.8, 0.55, 0.06), drain(0.5, 0.64, 0.05),
  ]),
  sink('vanity', 'Vanity', 30, 16, [
    rect(0, 0, 1, 1, 0.07), rect(0.02, 0.05, 0.96, 0.9, 0.06), rect(0.04, 0.12, 0.92, 0.76, 0.05),
    { k: 'circle', at: [0.5, 0.17], r: 0.07 }, drain(0.5, 0.88, 0.025),
  ]),
  sink('rectangle', 'Rectangle', 32, 20, [
    rect(0, 0, 1, 1, 0.08), rect(0.06, 0.12, 0.4, 0.76, 0.1), rect(0.54, 0.12, 0.4, 0.76, 0.1),
    drain(0.26, 0.5), drain(0.74, 0.5),
  ]),
  sink('single-bowl-right-drainboard', 'Single bowl, right drainboard', 32, 20, rightFlat),
  sink('single-bowl-right-drainboard-grooved', 'Single bowl, right drainboard (grooved)', 32, 20, rightGrooved),
  sink('single-bowl-wide-drainboard', 'Single bowl, wide drainboard', 32, 20, rightWide),
  sink('single-bowl-left-drainboard', 'Single bowl, left drainboard', 32, 20, mirror(rightFlat)),
  sink('single-bowl-left-drainboard-grooved', 'Single bowl, left drainboard (grooved)', 32, 20, mirror(rightGrooved)),
  sink('single-bowl-wide-left-drainboard', 'Single bowl, wide left drainboard', 32, 20, mirror(rightWide)),
  sink('double-bowl-left-drainboard-grooved', 'Double bowl, left drainboard (grooved)', 48, 20, mirror(doubleRight)),
  sink('double-bowl-right-drainboard-grooved', 'Double bowl, right drainboard (grooved)', 48, 20, doubleRight),
  sink('double-bowl-center-drainboard', 'Double bowl, center drainboard', 48, 20, [
    rect(0, 0, 1, 1, 0.07), rect(0.06, 0.2, 0.28, 0.62, 0.1), rect(0.64, 0.2, 0.28, 0.62, 0.1),
    drain(0.2, 0.51), drain(0.78, 0.51), ...grooves([0.4, 0.46, 0.52, 0.58], 0.2, 0.82),
  ]),
  sink('triple-bowl', 'Triple bowl', 48, 20, [
    rect(0, 0, 1, 1, 0.07), rect(0.05, 0.15, 0.27, 0.7, 0.1), rect(0.365, 0.15, 0.27, 0.7, 0.1), rect(0.68, 0.15, 0.27, 0.7, 0.1),
    drain(0.185, 0.5), drain(0.5, 0.5), drain(0.815, 0.5),
  ]),
  sink('single-bowl-large', 'Single bowl large', 26, 20, [
    rect(0, 0, 1, 1, 0.08), rect(0.1, 0.22, 0.8, 0.58, 0.06), drain(0.5, 0.52, 0.05),
  ]),
];

// ── cooktop ─────────────────────────────────────────────────────────────────

/** One burner: a ring, a smaller ring and a centre dot. */
const burner = (x: number, y: number): ShapePart[] => [
  { k: 'circle', at: [x, y], r: 0.13 }, { k: 'circle', at: [x, y], r: 0.085 }, { k: 'circle', at: [x, y], r: 0.03 },
];

export const COOKTOP_SHAPES: CutoutShapeDef[] = [{
  code: 'cooktop.rectangle', name: 'Rectangle', type: 'cooktop', tab: 'rectangle', geometry: 'rect',
  sizeIn: { length: 36, height: 20 },
  parts: [
    rect(0, 0, 1, 1, 0.06),
    ...burner(0.19, 0.28), ...burner(0.76, 0.28), ...burner(0.48, 0.52), ...burner(0.19, 0.76), ...burner(0.76, 0.76),
    drain(0.45, 0.88, 0.012), drain(0.51, 0.88, 0.012), drain(0.48, 0.92, 0.012),
  ],
}];

// ── fireplace ───────────────────────────────────────────────────────────────

/** A flame, three tongues rising from a rounded base, in its own 0..1 box. */
const FLAME: Seg[] = [
  ['M', [0.5, 0.97]],
  ['C', [0.22, 0.97], [0.04, 0.82], [0.05, 0.62]],
  ['C', [0.06, 0.5], [0.18, 0.46], [0.22, 0.36]],
  ['C', [0.24, 0.22], [0.3, 0.1], [0.4, 0.03]],
  ['C', [0.4, 0.18], [0.5, 0.28], [0.56, 0.36]],
  ['C', [0.6, 0.42], [0.62, 0.48], [0.6, 0.54]],
  ['C', [0.66, 0.48], [0.72, 0.4], [0.74, 0.3]],
  ['C', [0.84, 0.38], [0.94, 0.52], [0.94, 0.66]],
  ['C', [0.94, 0.84], [0.78, 0.97], [0.5, 0.97]],
  ['Z'],
];
const FLAME_INNER: Seg[] = [
  ['M', [0.3, 0.64]],
  ['C', [0.24, 0.56], [0.26, 0.46], [0.32, 0.38]],
  ['C', [0.34, 0.48], [0.4, 0.54], [0.38, 0.64]],
  ['Z'],
];
const flame = (): ShapePart[] => [curve(FLAME, 0.2, 0.18, 0.6, 0.72), curve(FLAME_INNER, 0.2, 0.18, 0.6, 0.72)];

const fireplace = (tab: ShapeTab, name: string): CutoutShapeDef => ({
  code: `fireplace.${tab}`, name, type: 'fireplace', tab, geometry: SHAPE_TABS[tab].geometry,
  sizeIn: { length: 36, height: 30 }, parts: tab === 'rectangle' ? [rect(0, 0, 1, 1, 0.03), ...flame()] : flame(),
});

export const FIREPLACE_SHAPES: CutoutShapeDef[] = [fireplace('arc', 'Arc'), fireplace('rectangle', 'Rectangle')];

// ── bathtub ─────────────────────────────────────────────────────────────────

/** The drain: a ring with a plus in it. */
const plusDrain = (x: number, y: number, r: number): ShapePart[] => [
  { k: 'circle', at: [x, y], r }, { k: 'plus', at: [x, y], r },
];

export const BATHTUB_SHAPES: CutoutShapeDef[] = [
  {
    code: 'bathtub.oval', name: 'Oval', type: 'bathtub', tab: 'ellipse', geometry: 'stadium', sizeIn: { length: 60, height: 32 },
    parts: [rect(0.03, 0.07, 0.94, 0.86, 0.5), rect(0.07, 0.17, 0.86, 0.66, 0.5), ...plusDrain(0.5, 0.5, 0.035)],
  },
  {
    code: 'bathtub.rectangle', name: 'Rectangle', type: 'bathtub', tab: 'rectangle', geometry: 'rect', sizeIn: { length: 60, height: 30 },
    parts: [rect(0, 0, 1, 1, 0.06), ...plusDrain(0.5, 0.5, 0.045)],
  },
];

// ── lookup ──────────────────────────────────────────────────────────────────

const SHAPES_BY_TYPE: Partial<Record<CutoutType, CutoutShapeDef[]>> = {
  sink: SINK_SHAPES, cooktop: COOKTOP_SHAPES, fireplace: FIREPLACE_SHAPES, bathtub: BATHTUB_SHAPES,
};
const ALL_SHAPES: CutoutShapeDef[] = Object.values(SHAPES_BY_TYPE).flat();

/** Every picture a type offers, across its tabs. */
export const shapesForType = (type: CutoutType): CutoutShapeDef[] => SHAPES_BY_TYPE[type] ?? [];

/** The pictures on one tab of a type. */
export const shapesForTab = (type: CutoutType, tab: ShapeTab): CutoutShapeDef[] =>
  shapesForType(type).filter((s) => s.tab === tab);

export function findShape(code: string | undefined): CutoutShapeDef | undefined {
  return code ? ALL_SHAPES.find((s) => s.code === code) : undefined;
}

/** The length x height a shape starts at, in mm. */
export const shapeSizeMm = (shape: CutoutShapeDef): { lengthMm: number; heightMm: number } => ({
  lengthMm: shape.sizeIn.length * MM_PER_INCH,
  heightMm: shape.sizeIn.height * MM_PER_INCH,
});

// ── turning a recipe into something drawable ────────────────────────────────

export interface ShapeDrawing {
  /** SVG path data, one per outline (rim, bowls, flame). */
  paths: string[];
  circles: Array<{ cx: number; cy: number; r: number }>;
  lines: Array<{ x1: number; y1: number; x2: number; y2: number }>;
}

const round = (n: number): number => Math.round(n * 1000) / 1000;

/** A closed path through `pts` with each corner rounded by `radius` — a quadratic
 *  curve through the corner, which also suits the concave step corners. */
function roundedPath(pts: Point[], radius: number): string {
  const n = pts.length;
  const corner = (i: number) => {
    const p = pts[i];
    const prev = pts[(i - 1 + n) % n];
    const next = pts[(i + 1) % n];
    const toPrev = Math.hypot(prev.x - p.x, prev.y - p.y) || 1;
    const toNext = Math.hypot(next.x - p.x, next.y - p.y) || 1;
    const t = Math.min(radius, toPrev / 2, toNext / 2);
    return {
      p,
      entry: { x: p.x + ((prev.x - p.x) / toPrev) * t, y: p.y + ((prev.y - p.y) / toPrev) * t },
      exit: { x: p.x + ((next.x - p.x) / toNext) * t, y: p.y + ((next.y - p.y) / toNext) * t },
    };
  };
  const fmt = (q: Point) => `${round(q.x)} ${round(q.y)}`;
  const corners = Array.from({ length: n }, (_, i) => corner(i));
  const [first, ...rest] = corners;
  const steps = [...rest, first].map((c) => `L ${fmt(c.entry)} Q ${fmt(c.p)} ${fmt(c.exit)}`);
  return `M ${fmt(first.exit)} ${steps.join(' ')} Z`;
}

/** The picture for `cutout` (it must carry a known `shapeCode`), in the piece's
 *  local coordinates, y up — at the cutout's own size, centre and rotation. */
export function buildShapeDrawing(cutout: Cutout): ShapeDrawing | null {
  const shape = findShape(cutout.shapeCode);
  if (!shape) return null;
  const { lengthMm, heightMm } = cutoutSize(cutout);
  if (lengthMm <= 0 || heightMm <= 0) return null;
  const rotation = cutout.rotationDeg ?? 0;
  const unit = Math.min(lengthMm, heightMm);
  const local = ([u, v]: Pt): Point => {
    const r = rotatePoint({ x: (u - 0.5) * lengthMm, y: (0.5 - v) * heightMm }, rotation);
    return { x: r.x + cutout.center.x, y: r.y + cutout.center.y };
  };
  const fmt = (pt: Pt) => {
    const p = local(pt);
    return `${round(p.x)} ${round(p.y)}`;
  };
  const drawing: ShapeDrawing = { paths: [], circles: [], lines: [] };
  for (const part of shape.parts) {
    if (part.k === 'poly') {
      drawing.paths.push(roundedPath(part.pts.map(local), part.r * unit));
    } else if (part.k === 'curve') {
      drawing.paths.push(part.segs.map((seg) => (
        seg[0] === 'Z' ? 'Z' : `${seg[0]} ${seg.slice(1).map((pt) => fmt(pt as Pt)).join(' ')}`
      )).join(' '));
    } else if (part.k === 'circle') {
      const c = local(part.at);
      drawing.circles.push({ cx: round(c.x), cy: round(c.y), r: round(part.r * unit) });
    } else if (part.k === 'plus') {
      // Two short lines crossing at `at`, each as long as the ring is wide.
      const c = local(part.at);
      const arm = part.r * unit;
      const [dx, dy] = [rotatePoint({ x: arm, y: 0 }, rotation), rotatePoint({ x: 0, y: arm }, rotation)];
      drawing.lines.push(
        { x1: round(c.x - dx.x), y1: round(c.y - dx.y), x2: round(c.x + dx.x), y2: round(c.y + dx.y) },
        { x1: round(c.x - dy.x), y1: round(c.y - dy.y), x2: round(c.x + dy.x), y2: round(c.y + dy.y) },
      );
    } else {
      const a = local(part.a);
      const b = local(part.b);
      drawing.lines.push({ x1: round(a.x), y1: round(a.y), x2: round(b.x), y2: round(b.y) });
    }
  }
  return drawing;
}
