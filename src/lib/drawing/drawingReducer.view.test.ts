import { describe, expect, it } from 'vitest';
import type { Drawing } from '@/types/drawing';
import { ZOOM_MAX, ZOOM_MIN } from './constants';
import { createInitialEditorState, editorReducer } from './drawingReducer';

const drawing: Drawing = {
  schemaVersion: 1, salesOrderId: 's', version: 0, displayUnit: 'in', fractionDenominator: 32,
  areas: [{ id: 'a', name: 'A', code: '', sortOrder: 0, pieces: [], cabinets: [], notes: [] }],
  updatedAt: '', updatedBy: { id: 'u', name: 'U' },
};

const start = () => createInitialEditorState(drawing);

/** The drawing point in the middle of the canvas, per the canvas's own transform. */
const centerOf = (s: { pan: { x: number; y: number }; zoom: number }) => ({ x: -s.pan.x / s.zoom, y: s.pan.y / s.zoom });

describe('centerView', () => {
  it.each([
    { name: 'the origin', center: { x: 0, y: 0 }, zoom: 1 },
    { name: 'a point to the right and below', center: { x: 600, y: -200 }, zoom: 1 },
    { name: 'the same point while zoomed in', center: { x: 600, y: -200 }, zoom: 2 },
  ])('puts $name in the middle of the canvas', ({ center, zoom }) => {
    const state = editorReducer({ ...start(), zoom }, { type: 'centerView', center });
    expect(centerOf(state).x).toBeCloseTo(center.x, 9);
    expect(centerOf(state).y).toBeCloseTo(center.y, 9);
    expect(state.zoom).toBe(zoom);
  });

  it('is absolute: doing it twice lands in the same place', () => {
    const once = editorReducer(start(), { type: 'centerView', center: { x: 300, y: 100 } });
    const twice = editorReducer(once, { type: 'centerView', center: { x: 300, y: 100 } });
    expect(twice.pan).toEqual(once.pan);
  });

  it('is not an edit: nothing lands in the undo history', () => {
    const state = editorReducer(start(), { type: 'centerView', center: { x: 300, y: 100 } });
    expect(state.past).toHaveLength(0);
    expect(state.present).toBe(drawing);
  });
});

describe('zoomView', () => {
  it('zooms about the middle of the canvas, so what is there stays there', () => {
    const moved = editorReducer(start(), { type: 'centerView', center: { x: 600, y: -200 } });
    const zoomed = editorReducer(moved, { type: 'zoomView', factor: 1.25 });
    expect(zoomed.zoom).toBeCloseTo(1.25, 9);
    expect(centerOf(zoomed).x).toBeCloseTo(600, 9);
    expect(centerOf(zoomed).y).toBeCloseTo(-200, 9);
  });

  it.each([
    { name: 'in past the maximum', factor: 100, expected: ZOOM_MAX },
    { name: 'out past the minimum', factor: 0.001, expected: ZOOM_MIN },
  ])('stops zooming $name', ({ factor, expected }) => {
    expect(editorReducer(start(), { type: 'zoomView', factor }).zoom).toBe(expected);
  });
});
