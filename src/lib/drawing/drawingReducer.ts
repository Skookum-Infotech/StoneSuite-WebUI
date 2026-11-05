// The drawing editor's document state + undo/redo. Pure: every action
// returns a new EditorState, never mutates its input. "Document-mutating"
// actions (area/piece/cutout CRUD, move, rotate) push `present` onto `past`
// (capped at MAX_UNDO_STEPS) and clear `future`; "view-only" actions
// (selection, zoom, pan) touch neither.

import type { Cutout, Dimension, Drawing, Note, Piece, Point } from '@/types/drawing';
import { ZOOM_MAX, ZOOM_MIN } from './constants';
import {
  NO_SELECTION, copyPieces, duplicateInto, keepSavedVersion, movePieces, mutateDocument, newArea, normalizeDegrees,
  sanitizeSelection, selectionOf, updateArea,
  updatePieceIn, type EditorState,
} from './editorState';

export type { EditorState } from './editorState';

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
  | { type: 'movePieces'; areaId: string; pieceIds: string[]; delta: Point }
  /** A quarter turn. `pieceIds` rotates a whole selection as one undo step. */
  | { type: 'rotatePiece'; areaId: string; pieceId: string; pieceIds?: string[] }
  | { type: 'setPieceRotation'; areaId: string; pieceIds: string[]; rotationDeg: number }
  | { type: 'deletePieces'; areaId: string; pieceIds: string[] }
  | { type: 'duplicatePieces'; areaId: string; pieceIds: string[]; newIds: string[] }
  | { type: 'pastePieces'; areaId: string; pieces: Piece[]; newIds: string[] }
  | { type: 'addCutout'; areaId: string; pieceId: string; cutout: Cutout }
  | { type: 'updateCutout'; areaId: string; pieceId: string; cutoutId: string; patch: Partial<Cutout> }
  | { type: 'deleteCutout'; areaId: string; pieceId: string; cutoutId: string }
  /** Replaces an area's notes and/or manual dimensions as one undo step. */
  | { type: 'setAnnotations'; areaId: string; notes?: Note[]; dimensions?: Dimension[] }
  | { type: 'selectPiece'; pieceId: string | null; additive?: boolean }
  | { type: 'selectPieces'; pieceIds: string[] }
  | { type: 'selectCutout'; pieceId: string; cutoutId: string | null }
  | { type: 'selectEdge'; pieceId: string; edgeIndex: number | null }
  | { type: 'setZoom'; zoom: number }
  | { type: 'pan'; delta: Point }
  | { type: 'undo' }
  | { type: 'redo' }
  | { type: 'loadDrawing'; drawing: Drawing }
  | { type: 'drawingSaved'; version: number; updatedAt: string; updatedBy: Drawing['updatedBy'] };

const QUARTER_TURN = 90;

