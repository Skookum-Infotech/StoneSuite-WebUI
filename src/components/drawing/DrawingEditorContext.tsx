// Wraps the editor reducer (drawingReducer.ts) in React context so every
// components/drawing/* control can dispatch into it and read its state
// without prop-drilling past the 5-prop cap (CLAUDE.md).

import {
  createContext, useCallback, useContext, useMemo, useReducer, useRef, useState, type Dispatch, type ReactNode,
} from 'react';
import type { Drawing, Piece } from '@/types/drawing';
import type { SalesOrderLine } from '@/types/salesOrder';
import { bounds, transformOutline } from '@/lib/drawing/geometry';
import { VIEWPORT_HEIGHT, VIEWPORT_WIDTH, ZOOM_MAX, ZOOM_MIN } from '@/lib/drawing/constants';
import {
  createInitialEditorState, editorReducer, type EditorAction, type EditorState,
} from '@/lib/drawing/drawingReducer';

/** Leaves this much of the viewport empty around the fitted content, so
 *  "Fit" doesn't crop a piece flush against the edge. */
const FIT_MARGIN = 0.9;

export type EditorTool = 'select' | 'draw' | 'polygon' | 'note' | 'dimension' | 'line';

export interface DrawingEditorContextValue {
  state: EditorState;
  dispatch: Dispatch<EditorAction>;
  tool: EditorTool;
  setTool: (tool: EditorTool) => void;
  materialLines: SalesOrderLine[];
  /** Whether the corner map is showing (the M key and the bottom bar flip it). */
  mapOpen: boolean;
  toggleMap: () => void;
  /** Whether every piece's auto-placed dimension lines are showing. Off by
   *  default — a tall, narrow piece's side labels can reach far out at a
   *  high zoom, and most of the time nobody is reading them. The bottom bar
   *  flips it; the inspector's own numbers are unaffected either way. */
  dimensionsOn: boolean;
  toggleDimensions: () => void;
  /** Whether the floating Properties panel is showing. Off by default and
   *  independent of selection — it used to open on its own the moment a
   *  piece was clicked, which the user found it popped up uninvited; now
   *  only the bottom bar's own Properties button opens or closes it, same
   *  as Dimensions and Map. Selecting a piece while it's already open just
   *  changes what it shows. */
  propertiesOpen: boolean;
  toggleProperties: () => void;
  fitToArea: () => void;
  /** Copy / paste / duplicate act on the current multi-selection. */
  copySelection: () => void;
  pasteClipboard: () => void;
  duplicateSelection: () => void;
}

const DrawingEditorContext = createContext<DrawingEditorContextValue | undefined>(undefined);

export function DrawingEditorProvider(
  { drawing, materialLines, initialZoom = 1, children }: {
    drawing: Drawing;
    materialLines: SalesOrderLine[];
    /** The zoom the editor opens at; the page opens zoomed out (OPEN_ZOOM). */
    initialZoom?: number;
    children: ReactNode;
  },
) {
  const [state, dispatch] = useReducer(editorReducer, createInitialEditorState(drawing, initialZoom));
  const [tool, setTool] = useState<EditorTool>('select');
  const [mapOpen, setMapOpen] = useState(true);
  const toggleMap = useCallback(() => setMapOpen((open) => !open), []);
  const [dimensionsOn, setDimensionsOn] = useState(false);
  const toggleDimensions = useCallback(() => setDimensionsOn((on) => !on), []);
  const [propertiesOpen, setPropertiesOpen] = useState(false);
  const toggleProperties = useCallback(() => setPropertiesOpen((open) => !open), []);
  // Copied pieces live outside the document so copying is not an edit, and
  // survive switching area (paste lands in whichever area is active).
  const clipboard = useRef<Piece[]>([]);

  const activeAreaPieces = useCallback(
    () => state.present.areas.find((a) => a.id === state.activeAreaId)?.pieces ?? [],
    [state.present.areas, state.activeAreaId],
  );

  const copySelection = useCallback(() => {
    const selected = activeAreaPieces().filter((p) => state.selectedPieceIds.includes(p.id));
    if (selected.length > 0) clipboard.current = selected;
  }, [activeAreaPieces, state.selectedPieceIds]);

  const pasteClipboard = useCallback(() => {
    if (clipboard.current.length === 0) return;
    dispatch({
      type: 'pastePieces',
      areaId: state.activeAreaId,
      pieces: clipboard.current,
      newIds: clipboard.current.map(() => crypto.randomUUID()),
    });
  }, [state.activeAreaId]);

  const duplicateSelection = useCallback(() => {
    if (state.selectedPieceIds.length === 0) return;
    dispatch({
      type: 'duplicatePieces',
      areaId: state.activeAreaId,
      pieceIds: state.selectedPieceIds,
      newIds: state.selectedPieceIds.map(() => crypto.randomUUID()),
    });
  }, [state.activeAreaId, state.selectedPieceIds]);

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
    // pan.x = -zoom*centerX and pan.y = +zoom*centerY.
    const targetPanX = -zoom * centerX;
    const targetPanY = zoom * centerY;
    dispatch({ type: 'setZoom', zoom });
    dispatch({ type: 'pan', delta: { x: targetPanX - state.pan.x, y: targetPanY - state.pan.y } });
  };

  const value = useMemo<DrawingEditorContextValue>(
    () => ({
      state, dispatch, tool, setTool, materialLines, mapOpen, toggleMap, dimensionsOn, toggleDimensions,
      propertiesOpen, toggleProperties, fitToArea, copySelection, pasteClipboard, duplicateSelection,
    }),
    // fitToArea closes over state/materialLines, so it's already covered by
    // those deps — listing it too would just be the same change twice.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      state, tool, materialLines, mapOpen, toggleMap, dimensionsOn, toggleDimensions, propertiesOpen,
      toggleProperties, copySelection, pasteClipboard, duplicateSelection,
    ],
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
