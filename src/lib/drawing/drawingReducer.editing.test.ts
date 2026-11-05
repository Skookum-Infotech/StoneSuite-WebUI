import { describe, expect, it } from 'vitest';
import type { Cutout, Drawing, Piece } from '@/types/drawing';
import { COPY_OFFSET_MM } from './constants';
import { createInitialEditorState, editorReducer, type EditorState } from './drawingReducer';
import { rectOutline } from './geometry';

const piece = (id: string, label: string, extra: Partial<Piece> = {}): Piece => ({
  id, label, shape: 'rect', outline: rectOutline(600, 400), position: { x: 0, y: 0 }, rotationDeg: 0,
  thicknessMm: 30, edges: [], seams: [], cutouts: [], ...extra,
});

const drawing = (pieces: Piece[], version = 0): Drawing => ({
  schemaVersion: 1, salesOrderId: 'so1', version, displayUnit: 'in', fractionDenominator: 32,
  areas: [{ id: 'a', name: 'A', code: '', sortOrder: 0, pieces, cabinets: [], notes: [] }],
  updatedAt: '2026-11-03T00:00:00.000Z', updatedBy: { id: 'u1', name: 'T' },
});

const start = (pieces: Piece[] = [piece('p1', 'A-1'), piece('p2', 'A-2')]) => createInitialEditorState(drawing(pieces));
const piecesOf = (s: EditorState) => s.present.areas[0].pieces;

describe('undo/redo keep the server-confirmed version', () => {
  it('undo after a save does not roll the version back, so the next save is not a false conflict', () => {
    let s = start([]);
    s = editorReducer(s, { type: 'addPiece', areaId: 'a', piece: piece('p1', 'A-1') });
    s = editorReducer(s, { type: 'drawingSaved', version: 5, updatedAt: 'now', updatedBy: { id: 'u', name: 'N' } });
    s = editorReducer(s, { type: 'undo' });
    expect(piecesOf(s)).toHaveLength(0);
    expect(s.present.version).toBe(5);
    s = editorReducer(s, { type: 'redo' });
    expect(piecesOf(s)).toHaveLength(1);
    expect(s.present.version).toBe(5);
  });
});

describe('selection', () => {
  it('shift-click adds and removes pieces from the selection', () => {
    let s = start();
    s = editorReducer(s, { type: 'selectPiece', pieceId: 'p1' });
    s = editorReducer(s, { type: 'selectPiece', pieceId: 'p2', additive: true });
    expect(s.selectedPieceIds).toEqual(['p1', 'p2']);
    expect(s.selectedPieceId).toBe('p2');
    s = editorReducer(s, { type: 'selectPiece', pieceId: 'p2', additive: true });
    expect(s.selectedPieceIds).toEqual(['p1']);
    expect(s.selectedPieceId).toBe('p1');
  });

  it('a plain click inside a group keeps the group; outside it replaces it', () => {
    let s = editorReducer(start(), { type: 'selectPieces', pieceIds: ['p1', 'p2'] });
    s = editorReducer(s, { type: 'selectPiece', pieceId: 'p1' });
    expect(s.selectedPieceIds).toEqual(['p1', 'p2']);
    s = editorReducer(s, { type: 'selectPiece', pieceId: null });
    expect(s.selectedPieceIds).toEqual([]);
    s = editorReducer(s, { type: 'selectPiece', pieceId: 'p2' });
    expect(s.selectedPieceIds).toEqual(['p2']);
  });

  it('deleting selected pieces clears them from the selection', () => {
    let s = editorReducer(start(), { type: 'selectPieces', pieceIds: ['p1', 'p2'] });
    s = editorReducer(s, { type: 'deletePieces', areaId: 'a', pieceIds: ['p1', 'p2'] });
    expect(piecesOf(s)).toHaveLength(0);
    expect(s.selectedPieceIds).toEqual([]);
    expect(s.selectedPieceId).toBeNull();
  });

  it('undo drops a selection that names a piece that no longer exists', () => {
    let s = editorReducer(start([]), { type: 'addPiece', areaId: 'a', piece: piece('p1', 'A-1') });
    s = editorReducer(s, { type: 'selectPiece', pieceId: 'p1' });
    s = editorReducer(s, { type: 'undo' });
    expect(s.selectedPieceIds).toEqual([]);
  });
});