export function createInitialEditorState(drawing: Drawing): EditorState {
  return {
    past: [],
    present: drawing,
    future: [],
    activeAreaId: drawing.areas[0]?.id ?? '',
    ...NO_SELECTION,
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
      return sanitizeSelection({
        ...next,
        activeAreaId: state.activeAreaId === action.areaId ? remaining[0].id : state.activeAreaId,
      });
    }

    case 'setActiveArea':
      // A piece selected in the area being left has no meaning in the new
      // one — clear it so the inspector doesn't keep showing it.
      return { ...state, activeAreaId: action.areaId, ...NO_SELECTION };

    case 'addPiece':
      return mutateDocument(state, (drawing) => updateArea(drawing, action.areaId, (area) => ({
        ...area,
        pieces: [...area.pieces, action.piece],
      })));

    case 'updatePiece':
      return mutateDocument(state, (drawing) => updatePieceIn(drawing, action.areaId, action.pieceId, (p) => ({
        ...p, ...action.patch,
      })));

    case 'deletePiece':
      return sanitizeSelection(mutateDocument(state, (drawing) => updateArea(drawing, action.areaId, (area) => ({
        ...area,
        pieces: area.pieces.filter((p) => p.id !== action.pieceId),
      }))));

    case 'deletePieces':
      return sanitizeSelection(mutateDocument(state, (drawing) => updateArea(drawing, action.areaId, (area) => ({
        ...area,
        pieces: area.pieces.filter((p) => !action.pieceIds.includes(p.id)),
      }))));

    case 'duplicatePiece':
      return mutateDocument(state, (drawing) => duplicateInto(drawing, action.areaId, [action.pieceId], [action.newId]));

    case 'duplicatePieces':
      return mutateDocument(state, (drawing) => duplicateInto(drawing, action.areaId, action.pieceIds, action.newIds));

    case 'pastePieces': {
      const areaIndex = state.present.areas.findIndex((a) => a.id === action.areaId);
      if (areaIndex < 0 || action.pieces.length === 0) return state;
      const next = mutateDocument(state, (drawing) => updateArea(drawing, action.areaId, (a) => ({
        ...a, pieces: [...a.pieces, ...copyPieces(action.pieces, action.newIds, areaIndex, a.pieces)],
      })));
      return { ...next, ...selectionOf(action.newIds.slice(0, action.pieces.length)) };
    }

    case 'movePiece':
      return mutateDocument(state, (drawing) => movePieces(drawing, action.areaId, [action.pieceId], action.delta));

    case 'movePieces':
      return mutateDocument(state, (drawing) => movePieces(drawing, action.areaId, action.pieceIds, action.delta));

    case 'rotatePiece': {
      const ids = action.pieceIds ?? [action.pieceId];
      return mutateDocument(state, (drawing) => updateArea(drawing, action.areaId, (area) => ({
        ...area,
        pieces: area.pieces.map((p) => (ids.includes(p.id)
          ? { ...p, rotationDeg: normalizeDegrees(p.rotationDeg + QUARTER_TURN) }
          : p)),
      })));
    }

    case 'setPieceRotation':
      return mutateDocument(state, (drawing) => updateArea(drawing, action.areaId, (area) => ({
        ...area,
        pieces: area.pieces.map((p) => (action.pieceIds.includes(p.id)
          ? { ...p, rotationDeg: normalizeDegrees(action.rotationDeg) }
          : p)),
      })));

    case 'addCutout':
      return {
        ...mutateDocument(state, (drawing) => updatePieceIn(drawing, action.areaId, action.pieceId, (p) => ({
          ...p, cutouts: [...p.cutouts, action.cutout],
        }))),
        ...selectionOf([action.pieceId]),
        selectedCutoutId: action.cutout.id,
      };

    case 'updateCutout':
      return mutateDocument(state, (drawing) => updatePieceIn(drawing, action.areaId, action.pieceId, (p) => ({
        ...p, cutouts: p.cutouts.map((c) => (c.id === action.cutoutId ? { ...c, ...action.patch } : c)),
      })));

    case 'deleteCutout':
      return sanitizeSelection(mutateDocument(state, (drawing) => updatePieceIn(drawing, action.areaId, action.pieceId, (p) => ({
        ...p, cutouts: p.cutouts.filter((c) => c.id !== action.cutoutId),
      }))));

    case 'setAnnotations':
      return mutateDocument(state, (drawing) => updateArea(drawing, action.areaId, (area) => ({
        ...area,
        notes: action.notes ?? area.notes,
        dimensions: action.dimensions ?? area.dimensions,
      })));

    case 'selectPiece':
      return selectPiece(state, action.pieceId, action.additive === true);

    case 'selectPieces':
      return { ...state, ...selectionOf(action.pieceIds) };

    case 'selectCutout':
      return { ...state, ...selectionOf([action.pieceId]), selectedCutoutId: action.cutoutId };

    case 'selectEdge':
      return { ...state, ...selectionOf([action.pieceId]), selectedEdgeIndex: action.edgeIndex };

    case 'setZoom':
      return { ...state, zoom: Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, action.zoom)) };

    case 'pan':
      return { ...state, pan: { x: state.pan.x + action.delta.x, y: state.pan.y + action.delta.y } };

    case 'undo': {
      if (state.past.length === 0) return state;
      const previous = state.past[state.past.length - 1];
      return sanitizeSelection({
        ...state,
        past: state.past.slice(0, -1),
        present: keepSavedVersion(previous, state.present),
        future: [state.present, ...state.future],
      });
    }

    case 'redo': {
      if (state.future.length === 0) return state;
      const [next, ...rest] = state.future;
      return sanitizeSelection({
        ...state,
        past: [...state.past, state.present],
        present: keepSavedVersion(next, state.present),
        future: rest,
      });
    }

    // Loading a different document (initial load, "Reload latest" after a
    // save conflict, or restoring a version) is not an undoable edit of the
    // current one — past/future reset, same as opening a different file.
    case 'loadDrawing':
      return sanitizeSelection({ ...state, past: [], present: action.drawing, future: [] });

    // A background autosave completing is not an undoable edit either, and
    // must not revert any edit made while it was in flight — only the
    // version/updatedAt/updatedBy the server just assigned are applied, on
    // top of whatever `present` currently is (which may already be newer
    // than what was actually saved). The next autosave then sends this
    // version as its own recordVersion, so it doesn't spuriously conflict
    // with the save that just succeeded.
    case 'drawingSaved':
      return {
        ...state,
        present: {
          ...state.present,
          version: action.version,
          updatedAt: action.updatedAt,
          updatedBy: action.updatedBy,
        },
      };
  }
}

function selectPiece(state: EditorState, pieceId: string | null, additive: boolean): EditorState {
  if (pieceId === null) return { ...state, ...NO_SELECTION };
  if (!additive) {
    // A plain click on a piece that is already part of a multi-selection keeps
    // the group, so it can be dragged together; the inspector just focuses
    // the clicked one.
    const keepGroup = state.selectedPieceIds.length > 1 && state.selectedPieceIds.includes(pieceId);
    return {
      ...state,
      selectedPieceId: pieceId,
      selectedPieceIds: keepGroup ? state.selectedPieceIds : [pieceId],
      selectedCutoutId: null,
      selectedEdgeIndex: null,
    };
  }
  const ids = state.selectedPieceIds.includes(pieceId)
    ? state.selectedPieceIds.filter((x) => x !== pieceId)
    : [...state.selectedPieceIds, pieceId];
  return { ...state, ...selectionOf(ids) };
}

