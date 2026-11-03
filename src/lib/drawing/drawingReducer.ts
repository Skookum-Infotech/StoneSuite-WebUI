// The drawing editor's document state + undo/redo. Pure: every action
// returns a new EditorState, never mutates its input. "Document-mutating"
// actions (area/piece CRUD, move, rotate) push `present` onto `past`
// (capped at MAX_UNDO_STEPS) and clear `future`; "view-only" actions
// (selection, zoom, pan) touch neither.

import type { Drawing, DrawingArea, Piece, Point } from '@/types/drawing';
import { areaLetter, nextPieceLabel } from './labels';
import { MAX_UNDO_STEPS, ZOOM_MAX, ZOOM_MIN } from './constants';

export interface EditorState {
  past: Drawing[];
  present: Drawing;
  future: Drawing[];
  activeAreaId: string;
  selectedPieceId: string | null;
  zoom: number;
  pan: Point;
}

export type EditorAction =
  | { type: 'addArea'; name: string }
  | { type: 'renameArea'; areaId: string; name: string }
  | { type: 'setAreaCode'; areaId: string; code: string }
  | { type: 'reorderAreas'; areaIds: string[] }
  | { type: 'deleteArea'; areaId: string }
  | { type: 'setActiveArea'; areaId: string }
  | { type: 'addPiece'; areaId: string; piece: Piece }
  | { type: 'updatePiece'; areaId: string; pieceId: string; patch: Partial<Piece> }
  | { type: 'deletePiece'; areaId: string; pieceId: string }
  | { type: 'duplicatePiece'; areaId: string; pieceId: string; newId: string }
  | { type: 'movePiece'; areaId: string; pieceId: string; delta: Point }
  | { type: 'rotatePiece'; areaId: string; pieceId: string }
  | { type: 'selectPiece'; pieceId: string | null }
  | { type: 'setZoom'; zoom: number }
  | { type: 'pan'; delta: Point }
  | { type: 'undo' }
  | { type: 'redo' };

const ROTATION_CYCLE = [0, 90, 180, 270] as const;

export function createInitialEditorState(drawing: Drawing): EditorState {
  return {
    past: [],
    present: drawing,
    future: [],
    activeAreaId: drawing.areas[0]?.id ?? '',
    selectedPieceId: null,
    zoom: 1,
    pan: { x: 0, y: 0 },
  };
}

