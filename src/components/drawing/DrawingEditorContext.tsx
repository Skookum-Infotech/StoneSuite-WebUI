// Wraps the editor reducer (drawingReducer.ts) in React context so every
// components/drawing/* control can dispatch into it and read its state
// without prop-drilling past the 5-prop cap (CLAUDE.md).

import { createContext, useContext, useMemo, useReducer, useState, type Dispatch, type ReactNode } from 'react';
import type { Drawing } from '@/types/drawing';
import type { SalesOrderLine } from '@/types/salesOrder';
import { bounds, transformOutline } from '@/lib/drawing/geometry';
import {
  createInitialEditorState, editorReducer, type EditorAction, type EditorState,
} from '@/lib/drawing/drawingReducer';

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
    const centerX = (b.minX + b.maxX) / 2;
    const centerY = (b.minY + b.maxY) / 2;
    dispatch({ type: 'setZoom', zoom: 1 });
    dispatch({ type: 'pan', delta: { x: -centerX - state.pan.x, y: -centerY - state.pan.y } });
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
