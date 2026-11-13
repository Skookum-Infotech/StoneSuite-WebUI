// The Properties panel, floating over the right side of the board only while
// something is selected. It used to be a permanent column beside the board,
// mostly saying "No piece selected." and taking a fifth of the width from
// the drawing; floating, it also leaves the board's size alone, so the
// drawing does not jump sideways each time a piece is clicked.

import { useEffect, useRef } from 'react';
import { PieceInspector } from './PieceInspector';
import { useDrawingEditor } from './DrawingEditorContext';

export function InspectorPanel() {
  const { state } = useDrawingEditor();
  const open = state.selectedPieceIds.length > 0;
  const anchorRef = useRef<HTMLSpanElement>(null);
  const wasOpen = useRef(open);

  // Deleting the piece from the panel's own Delete button closes the panel
  // with focus inside it; hand that focus to the canvas so the keyboard user
  // is not left on <body>. Any other way of deselecting leaves focus alone.
  useEffect(() => {
    const closed = wasOpen.current && !open;
    wasOpen.current = open;
    if (!closed || document.activeElement !== document.body) return;
    const canvas = anchorRef.current?.closest('[data-drawing-editor]')?.querySelector<HTMLElement>('[role="application"]');
    canvas?.focus();
  }, [open]);

  return (
    <>
      <span ref={anchorRef} hidden />
      {open && (
        <aside
          aria-label="Properties"
          className="modal-scrollbar absolute right-3 top-3 z-20 max-h-[calc(100%-10rem)] w-72 overflow-y-auto overflow-x-hidden rounded-lg border border-stone-200 bg-white p-3 shadow-lg"
        >
          <PieceInspector />
        </aside>
      )}
    </>
  );
}