describe('moving, rotating, copying several pieces', () => {
  it('movePieces moves only the named pieces, as one undo step', () => {
    let s = start([piece('p1', 'A-1'), piece('p2', 'A-2'), piece('p3', 'A-3')]);
    s = editorReducer(s, { type: 'movePieces', areaId: 'a', pieceIds: ['p1', 'p3'], delta: { x: 10, y: -5 } });
    expect(piecesOf(s).map((p) => p.position)).toEqual([{ x: 10, y: -5 }, { x: 0, y: 0 }, { x: 10, y: -5 }]);
    expect(s.past).toHaveLength(1);
  });

  it.each([
    [45.5, 45.5],
    [450, 90],
    [-90, 270],
    [360, 0],
  ])('setPieceRotation %d -> %d degrees', (input, expected) => {
    const s = editorReducer(start(), { type: 'setPieceRotation', areaId: 'a', pieceIds: ['p1'], rotationDeg: input });
    expect(piecesOf(s)[0].rotationDeg).toBe(expected);
    expect(piecesOf(s)[1].rotationDeg).toBe(0);
  });

  it('rotatePiece adds a quarter turn to a freely rotated piece', () => {
    let s = start([piece('p1', 'A-1', { rotationDeg: 45 })]);
    s = editorReducer(s, { type: 'rotatePiece', areaId: 'a', pieceId: 'p1' });
    expect(piecesOf(s)[0].rotationDeg).toBe(135);
  });

  it('duplicatePieces copies every piece with its own label and an offset, never on top of the source', () => {
    const s = editorReducer(start(), { type: 'duplicatePieces', areaId: 'a', pieceIds: ['p1', 'p2'], newIds: ['c1', 'c2'] });
    const pieces = piecesOf(s);
    expect(pieces.map((p) => p.label)).toEqual(['A-1', 'A-2', 'A-3', 'A-4']);
    expect(pieces[2].position).toEqual({ x: COPY_OFFSET_MM, y: -COPY_OFFSET_MM });
  });

  it('duplicating copies cutouts, so editing the copy leaves the original alone', () => {
    const sink: Cutout = { id: 'c', type: 'sink', center: { x: 300, y: -200 }, widthMm: 100, depthMm: 100 };
    let s = start([piece('p1', 'A-1', { cutouts: [sink] })]);
    s = editorReducer(s, { type: 'duplicatePiece', areaId: 'a', pieceId: 'p1', newId: 'p2' });
    expect(piecesOf(s)[1].cutouts[0]).toEqual(sink);
    expect(piecesOf(s)[1].cutouts[0]).not.toBe(sink);
  });

  it('pastePieces adds copies, labelled for this area, and selects them', () => {
    const clipboard = [piece('x', 'Z-9')];
    const s = editorReducer(start(), { type: 'pastePieces', areaId: 'a', pieces: clipboard, newIds: ['n1'] });
    expect(piecesOf(s)[2]).toMatchObject({ id: 'n1', label: 'A-3' });
    expect(s.selectedPieceIds).toEqual(['n1']);
  });
});

describe('cutouts', () => {
  const sink: Cutout = { id: 'c1', type: 'sink', shape: 'rect', center: { x: 300, y: -200 }, widthMm: 100, depthMm: 80 };

  it('addCutout adds to that piece and selects it', () => {
    const s = editorReducer(start(), { type: 'addCutout', areaId: 'a', pieceId: 'p1', cutout: sink });
    expect(piecesOf(s)[0].cutouts).toEqual([sink]);
    expect(piecesOf(s)[1].cutouts).toEqual([]);
    expect(s.selectedPieceId).toBe('p1');
    expect(s.selectedCutoutId).toBe('c1');
  });

  it('updateCutout patches one cutout; deleteCutout removes it and clears its selection', () => {
    let s = editorReducer(start(), { type: 'addCutout', areaId: 'a', pieceId: 'p1', cutout: sink });
    s = editorReducer(s, { type: 'updateCutout', areaId: 'a', pieceId: 'p1', cutoutId: 'c1', patch: { widthMm: 250 } });
    expect(piecesOf(s)[0].cutouts[0]).toMatchObject({ widthMm: 250, depthMm: 80 });
    s = editorReducer(s, { type: 'deleteCutout', areaId: 'a', pieceId: 'p1', cutoutId: 'c1' });
    expect(piecesOf(s)[0].cutouts).toEqual([]);
    expect(s.selectedCutoutId).toBeNull();
  });

  it('every cutout edit is one undoable step', () => {
    let s = editorReducer(start(), { type: 'addCutout', areaId: 'a', pieceId: 'p1', cutout: sink });
    s = editorReducer(s, { type: 'undo' });
    expect(piecesOf(s)[0].cutouts).toEqual([]);
    expect(s.selectedCutoutId).toBeNull();
  });

  it('selectEdge selects that edge of that piece', () => {
    const s = editorReducer(start(), { type: 'selectEdge', pieceId: 'p2', edgeIndex: 2 });
    expect(s).toMatchObject({ selectedPieceId: 'p2', selectedEdgeIndex: 2, selectedCutoutId: null });
  });
});

describe('setAnnotations', () => {
  const start = () => createInitialEditorState({
    schemaVersion: 1, salesOrderId: 's', version: 3, displayUnit: 'mm', fractionDenominator: 32,
    areas: [{ id: 'a', name: 'A', code: '', sortOrder: 0, pieces: [], cabinets: [], notes: [] }],
    updatedAt: '', updatedBy: { id: 'u', name: 'U' },
  });
  const note = { id: 'n1', text: 'Seam', at: { x: 1, y: 2 } };
  const dim = { id: 'd1', from: { x: 0, y: 0 }, to: { x: 10, y: 0 }, offsetMm: 25.4 };

  it('sets notes and dimensions in one undoable step, leaving the other list alone when omitted', () => {
    let state = editorReducer(start(), { type: 'setAnnotations', areaId: 'a', notes: [note] });
    state = editorReducer(state, { type: 'setAnnotations', areaId: 'a', dimensions: [dim] });
    expect(state.present.areas[0].notes).toEqual([note]);
    expect(state.present.areas[0].dimensions).toEqual([dim]);
    expect(state.past).toHaveLength(2);
    state = editorReducer(state, { type: 'undo' });
    expect(state.present.areas[0].dimensions).toBeUndefined();
    expect(state.present.areas[0].notes).toEqual([note]);
    expect(state.present.version).toBe(3);
  });
});
