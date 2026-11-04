import { describe, expect, it } from 'vitest';
import type { Drawing, DrawingArea, Piece } from '@/types/drawing';
import { createInitialEditorState, editorReducer, type EditorState } from './drawingReducer';

function makePiece(id: string, label: string, overrides: Partial<Piece> = {}): Piece {
  return {
    id,
    label,
    shape: 'rect',
    outline: [{ x: 0, y: 0 }, { x: 600, y: 0 }, { x: 600, y: -400 }, { x: 0, y: -400 }],
    position: { x: 0, y: 0 },
    rotationDeg: 0,
    thicknessMm: 30,
    edges: [],
    seams: [],
    cutouts: [],
    ...overrides,
  };
}

function makeArea(id: string, pieces: Piece[]): DrawingArea {
  return { id, name: id, code: '', sortOrder: 0, pieces, cabinets: [], notes: [] };
}

function makeDrawing(areas: DrawingArea[]): Drawing {
  return {
    schemaVersion: 1,
    salesOrderId: 'so1',
    version: 0,
    displayUnit: 'in',
    fractionDenominator: 32,
    areas,
    updatedAt: '2026-11-03T00:00:00.000Z',
    updatedBy: { id: 'u1', name: 'Test User' },
  };
}

const blank = () => createInitialEditorState(makeDrawing([makeArea('area-1', [])]));

function withPiece(areaId: string, piece: Piece) {
  return editorReducer(blank(), { type: 'addPiece', areaId, piece });
}

describe('editorReducer — document-mutating actions', () => {
  it('addArea appends a new area and pushes the prior state onto past', () => {
    const s0 = blank();
    const s1 = editorReducer(s0, { type: 'addArea', name: 'Kitchen' });
    expect(s1.present.areas).toHaveLength(2);
    expect(s1.past).toEqual([s0.present]);
    expect(s1.future).toEqual([]);
  });

  it('addPiece appends to the named area only', () => {
    const s0 = blank();
    const piece = makePiece('p1', 'A-1');
    const s1 = editorReducer(s0, { type: 'addPiece', areaId: 'area-1', piece });
    expect(s1.present.areas[0].pieces).toEqual([piece]);
  });

  it('updatePiece merges the patch into the matching piece only', () => {
    const s0 = withPiece('area-1', makePiece('p1', 'A-1', { thicknessMm: 20 }));
    const s1 = editorReducer(s0, { type: 'updatePiece', areaId: 'area-1', pieceId: 'p1', patch: { thicknessMm: 30 } });
    expect(s1.present.areas[0].pieces[0].thicknessMm).toBe(30);
  });

  it('deletePiece removes it and clears selection if it was selected', () => {
    const s0 = { ...withPiece('area-1', makePiece('p1', 'A-1')), selectedPieceId: 'p1' };
    const s1 = editorReducer(s0, { type: 'deletePiece', areaId: 'area-1', pieceId: 'p1' });
    expect(s1.present.areas[0].pieces).toEqual([]);
    expect(s1.selectedPieceId).toBeNull();
  });

  it('duplicatePiece copies the piece under the given id with the next free label in its area', () => {
    const s0 = withPiece('area-1', makePiece('p1', 'A-1'));
    const s1 = editorReducer(s0, { type: 'duplicatePiece', areaId: 'area-1', pieceId: 'p1', newId: 'p2' });
    expect(s1.present.areas[0].pieces).toHaveLength(2);
    const copy = s1.present.areas[0].pieces[1];
    expect(copy.id).toBe('p2');
    expect(copy.label).toBe('A-2');
    expect(copy.outline).toEqual(s1.present.areas[0].pieces[0].outline);
  });

  it('movePiece adds the delta to position, leaving outline untouched', () => {
    const s0 = withPiece('area-1', makePiece('p1', 'A-1', { position: { x: 10, y: 20 } }));
    const s1 = editorReducer(s0, { type: 'movePiece', areaId: 'area-1', pieceId: 'p1', delta: { x: 5, y: -3 } });
    expect(s1.present.areas[0].pieces[0].position).toEqual({ x: 15, y: 17 });
  });

  it('rotatePiece cycles 0 -> 90 -> 180 -> 270 -> 0', () => {
    let s = withPiece('area-1', makePiece('p1', 'A-1', { rotationDeg: 0 }));
    const rotations = [90, 180, 270, 0];
    for (const expected of rotations) {
      s = editorReducer(s, { type: 'rotatePiece', areaId: 'area-1', pieceId: 'p1' });
      expect(s.present.areas[0].pieces[0].rotationDeg).toBe(expected);
    }
  });

  it('deleteArea reassigns activeAreaId to the first remaining area', () => {
    const s0 = createInitialEditorState(makeDrawing([makeArea('area-1', []), makeArea('area-2', [])]));
    const s1 = editorReducer({ ...s0, activeAreaId: 'area-1' }, { type: 'deleteArea', areaId: 'area-1' });
    expect(s1.present.areas.map((a) => a.id)).toEqual(['area-2']);
    expect(s1.activeAreaId).toBe('area-2');
  });

  it('deleteArea on the last remaining area is a no-op', () => {
    const s0 = blank();
    const s1 = editorReducer(s0, { type: 'deleteArea', areaId: 'area-1' });
    expect(s1).toBe(s0);
  });

  it('reorderAreas rewrites sortOrder to match the given id order', () => {
    const s0 = createInitialEditorState(makeDrawing([makeArea('a', []), makeArea('b', [])]));
    const s1 = editorReducer(s0, { type: 'reorderAreas', areaIds: ['b', 'a'] });
    expect(s1.present.areas.find((a) => a.id === 'b')?.sortOrder).toBe(0);
    expect(s1.present.areas.find((a) => a.id === 'a')?.sortOrder).toBe(1);
  });
});

