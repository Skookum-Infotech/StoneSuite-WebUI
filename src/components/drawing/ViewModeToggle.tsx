// The one button that flips the board between 2D and 3D, floating at the top-left. It shows the
// view it will switch to: "3D" while you are in 2D, "2D" while you are in 3D. It is not a tool,
// so it does not live in the tool rail, and changing the view never touches the drawing.

import { Box, PencilRuler } from 'lucide-react';

export type ViewMode = '2d' | '3d';

export function ViewModeToggle({ mode, onChange }: { mode: ViewMode; onChange: (mode: ViewMode) => void }) {
  const next: ViewMode = mode === '2d' ? '3d' : '2d';
  const label = next === '3d' ? '3D' : '2D';
  const Icon = next === '3d' ? Box : PencilRuler;

  return (
    <button
      type="button"
      aria-label={`Switch to ${label} view`}
      title={`Switch to ${label} view`}
      onClick={() => onChange(next)}
      className="flex h-12 w-12 flex-col items-center justify-center rounded-2xl bg-stone-900 text-lime-300 shadow-lg hover:bg-stone-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand"
    >
      <Icon className="size-4" strokeWidth={1.75} aria-hidden="true" />
      <span className="text-micro font-semibold leading-none">{label}</span>
    </button>
  );
}
