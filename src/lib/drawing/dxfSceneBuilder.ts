// Collects placed shapes into a DxfScene, and is where the limits on what an
// untrusted file can make the page draw are enforced.

import { applyMatrix, matrixRotationDeg, matrixScale, type Matrix, type Pt } from './dxfTransform';
import { DxfTooComplexError, type DxfBounds, type DxfPath, type DxfScene, type DxfText } from './dxfSceneTypes';

/** Points + texts + block expansions; beyond this the page itself would struggle. */
const MAX_SCENE_ELEMENTS = 200_000;
/** Each text is its own SVG node, far heavier than a point in a shared path. */
const MAX_SCENE_TEXTS = 20_000;
const MAX_TEXT_LENGTH = 2_000;
const COORDINATE_DECIMALS = 4;

const round = (n: number) => Number(n.toFixed(COORDINATE_DECIMALS));

export const isFinitePoint = (p: Pt | undefined): p is Pt => p !== undefined && Number.isFinite(p.x) && Number.isFinite(p.y);

type PathStyle = { dashed: boolean; filled?: boolean; closed?: boolean; alreadySpent?: boolean };

export class SceneBuilder {
  private readonly segments = new Map<string, Omit<DxfPath, 'd'> & { parts: string[] }>();
  private readonly texts: DxfText[] = [];
  private readonly unsupported: Record<string, number> = {};
  private readonly bounds: DxfBounds = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
  private spent = 0;

  spend(amount: number) {
    this.spent += amount;
    if (this.spent > MAX_SCENE_ELEMENTS) throw new DxfTooComplexError();
  }

  count(type: string, amount = 1) {
    this.unsupported[type] = (this.unsupported[type] ?? 0) + amount;
  }

  private grow(x: number, y: number) {
    this.bounds.minX = Math.min(this.bounds.minX, x);
    this.bounds.minY = Math.min(this.bounds.minY, y);
    this.bounds.maxX = Math.max(this.bounds.maxX, x);
    this.bounds.maxY = Math.max(this.bounds.maxY, y);
  }

  /** False when the shape can't be drawn: too few points, or a coordinate that
   *  isn't a real number after placing. Shapes of one style share a `d` and SVG
   *  stops at its first bad token, so one NaN would erase everything after it. */
  addPath(points: Pt[], m: Matrix, style: PathStyle): boolean {
    if (points.length < 2 || !points.every(isFinitePoint)) return false;
    if (!style.alreadySpent) this.spend(points.length);
    const placed = points.map((p) => applyMatrix(m, p));
    if (!placed.every(isFinitePoint)) return false;

    const filled = style.filled ?? false;
    const screen = placed.map((p) => {
      const x = round(p.x);
      const y = round(-p.y);
      this.grow(x, y);
      return `${x} ${y}`;
    });
    const key = `${style.dashed}|${filled}`;
    const bucket = this.segments.get(key) ?? { dashed: style.dashed, filled, parts: [] };
    bucket.parts.push(`M${screen.join('L')}${style.closed ? 'Z' : ''}`);
    this.segments.set(key, bucket);
    return true;
  }

  /** False when the text can't be placed. An empty text simply has nothing to draw. */
  addText(text: string, at: Pt, m: Matrix, style: Pick<DxfText, 'height' | 'rotationDeg' | 'anchor' | 'baseline'>): boolean {
    if (!text) return true;
    if (!isFinitePoint(at)) return false;
    const placed = applyMatrix(m, at);
    const height = style.height * matrixScale(m);
    const rotationDeg = style.rotationDeg + matrixRotationDeg(m);
    if (!isFinitePoint(placed) || !Number.isFinite(height) || !Number.isFinite(rotationDeg)) return false;

    this.spend(1);
    if (this.texts.length >= MAX_SCENE_TEXTS) throw new DxfTooComplexError();
    const x = round(placed.x);
    const y = round(-placed.y);
    this.grow(x, y);
    this.texts.push({
      ...style,
      text: text.length > MAX_TEXT_LENGTH ? `${text.slice(0, MAX_TEXT_LENGTH)}…` : text,
      x,
      y,
      height,
      rotationDeg,
    });
    return true;
  }

  build(): DxfScene {
    const hasBounds = Number.isFinite(this.bounds.minX);
    return {
      paths: [...this.segments.values()].map(({ dashed, filled, parts }) => ({ dashed, filled, d: parts.join('') })),
      texts: this.texts,
      bounds: hasBounds ? this.bounds : { minX: 0, minY: 0, maxX: 0, maxY: 0 },
      unsupported: this.unsupported,
    };
  }
}
