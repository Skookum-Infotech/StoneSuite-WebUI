// The Properties panel, floating over the right side of the board. It used
// to pop open on its own the moment a piece was clicked and close again on
// deselect — which the user found it popping up uninvited and taking space
// they hadn't asked for. It's now purely a toggle (the bottom bar's own
// Properties button), the same as Dimensions and Map: selecting a piece
// never opens or closes it, only changes what it shows while it's open.

import { PieceInspector } from './PieceInspector';
import { useDrawingEditor } from './DrawingEditorContext';

export function InspectorPanel() {
  const { propertiesOpen } = useDrawingEditor();

  if (!propertiesOpen) return null;

  return (
    <aside
      aria-label="Properties"
      className="modal-scrollbar absolute right-3 top-14 z-20 max-h-[calc(100%-12rem)] w-72 overflow-y-auto overflow-x-hidden rounded-lg border border-stone-200 bg-white p-3 shadow-lg"
    >
      <PieceInspector />
    </aside>
  );
}
