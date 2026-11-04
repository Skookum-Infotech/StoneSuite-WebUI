// Wraps the editor reducer (drawingReducer.ts) in React context so every
// components/drawing/* control can dispatch into it and read its state
// without prop-drilling past the 5-prop cap (CLAUDE.md).

import { createContext, useContext, useMemo, useReducer, useState, type Dispatch, type ReactNode } from 'react';
import type { Drawing } from '@/types/drawing';
import type { SalesOrderLine } from '@/types/salesOrder';
import { bounds, transformOutline } from '@/lib/drawing/geometry';
import { VIEWPORT_HEIGHT, VIEWPORT_WIDTH, ZOOM_MAX, ZOOM_MIN } from '@/lib/drawing/constants';
import {
  createInitialEditorState, editorReducer, type EditorAction, type EditorState,
} from '@/lib/drawing/drawingReducer';

/** Leaves this much of the viewport empty around the fitted content, so
 *  "Fit" doesn't crop a piece flush against the edge. */
const FIT_MARGIN = 0.9;

export interface DrawingEditorContextValue {
  state: EditorState;
  dispatch: Dispatch<EditorAction>;
  tool: 'select' | 'polygon';
  setTool: (tool: 'select' | 'polygon') => void;
  materialLines: SalesOrderLine[];
  fitToArea: () => void;
}

const DrawingEditorContext = createContext<DrawingEditorContextValue | undefined>(undefined);

export function DrawingEditorProvider(
  { drawing, materialLines, children }: { drawing: Drawing; materialLines: SalesOrderLine[]; children: ReactNode },
) {
  const [state, dispatch] = useReducer(editorReducer, createInitialEditorState(drawing));
  const [tool, setTool] = useState<'select' | 'polygon'>('select');

  const fitToArea = () => {
    const area = state.present.areas.find((a) => a.id === state.activeAreaId);
    if (!area || area.pieces.length === 0) {
      dispatch({ type: 'setZoom', zoom: 1 });
      dispatch({ type: 'pan', delta: { x: -state.pan.x, y: -state.pan.y } });
      return;
    }
    const allPoints = area.pieces.flatMap((p) => transformOutline(p.outline, p.position, p.rotationDeg));
    const b = bounds(allPoints);
    const contentWidth = b.maxX - b.minX;
    const contentHeight = b.maxY - b.minY;
    // A zero-width/height bound (a single point, or every piece stacked on
    // one line) gives that axis no say in the zoom — the other axis alone
    // decides it, instead of forcing a divide-by-zero.
    const zoomX = contentWidth > 0 ? (VIEWPORT_WIDTH * FIT_MARGIN) / contentWidth : Infinity;
    const zoomY = contentHeight > 0 ? (VIEWPORT_HEIGHT * FIT_MARGIN) / contentHeight : Infinity;
    const zoom = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Math.min(zoomX, zoomY)));

    const centerX = (b.minX + b.maxX) / 2;
    const centerY = (b.minY + b.maxY) / 2;
    // Matches DrawingCanvas's own render transform exactly: outer
    // translate(400,300), inner translate(pan.x,pan.y) scale(zoom), world
    // points drawn as (x, -y). Centering the content requires
    // pan.x = -zoom*centerX and pan.y = +zoom*centerY — a sign the
    // original version of this function got backwards, pushing every
    // piece off the bottom of the viewport instead of centering it.
    const targetPanX = -zoom * centerX;
    const targetPanY = zoom * centerY;
    dispatch({ type: 'setZoom', zoom });
    dispatch({ type: 'pan', delta: { x: targetPanX - state.pan.x, y: targetPanY - state.pan.y } });
  };

  const value = useMemo<DrawingEditorContextValue>(
    () => ({ state, dispatch, tool, setTool, materialLines, fitToArea }),
    // fitToArea closes over state/materialLines, so it's already covered by
    // those deps — listing it too would just be the same change twice.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [state, tool, materialLines],
  );

  return <DrawingEditorContext.Provider value={value}>{children}</DrawingEditorContext.Provider>;
}

// Provider + its own hook live together on purpose (every components/drawing/*
// consumer imports both from one place) — costs Fast Refresh on this file,
// nothing else.
// eslint-disable-next-line react-refresh/only-export-components
export function useDrawingEditor(): DrawingEditorContextValue {
  const value = useContext(DrawingEditorContext);
  if (!value) throw new Error('useDrawingEditor must be used within a DrawingEditorProvider');
  return value;
}
