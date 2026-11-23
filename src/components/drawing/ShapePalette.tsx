// Left-panel "Shapes" section: the tools that add a countertop piece to the
// active area — rectangle, L, U, island, peninsula, or a hand-drawn polygon.

import { useState } from 'react';
import { AddNotchedForm, AddRectangleForm } from './AddPieceForms';
import { useDrawingEditor } from './DrawingEditorContext';
import { PanelSection } from './PanelSection';

type AddTool = 'none' | 'rect' | 'L' | 'U' | 'island' | 'peninsula';

const BUTTON_CLASS = 'rounded border border-stone-200 px-2 py-1 text-left text-xs aria-pressed:border-brand aria-pressed:bg-brand/10';

export function ShapePalette({ bare }: { bare?: boolean } = {}) {
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
    <PanelSection title="Shapes" bare={bare}>
      <div className="grid grid-cols-2 gap-1.5">
      {button('rect', 'Add rectangle')}
      {button('L', 'Add L-shape')}
      {button('U', 'Add U-shape')}
      {button('island', 'Add island')}
      {button('peninsula', 'Add peninsula')}
      <button
        type="button"
        onClick={() => setTool(tool === 'polygon' ? 'select' : 'polygon')}
        aria-pressed={tool === 'polygon'}
        aria-label="Add polygon"
        className={BUTTON_CLASS}
      >
        Add polygon
      </button>
      </div>
      {addTool === 'rect' && <AddRectangleForm onDone={done} />}
      {addTool === 'L' && <AddNotchedForm shape="L" onDone={done} />}
      {addTool === 'U' && <AddNotchedForm shape="U" onDone={done} />}
      {addTool === 'island' && <AddRectangleForm kind="island" onDone={done} />}
      {addTool === 'peninsula' && <AddRectangleForm kind="peninsula" onDone={done} />}
    </PanelSection>
  );
}
