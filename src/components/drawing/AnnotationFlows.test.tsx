// @vitest-environment jsdom
// Phase 5: placing, editing and removing notes and manual dimensions.

import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Drawing } from '@/types/drawing';
import { rectOutline } from '@/lib/drawing/geometry';
import { AnnotationPanel } from './AnnotationPanel';
import { DrawingCanvas } from './DrawingCanvas';
import { DrawingEditorProvider, useDrawingEditor } from './DrawingEditorContext';

const drawing: Drawing = {
  schemaVersion: 1, salesOrderId: 'so1', version: 0, displayUnit: 'mm', fractionDenominator: 32,
  areas: [{
    id: 'a', name: 'A', code: '', sortOrder: 0, cabinets: [], notes: [],
    pieces: [{
      id: 'p1', label: 'A-1', shape: 'rect', outline: rectOutline(1000, 500), position: { x: 0, y: 0 },
      rotationDeg: 0, thicknessMm: 30, edges: [], seams: [], cutouts: [],
    }],
  }],
  updatedAt: '', updatedBy: { id: 'u1', name: 'T' },
};

function Readout() {
  const { state } = useDrawingEditor();
  const area = state.present.areas[0];
  return <span data-testid="annotations">{JSON.stringify({ notes: area.notes, dimensions: area.dimensions ?? [] })}</span>;
}

const annotations = () => JSON.parse(screen.getByTestId('annotations').textContent ?? '{}');
const background = () => screen.getByTestId('canvas-background');

function open() {
  vi.spyOn(SVGElement.prototype, 'getBoundingClientRect').mockReturnValue({
    left: 0, top: 0, width: 800, height: 600, right: 800, bottom: 600, x: 0, y: 0, toJSON: () => undefined,
  } as DOMRect);
  render(
    <DrawingEditorProvider drawing={drawing} materialLines={[]}>
      <AnnotationPanel />
      <DrawingCanvas />
      <Readout />
    </DrawingEditorProvider>,
  );
  return userEvent.setup();
}

afterEach(() => vi.restoreAllMocks());

describe('notes', () => {
  it('places a note where the canvas was clicked, edits its text and deletes it', async () => {
    const user = open();
    await user.click(screen.getByRole('button', { name: 'Add note' }));
    fireEvent.pointerDown(background(), { clientX: 500, clientY: 250 }); // world (100, 50)
    expect(annotations().notes).toEqual([expect.objectContaining({ text: 'Note', at: { x: 100, y: 50 } })]);
    expect(screen.getByRole('button', { name: 'Add note' }).getAttribute('aria-pressed')).toBe('false');

    const field = screen.getByLabelText('Note text');
    await user.clear(field);
    await user.type(field, 'Seam here');
    await user.tab();
    expect(annotations().notes[0].text).toBe('Seam here');

    await user.click(screen.getByRole('button', { name: 'Delete note Seam here' }));
    expect(annotations().notes).toEqual([]);
  });

  it('refuses to save an empty note', async () => {
    const user = open();
    await user.click(screen.getByRole('button', { name: 'Add note' }));
    fireEvent.pointerDown(background(), { clientX: 400, clientY: 300 });
    await user.clear(screen.getByLabelText('Note text'));
    await user.tab();
    expect(screen.getByRole('alert').textContent).toContain('needs some text');
    expect(annotations().notes[0].text).toBe('Note');
  });
});

describe('manual dimensions', () => {
  it('measures between two clicks, snapping to piece corners', async () => {
    const user = open();
    await user.click(screen.getByRole('button', { name: 'Add dimension' }));
    fireEvent.pointerDown(background(), { clientX: 403, clientY: 302 }); // near corner (0,0)
    expect(annotations().dimensions).toEqual([]);
    fireEvent.pointerDown(background(), { clientX: 1398, clientY: 301 }); // world (998, -1), near corner (1000, 0)
    const [dim] = annotations().dimensions;
    expect(dim.from).toEqual({ x: 0, y: 0 });
    expect(dim.to).toEqual({ x: 1000, y: 0 });
    expect(screen.getByText(/Dimension 1:/)).toBeTruthy();
  });

  it('flips the side and deletes', async () => {
    const user = open();
    await user.click(screen.getByRole('button', { name: 'Add dimension' }));
    fireEvent.pointerDown(background(), { clientX: 400, clientY: 300 });
    fireEvent.pointerDown(background(), { clientX: 600, clientY: 300 });
    const before = annotations().dimensions[0];
    await user.click(screen.getByRole('button', { name: 'Flip Dimension 1 to the other side' }));
    const after = annotations().dimensions[0];
    expect([after.from, after.to]).toEqual([before.to, before.from]);
    await user.click(screen.getByRole('button', { name: 'Delete Dimension 1' }));
    expect(annotations().dimensions).toEqual([]);
  });
});
