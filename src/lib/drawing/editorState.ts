// State shape and pure helpers shared by the editor reducer: selection
// bookkeeping, copying pieces, and the small document-update utilities.

import type { Drawing, DrawingArea, Piece, Point } from '@/types/drawing';
import { COPY_OFFSET_MM, MAX_UNDO_STEPS } from './constants';
import { areaLetter, nextPieceLabel } from './labels';

export interface EditorState {
  past: Drawing[];
  present: Drawing;
  future: Drawing[];
  activeAreaId: string;
  /** The piece the inspector shows — the last one clicked when several are selected. */
  selectedPieceId: string | null;
  /** Every selected piece, `selectedPieceId` included. */
  selectedPieceIds: string[];
  selectedCutoutId: string | null;
  selectedEdgeIndex: number | null;
  zoom: number;
  pan: Point;
}

export const NO_SELECTION = {
  selectedPieceId: null,
  selectedPieceIds: [] as string[],
  selectedCutoutId: null,
  selectedEdgeIndex: null,
};

/** Selection fields for "exactly these pieces, nothing finer selected". */
export function selectionOf(ids: string[]) {
  return {
    selectedPieceId: ids[ids.length - 1] ?? null,
    selectedPieceIds: ids,
    selectedCutoutId: null,
    selectedEdgeIndex: null,
  };
}

/** Undo/redo swap `present` for an entirely different document, which can
 *  leave the active area, selected pieces, cutout or edge pointing at things
 *  that no longer exist. Falls back to the first area (there is always one)
 *  and drops whatever selection no longer names something real. */
export function sanitizeSelection(state: EditorState): EditorState {
  const activeAreaExists = state.present.areas.some((a) => a.id === state.activeAreaId);
  const activeAreaId = activeAreaExists ? state.activeAreaId : state.present.areas[0].id;
  const pieces = state.present.areas.find((a) => a.id === activeAreaId)?.pieces ?? [];
  const selectedPieceIds = state.selectedPieceIds.filter((id) => pieces.some((p) => p.id === id));
  const selectedPieceId = state.selectedPieceId !== null && selectedPieceIds.includes(state.selectedPieceId)
    ? state.selectedPieceId
    : (selectedPieceIds[selectedPieceIds.length - 1] ?? null);
  const selected = pieces.find((p) => p.id === selectedPieceId);
  const cutoutStillThere = selected?.cutouts.some((c) => c.id === state.selectedCutoutId) ?? false;
  const edgeStillThere = state.selectedEdgeIndex !== null && (selected?.outline.length ?? 0) > state.selectedEdgeIndex;
  return {
    ...state,
    activeAreaId,
    selectedPieceId,
    selectedPieceIds,
    selectedCutoutId: cutoutStillThere ? state.selectedCutoutId : null,
    selectedEdgeIndex: edgeStillThere ? state.selectedEdgeIndex : null,
  };
}

/** Undo/redo swap the document's content but must keep the version the server
 *  last confirmed: history snapshots carry whatever version was current when
 *  they were taken, and sending a stale one makes the very next save fail as
 *  "changed by someone else" even though nobody else touched it. */
export function keepSavedVersion(restored: Drawing, current: Drawing): Drawing {
  return { ...restored, version: current.version, updatedAt: current.updatedAt, updatedBy: current.updatedBy };
}

export function normalizeDegrees(deg: number): number {
  return ((deg % 360) + 360) % 360;
}

/** Copies of `sources` under `newIds`, each with the next free label in the
 *  area and nudged off the original so it does not land exactly on top of it. */
export function copyPieces(sources: Piece[], newIds: string[], areaIndex: number, existing: Piece[]): Piece[] {
  const labels = existing.map((p) => p.label);
  return sources.map((source, i) => {
    const label = nextPieceLabel(areaLetter(areaIndex), labels);
    labels.push(label);
    return {
      ...source,
      id: newIds[i],
      label,
      position: { x: source.position.x + COPY_OFFSET_MM, y: source.position.y - COPY_OFFSET_MM },
      cutouts: source.cutouts.map((c) => ({ ...c })),
    };
  });
}

export function updateArea(drawing: Drawing, areaId: string, update: (area: DrawingArea) => DrawingArea): Drawing {
  return { ...drawing, areas: drawing.areas.map((a) => (a.id === areaId ? update(a) : a)) };
}

export function updatePieceIn(
  drawing: Drawing, areaId: string, pieceId: string, update: (piece: Piece) => Piece,
): Drawing {
  return updateArea(drawing, areaId, (area) => ({
    ...area, pieces: area.pieces.map((p) => (p.id === pieceId ? update(p) : p)),
  }));
}

export function movePieces(drawing: Drawing, areaId: string, pieceIds: string[], delta: Point): Drawing {
  return updateArea(drawing, areaId, (area) => ({
    ...area,
    pieces: area.pieces.map((p) => (pieceIds.includes(p.id)
      ? { ...p, position: { x: p.position.x + delta.x, y: p.position.y + delta.y } }
      : p)),
  }));
}

export function duplicateInto(drawing: Drawing, areaId: string, pieceIds: string[], newIds: string[]): Drawing {
  const areaIndex = drawing.areas.findIndex((a) => a.id === areaId);
  const area = drawing.areas[areaIndex];
  const sources = area.pieces.filter((p) => pieceIds.includes(p.id));
  if (sources.length === 0) return drawing;
  return updateArea(drawing, areaId, (a) => ({
    ...a, pieces: [...a.pieces, ...copyPieces(sources, newIds, areaIndex, a.pieces)],
  }));
}

/** Pushes `state.present` onto history (capped at MAX_UNDO_STEPS), clears
 *  `future`, and replaces `present` with the result of `update`. Every
 *  document-mutating action shares this shape. */
export function mutateDocument(state: EditorState, update: (drawing: Drawing) => Drawing): EditorState {
  return {
    ...state,
    past: [...state.past, state.present].slice(-MAX_UNDO_STEPS),
    present: update(state.present),
    future: [],
  };
}

export function newArea(name: string, sortOrder: number): DrawingArea {
  return { id: crypto.randomUUID(), name, code: '', sortOrder, pieces: [], cabinets: [], notes: [] };
}

