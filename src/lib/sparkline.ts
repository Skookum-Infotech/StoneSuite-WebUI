// Pure geometry for the KPI strip's sparkline. The component stays dumb: it
// takes these three strings and renders <polyline> / <path> / <circle>, so the
// coordinate math is unit-testable on its own.

const DEFAULT_WIDTH = 78;
const DEFAULT_HEIGHT = 26;
const STROKE_PAD = 2; // keeps the 1.8px stroke and the end dot off the edges
const MIN_POINTS_FOR_AREA = 2;

export interface SparklineGeometry {
  /** `points` attribute for a <polyline> — "x,y x,y …" (empty when no data). */
  line: string;
  /** `d` attribute for the filled area under the line (empty for <2 points). */
  area: string;
  /** The final data point, for the "you are here" dot (null when no data). */
  last: { x: number; y: number } | null;
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}

export function sparklineGeometry(
  points: number[],
  opts: { width?: number; height?: number } = {},
): SparklineGeometry {
  if (points.length === 0) return { line: '', area: '', last: null };

  const width = opts.width ?? DEFAULT_WIDTH;
  const height = opts.height ?? DEFAULT_HEIGHT;
  const top = STROKE_PAD;
  const bottom = height - STROKE_PAD;
  const span = bottom - top;

  const min = Math.min(...points);
  const max = Math.max(...points);
  const flat = max === min;
  const range = flat ? 1 : max - min;

  const coords = points.map((value, i) => {
    const x = points.length === 1 ? width / 2 : (i / (points.length - 1)) * width;
    const y = flat ? top + span / 2 : bottom - ((value - min) / range) * span;
    return { x: round(x), y: round(y) };
  });

  const line = coords.map((c) => `${c.x},${c.y}`).join(' ');
  const last = coords[coords.length - 1];

  let area = '';
  if (coords.length >= MIN_POINTS_FOR_AREA) {
    const first = coords[0];
    const body = coords.map((c) => `L ${c.x},${c.y}`).join(' ');
    area = `M ${first.x},${bottom} ${body} L ${last.x},${bottom} Z`;
  }

  return { line, area, last };
}
