// The Cutout dialog's "Distance Lines" control: for each side of the opening,
// pick whether its distance to the piece's edge is measured from the opening's
// centre, from its border, or not shown. A small sketch in the middle draws
// the lines the way they will read.

import type { DistanceLineMode, DistanceLines } from '@/types/drawing';

type Side = keyof DistanceLines;

const MODES: Array<{ id: DistanceLineMode; label: string }> = [
  { id: 'center', label: 'Center' },
  { id: 'border', label: 'Border' },
  { id: 'hidden', label: 'Hidden' },
];

const SIDE_LABEL: Record<Side, string> = { top: 'Top', right: 'Right', bottom: 'Bottom', left: 'Left' };

function Modes({ side, value, onChange }: { side: Side; value: DistanceLineMode; onChange: (mode: DistanceLineMode) => void }) {
  const vertical = side === 'left' || side === 'right';
  return (
    <div
      role="radiogroup"
      aria-label={`${SIDE_LABEL[side]} distance line`}
      className={`flex overflow-hidden rounded border border-stone-300 text-2xs ${vertical ? 'w-16 flex-col' : ''}`}
    >
      {MODES.map(({ id, label }) => (
        <button
          key={id}
          type="button"
          role="radio"
          aria-checked={value === id}
          onClick={() => onChange(id)}
          className={`px-2 py-1 ${vertical ? '' : 'flex-1'} ${value === id ? 'bg-brand font-medium text-stone-900' : 'bg-white text-stone-600 hover:bg-stone-100'}`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

// Sketch geometry: the piece, with the opening sitting inside it.
const BOX = { w: 180, h: 110 };
const HOLE = { x: 62, y: 32, w: 60, h: 40 };
const CENTER = { x: HOLE.x + HOLE.w / 2, y: HOLE.y + HOLE.h / 2 };

/** The line for one side as [x1, y1, x2, y2], or null when hidden. */
function lineFor(side: Side, mode: DistanceLineMode): [number, number, number, number] | null {
  if (mode === 'hidden') return null;
  const centered = mode === 'center';
  switch (side) {
    case 'left': return [0, CENTER.y, centered ? CENTER.x : HOLE.x, CENTER.y];
    case 'right': return [BOX.w, CENTER.y, centered ? CENTER.x : HOLE.x + HOLE.w, CENTER.y];
    case 'top': return [CENTER.x, 0, CENTER.x, centered ? CENTER.y : HOLE.y];
    default: return [CENTER.x, BOX.h, CENTER.x, centered ? CENTER.y : HOLE.y + HOLE.h];
  }
}

export function DistanceLinesPicker({ value, onChange }: { value: DistanceLines; onChange: (next: DistanceLines) => void }) {
  const set = (side: Side) => (mode: DistanceLineMode) => onChange({ ...value, [side]: mode });

  return (
    <div className="flex flex-col items-center gap-2">
      <Modes side="top" value={value.top} onChange={set('top')} />
      <div className="flex items-center gap-2">
        <Modes side="left" value={value.left} onChange={set('left')} />
        <svg viewBox={`0 0 ${BOX.w} ${BOX.h}`} className="h-28 w-44 rounded border border-stone-300 bg-stone-50" role="img" aria-label="Distance lines preview">
          <rect x={HOLE.x} y={HOLE.y} width={HOLE.w} height={HOLE.h} rx={5} className="fill-white stroke-stone-400" />
          {/* After the opening, so a line to its centre is seen crossing it
              rather than appearing to stop at its border. */}
          {(Object.keys(SIDE_LABEL) as Side[]).map((side) => {
            const line = lineFor(side, value[side]);
            return line && (
              <g key={side}>
                <line x1={line[0]} y1={line[1]} x2={line[2]} y2={line[3]} className="stroke-red-500" strokeWidth={3} />
                <circle cx={line[2]} cy={line[3]} r={3.5} className="fill-red-500" />
              </g>
            );
          })}
        </svg>
        <Modes side="right" value={value.right} onChange={set('right')} />
      </div>
      <Modes side="bottom" value={value.bottom} onChange={set('bottom')} />
    </div>
  );
}
