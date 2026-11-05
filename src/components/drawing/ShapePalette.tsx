// Left-panel "Shapes" section: the tools that add a countertop piece to the
// active area — rectangle, L, U, island, peninsula, or a hand-drawn polygon.

import { useState } from 'react';
import { AddNotchedForm, AddRectangleForm } from './AddPieceForms';
import { useDrawingEditor } from './DrawingEditorContext';

type AddTool = 'none' | 'rect' | 'L' | 'U' | 'island' | 'peninsula';

const BUTTON_CLASS = 'rounded border border-stone-200 px-2 py-1 text-left text-xs aria-pressed:border-brand aria-pressed:bg-brand/10';

export function ShapePalette() {
  const { tool, setTool } = useDrawingEditor();
  const [addTool, setAddTool] = useState<AddTool>('none');
  const toggle = (next: AddTool) => setAddTool((current) => (current === next ? 'none' : next));
  const done = () => setAddTool('none');

  const button = (next: AddTool, label: string) => (
    <button type="button" onClick={() => toggle(next)} aria-pressed={addTool === next} className={BUTTON_CLASS}>
      {label}
    </button>
  );

  return (
    <section aria-label="Shapes" className="flex flex-col gap-1.5">
      <h3 className="text-2xs font-semibold uppercase tracking-wide text-stone-500">Shapes</h3>
      {button('rect', 'Add rectangle')}
      {addTool === 'rect' && <AddRectangleForm onDone={done} />}
      {button('L', 'Add L-shape')}
      {addTool === 'L' && <AddNotchedForm shape="L" onDone={done} />}
      {button('U', 'Add U-shape')}
      {addTool === 'U' && <AddNotchedForm shape="U" onDone={done} />}
      {button('island', 'Add island')}
      {addTool === 'island' && <AddRectangleForm kind="island" onDone={done} />}
      {button('peninsula', 'Add peninsula')}
      {addTool === 'peninsula' && <AddRectangleForm kind="peninsula" onDone={done} />}
      <button
        type="button"
        onClick={() => setTool(tool === 'polygon' ? 'select' : 'polygon')}
        aria-pressed={tool === 'polygon'}
        aria-label="Add polygon"
        className={BUTTON_CLASS}
      >
        Add polygon
      </button>
    </section>
  );
}
