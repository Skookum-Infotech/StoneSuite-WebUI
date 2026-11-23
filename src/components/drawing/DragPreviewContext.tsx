// While a piece is being dragged, every other piece in the same selection has
// to follow it on screen. The drag itself lives in the dragged PieceShape's
// local state (so a drag stays one undo step), and this context is how it
// tells the rest of the selection how far they have moved so far. Kept apart
// from the editor context on purpose: it changes on every pointer move, and
// only the canvas's shapes should re-render for that — not the toolbar,
// inspector or panels.

import { createContext, useContext } from 'react';
import type { Point } from '@/types/drawing';

export interface DragPreview {
  /** The pieces moving together, or null when nothing is being dragged. */
  pieceIds: string[];
  delta: Point;
}

interface DragPreviewValue {
  preview: DragPreview | null;
  setPreview: (preview: DragPreview | null) => void;
}

export const DragPreviewContext = createContext<DragPreviewValue>({ preview: null, setPreview: () => {} });

export function useDragPreview(): DragPreviewValue {
  return useContext(DragPreviewContext);
}
