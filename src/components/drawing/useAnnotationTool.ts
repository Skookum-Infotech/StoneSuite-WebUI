// Click handling for the Note and Dimension tools. A note is one click; a
// dimension is two (the first is remembered as `pending`). Points snap to a
// nearby piece corner so a dimension measures real geometry.

import { useState } from 'react';
import type { Point } from '@/types/drawing';
import { areaVertices, dimensionProblem, newDimension, newNote, snapToVertex } from '@/lib/drawing/annotations';
import { SNAP_TOLERANCE_MM } from '@/lib/drawing/constants';
import { useDrawingEditor } from './DrawingEditorContext';

export function useAnnotationTool() {
  const { state, dispatch, tool, setTool } = useDrawingEditor();
  const [pending, setPending] = useState<{ from: Point; tool: string } | null>(null);
  const area = state.present.areas.find((a) => a.id === state.activeAreaId);

  /** Handles a canvas click for the active tool; false when it is not an annotation tool. */
  const place = (point: Point): boolean => {
    if (!area || (tool !== 'note' && tool !== 'dimension')) return false;
    const at = snapToVertex(point, areaVertices(area), SNAP_TOLERANCE_MM / state.zoom);
    if (tool === 'note') {
      dispatch({ type: 'setAnnotations', areaId: area.id, notes: [...area.notes, newNote(at, crypto.randomUUID())] });
      setTool('select');
      return true;
    }
    if (!pending || pending.tool !== tool) {
      setPending({ from: at, tool });
      return true;
    }
    if (dimensionProblem(pending.from, at, 0) === null) {
      dispatch({
        type: 'setAnnotations', areaId: area.id,
        dimensions: [...(area.dimensions ?? []), newDimension(pending.from, at, crypto.randomUUID())],
      });
    }
    setPending(null);
    setTool('select');
    return true;
  };

  /** The first dimension point, only while the dimension tool is still active. */
  const pendingFrom = tool === 'dimension' && pending?.tool === 'dimension' ? pending.from : null;
  return { place, pendingFrom };
}
