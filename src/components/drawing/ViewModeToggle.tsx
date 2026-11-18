// The 2D | 3D switch floating at the top-right of the board. It is not a tool: it does not
// live in the tool rail, and changing it never touches the drawing.

import { cn } from '@/lib/utils';

export type ViewMode = '2d' | '3d';

const OPTIONS: ReadonlyArray<{ id: ViewMode; label: string }> = [
  { id: '2d', label: '2D' },
  { id: '3d', label: '3D' },
];

export function ViewModeToggle({ mode, onChange }: { mode: ViewMode; onChange: (mode: ViewMode) => void }) {
  return (
    <div
      role="group"
      aria-label="Drawing view"
      className="absolute right-3 top-3 z-50 flex rounded-full border border-stone-200 bg-white p-0.5 shadow-md"
    >
      {OPTIONS.map(({ id, label }) => (
        <button
          key={id}
          type="button"
          aria-label={`${label} view`}
          aria-pressed={mode === id}
          onClick={() => onChange(id)}
          className={cn(
            'rounded-full px-3 py-1 text-xs font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-lime-500',
            mode === id ? 'bg-stone-900 text-lime-300' : 'text-stone-600 hover:bg-stone-100',
          )}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
