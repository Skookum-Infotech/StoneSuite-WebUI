// The strip at the bottom centre of the canvas while the Draw tool is armed:
// which kind of shape a click draws. Only Square works so far — Circle and
// Points are shown so the bar looks like its final self, and stay disabled
// until they are built.

import { useDrawingEditor } from './DrawingEditorContext';

interface ModeDef {
  id: 'square' | 'circle' | 'points';
  label: string;
  enabled: boolean;
}

const MODES: ModeDef[] = [
  { id: 'square', label: 'Square', enabled: true },
  { id: 'circle', label: 'Circle', enabled: false },
  { id: 'points', label: 'Points', enabled: false },
];

const MODE_BUTTON_CLASS = 'rounded px-3 py-1.5 text-xs font-medium text-stone-200 enabled:hover:bg-stone-700 disabled:cursor-not-allowed disabled:text-stone-500 aria-pressed:bg-brand aria-pressed:text-stone-900';

export function DrawModeBar() {
  const { tool } = useDrawingEditor();
  if (tool !== 'draw') return null;
  return (
    <div
      role="group"
      aria-label="Draw mode"
      className="pointer-events-auto absolute bottom-12 left-1/2 z-10 flex -translate-x-1/2 flex-col gap-1.5 rounded-lg bg-stone-900 px-3 py-2 shadow-lg"
    >
      <h3 className="text-sm font-semibold text-white">Draw</h3>
      <div className="flex gap-1 rounded-md border border-stone-700 p-0.5">
        {MODES.map(({ id, label, enabled }) => (
          <button
            key={id}
            type="button"
            aria-label={label}
            aria-pressed={id === 'square'}
            disabled={!enabled}
            title={enabled ? undefined : 'Coming soon'}
            className={MODE_BUTTON_CLASS}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}