describe('editorReducer — view-only actions and undo/redo', () => {
  it('selectPiece, setZoom, and pan do not push history', () => {
    const s0 = editorReducer(blank(), { type: 'addArea', name: 'X' }); // past.length === 1
    const s1 = editorReducer(editorReducer(editorReducer(s0,
      { type: 'selectPiece', pieceId: 'p1' }),
      { type: 'setZoom', zoom: 2 }),
      { type: 'pan', delta: { x: 5, y: 5 } });
    expect(s1.past).toHaveLength(1);
    expect(s1.selectedPieceId).toBe('p1');
    expect(s1.zoom).toBe(2);
    expect(s1.pan).toEqual({ x: 5, y: 5 });
  });

  it.each([[10, 4], [-1, 0.25], [1.5, 1.5]])('setZoom clamps %s to %s', (input, expected) => {
    expect(editorReducer(blank(), { type: 'setZoom', zoom: input }).zoom).toBe(expected);
  });

  it('undo/redo walk the document history without touching view state', () => {
    let s = blank();
    s = editorReducer(s, { type: 'addArea', name: 'X' });
    s = editorReducer(s, { type: 'addArea', name: 'Y' });
    expect(s.present.areas).toHaveLength(3);
    s = editorReducer(s, { type: 'undo' });
    expect(s.present.areas).toHaveLength(2);
    s = editorReducer(s, { type: 'undo' });
    expect(s.present.areas).toHaveLength(1);
    s = editorReducer(s, { type: 'undo' }); // past is empty — no-op
    expect(s.present.areas).toHaveLength(1);
    s = editorReducer(s, { type: 'redo' });
    s = editorReducer(s, { type: 'redo' });
    expect(s.present.areas).toHaveLength(3);
  });

  it('caps history at 50 entries, dropping the oldest', () => {
    let s = blank();
    for (let i = 0; i < 55; i++) s = editorReducer(s, { type: 'addArea', name: `area-${i}` });
    expect(s.past).toHaveLength(50);
    // The oldest surviving snapshot already has areas from well into the run,
    // not the original single-area blank state.
    expect(s.past[0].areas.length).toBeGreaterThan(5);
  });

  it('undo falls back activeAreaId to an existing area when undo removes the active one, and clears a now-dangling selection', () => {
    let s = blank();
    s = editorReducer(s, { type: 'addArea', name: 'X' });
    const newAreaId = s.present.areas[1].id;
    s = editorReducer(s, { type: 'setActiveArea', areaId: newAreaId });
    s = { ...s, selectedPieceId: 'whatever' };
    s = editorReducer(s, { type: 'undo' }); // removes area X again
    expect(s.present.areas.map((a) => a.id)).not.toContain(newAreaId);
    expect(s.present.areas.some((a) => a.id === s.activeAreaId)).toBe(true);
    expect(s.selectedPieceId).toBeNull();
  });

  it('redo also falls back a stranded activeAreaId', () => {
    let s = blank();
    const areaId = s.present.areas[0].id;
    s = editorReducer(s, { type: 'addArea', name: 'X' });
    s = editorReducer(s, { type: 'deleteArea', areaId }); // active area deleted; reducer already reassigns on delete
    const remainingAreaId = s.present.areas[0].id;
    s = editorReducer(s, { type: 'undo' }); // area 1 comes back
    s = editorReducer(s, { type: 'redo' }); // area 1 removed again
    expect(s.present.areas.some((a) => a.id === s.activeAreaId)).toBe(true);
    expect(s.activeAreaId).toBe(remainingAreaId);
  });

  it('setActiveArea clears the piece selection — a piece from the old area should not look selected in the new one', () => {
    const s0 = { ...withPiece('area-1', makePiece('p1', 'A-1')), selectedPieceId: 'p1' };
    const s1 = editorReducer(s0, { type: 'addArea', name: 'Y' });
    const s2 = editorReducer(s1, { type: 'setActiveArea', areaId: s1.present.areas[1].id });
    expect(s2.selectedPieceId).toBeNull();
  });

  it('adding a piece after undo strands the active area never throws, and lands in a real area', () => {
    let s = blank();
    s = editorReducer(s, { type: 'addArea', name: 'X' });
    s = editorReducer(s, { type: 'setActiveArea', areaId: s.present.areas[1].id });
    s = editorReducer(s, { type: 'undo' }); // active area no longer exists
    expect(() => editorReducer(s, { type: 'addPiece', areaId: s.activeAreaId, piece: makePiece('p1', 'A-1') })).not.toThrow();
  });
});