export function editorReducer(state: EditorState, action: EditorAction): EditorState {
  switch (action.type) {
    case 'addArea':
      return mutateDocument(state, (drawing) => ({
        ...drawing,
        areas: [...drawing.areas, newArea(action.name, drawing.areas.length)],
      }));

    case 'renameArea':
      return mutateDocument(state, (drawing) => ({
        ...drawing,
        areas: drawing.areas.map((a) => (a.id === action.areaId ? { ...a, name: action.name } : a)),
      }));

    case 'setAreaCode':
      return mutateDocument(state, (drawing) => ({
        ...drawing,
        areas: drawing.areas.map((a) => (a.id === action.areaId ? { ...a, code: action.code } : a)),
      }));

    case 'reorderAreas':
      return mutateDocument(state, (drawing) => ({
        ...drawing,
        areas: drawing.areas
          .map((a) => ({ ...a, sortOrder: action.areaIds.indexOf(a.id) }))
          .sort((a, b) => a.sortOrder - b.sortOrder),
      }));

    case 'deleteArea': {
      if (state.present.areas.length <= 1) return state;
      const remaining = state.present.areas.filter((a) => a.id !== action.areaId);
      const next = mutateDocument(state, (drawing) => ({ ...drawing, areas: remaining }));
      return {
        ...next,
        activeAreaId: state.activeAreaId === action.areaId ? remaining[0].id : state.activeAreaId,
      };
    }

    case 'setActiveArea':
      return { ...state, activeAreaId: action.areaId };

    case 'addPiece':
      return mutateDocument(state, (drawing) => updateArea(drawing, action.areaId, (area) => ({
        ...area,
        pieces: [...area.pieces, action.piece],
      })));

    case 'updatePiece':
      return mutateDocument(state, (drawing) => updateArea(drawing, action.areaId, (area) => ({
        ...area,
        pieces: area.pieces.map((p) => (p.id === action.pieceId ? { ...p, ...action.patch } : p)),
      })));

    case 'deletePiece': {
      const next = mutateDocument(state, (drawing) => updateArea(drawing, action.areaId, (area) => ({
        ...area,
        pieces: area.pieces.filter((p) => p.id !== action.pieceId),
      })));
      return {
        ...next,
        selectedPieceId: state.selectedPieceId === action.pieceId ? null : state.selectedPieceId,
      };
    }

    case 'duplicatePiece':
      return mutateDocument(state, (drawing) => {
        const areaIndex = drawing.areas.findIndex((a) => a.id === action.areaId);
        const area = drawing.areas[areaIndex];
        const source = area.pieces.find((p) => p.id === action.pieceId);
        if (!source) return drawing;
        const existingLabels = area.pieces.map((p) => p.label);
        const copy: Piece = {
          ...source,
          id: action.newId,
          label: nextPieceLabel(areaLetter(areaIndex), existingLabels),
        };
        return updateArea(drawing, action.areaId, (a) => ({ ...a, pieces: [...a.pieces, copy] }));
      });

    case 'movePiece':
      return mutateDocument(state, (drawing) => updateArea(drawing, action.areaId, (area) => ({
        ...area,
        pieces: area.pieces.map((p) => (p.id === action.pieceId
          ? { ...p, position: { x: p.position.x + action.delta.x, y: p.position.y + action.delta.y } }
          : p)),
      })));

    case 'rotatePiece':
      return mutateDocument(state, (drawing) => updateArea(drawing, action.areaId, (area) => ({
        ...area,
        pieces: area.pieces.map((p) => (p.id === action.pieceId
          ? { ...p, rotationDeg: ROTATION_CYCLE[(ROTATION_CYCLE.indexOf(p.rotationDeg) + 1) % ROTATION_CYCLE.length] }
          : p)),
      })));

    case 'selectPiece':
      return { ...state, selectedPieceId: action.pieceId };

    case 'setZoom':
      return { ...state, zoom: Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, action.zoom)) };

    case 'pan':
      return { ...state, pan: { x: state.pan.x + action.delta.x, y: state.pan.y + action.delta.y } };

    case 'undo': {
      if (state.past.length === 0) return state;
      const previous = state.past[state.past.length - 1];
      return {
        ...state,
        past: state.past.slice(0, -1),
        present: previous,
        future: [state.present, ...state.future],
      };
    }

    case 'redo': {
      if (state.future.length === 0) return state;
      const [next, ...rest] = state.future;
      return {
        ...state,
        past: [...state.past, state.present],
        present: next,
        future: rest,
      };
    }
  }
}

/** Pushes `state.present` onto history (capped at MAX_UNDO_STEPS), clears
 *  `future`, and replaces `present` with the result of `update`. Every
 *  document-mutating action shares this shape. */
function mutateDocument(state: EditorState, update: (drawing: Drawing) => Drawing): EditorState {
  return {
    ...state,
    past: [...state.past, state.present].slice(-MAX_UNDO_STEPS),
    present: update(state.present),
    future: [],
  };
}

function updateArea(drawing: Drawing, areaId: string, update: (area: DrawingArea) => DrawingArea): Drawing {
  return { ...drawing, areas: drawing.areas.map((a) => (a.id === areaId ? update(a) : a)) };
}

function newArea(name: string, sortOrder: number): DrawingArea {
  return { id: crypto.randomUUID(), name, code: '', sortOrder, pieces: [], cabinets: [], notes: [] };
}
