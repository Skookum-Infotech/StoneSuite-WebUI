// The strip at the bottom centre of the canvas while the Draw tool is armed:
// which kind of shape a click draws. Square and Circle stay armed so the
// next canvas click drops one (Circle needs its radius set first, via the
// form below); Points leaves the Draw tool entirely for the editor's own
// point-by-point polygon tool (DrawingCanvas's `tool === 'polygon'`), so
// this bar unmounts the moment it's picked — there's nothing left here to
// show while drafting one.

import { CircleForm } from './CircleForm';
import { useDrawingEditor } from './DrawingEditorContext';
import type { DrawShape } from './useDrawToolState';

const MODE_BUTTON_CLASS = 'rounded px-3 py-1.5 text-xs font-medium text-stone-200 hover:bg-stone-700 aria-pressed:bg-brand aria-pressed:text-stone-900';

export function DrawModeBar() {
  const { tool, setTool, draw } = useDrawingEditor();
  if (tool !== 'draw') return null;

  const shapeButton = (id: DrawShape, label: string) => (
    <button
      type="button"
      aria-label={label}
      aria-pressed={draw.shape === id}
      onClick={() => draw.setShape(id)}
      className={MODE_BUTTON_CLASS}
    >
      {label}
    </button>
  );

  return (
    <div
      role="group"
      aria-label="Draw mode"
      className="pointer-events-auto absolute bottom-3 left-1/2 z-10 flex -translate-x-1/2 flex-col gap-1.5 rounded-lg bg-stone-900 px-3 py-2 shadow-lg"
    >
      <h3 className="text-sm font-semibold text-white">Draw</h3>
      <div className="flex gap-1 rounded-md border border-stone-700 p-0.5">
        {shapeButton('square', 'Square')}
        {shapeButton('circle', 'Circle')}
        <button
          type="button"
          aria-label="Points"
          onClick={() => setTool('polygon')}
          className={MODE_BUTTON_CLASS}
        >
          Points
        </button>
      </div>
      {draw.shape === 'circle' && <CircleForm />}
    </div>
  );
}