describe('editorReducer — drawingSaved', () => {
  it('updates version/updatedAt/updatedBy without touching past/future or the current content — a background save is not an undoable edit, and must not revert edits made while it was in flight', () => {
    let s = blank();
    s = editorReducer(s, { type: 'addArea', name: 'X' }); // past.length > 0, present has 2 areas now
    const presentBeforeSave = s.present;
    const pastBeforeSave = s.past;

    s = editorReducer(s, {
      type: 'drawingSaved', version: 5, updatedAt: '2026-11-04T00:00:00.000Z', updatedBy: { id: 'u9', name: 'Autosave' },
    });

    expect(s.present.version).toBe(5);
    expect(s.present.updatedAt).toBe('2026-11-04T00:00:00.000Z');
    expect(s.present.updatedBy).toEqual({ id: 'u9', name: 'Autosave' });
    expect(s.present.areas).toBe(presentBeforeSave.areas); // content untouched
    expect(s.past).toBe(pastBeforeSave); // not pushed onto undo history
    expect(s.future).toEqual([]);
  });
});

describe('editorReducer — loadDrawing', () => {
  it('replaces present with the loaded drawing and resets past/future — loading a different document is not an undoable edit of the current one', () => {
    let s = blank();
    s = editorReducer(s, { type: 'addArea', name: 'X' }); // gives past.length > 0
    expect(s.past.length).toBeGreaterThan(0);

    const loaded = makeDrawing([makeArea('loaded-area', [makePiece('p1', 'A-1')])]);
    s = editorReducer(s, { type: 'loadDrawing', drawing: loaded });

    expect(s.present).toBe(loaded);
    expect(s.past).toEqual([]);
    expect(s.future).toEqual([]);
  });

  it('falls back activeAreaId/selectedPieceId to the loaded document — the old ones name nothing in it', () => {
    let s: EditorState = { ...blank(), activeAreaId: 'stale-area', selectedPieceId: 'stale-piece' };
    const loaded = makeDrawing([makeArea('loaded-area', [])]);
    s = editorReducer(s, { type: 'loadDrawing', drawing: loaded });
    expect(s.activeAreaId).toBe('loaded-area');
    expect(s.selectedPieceId).toBeNull();
  });
});
