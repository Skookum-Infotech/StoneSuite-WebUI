// @vitest-environment jsdom
// Scroll-wheel zoom on the canvas happens at the mouse pointer: the point of
// the drawing under the pointer stays under it. The SVG renders at its 800x600
// viewBox here, so 1px = 1mm at zoom 1 with the world origin at pixel (400,300).

import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type { Drawing } from '@/types/drawing';
import { DrawingCanvas } from './DrawingCanvas';
import { DrawingEditorProvider, useDrawingEditor } from './DrawingEditorContext';

const drawing: Drawing = {
  schemaVersion: 1, salesOrderId: 's', version: 0, displayUnit: 'in', fractionDenominator: 32,
  areas: [{ id: 'a', name: 'A', code: '', sortOrder: 0, pieces: [], cabinets: [], notes: [] }],
  updatedAt: '', updatedBy: { id: 'u', name: 'U' },
};

function Readout() {
  const { state, mapOpen } = useDrawingEditor();
  return (
    <div>
      <span data-testid="zoom">{state.zoom}</span>
      <span data-testid="pan-x">{state.pan.x}</span>
      <span data-testid="pan-y">{state.pan.y}</span>
      <span data-testid="map">{String(mapOpen)}</span>
    </div>
  );
}

function open() {
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue({
    left: 0, top: 0, width: 800, height: 600, right: 800, bottom: 600, x: 0, y: 0, toJSON: () => undefined,
  } as DOMRect);
  render(
    <DrawingEditorProvider drawing={drawing} materialLines={[]}>
      <DrawingCanvas />
      <Readout />
    </DrawingEditorProvider>,
  );
  return screen.getByRole('application', { name: 'Drawing canvas' });
}

const num = (id: string) => Number(screen.getByTestId(id).textContent);

afterEach(() => vi.restoreAllMocks());

describe('DrawingCanvas wheel zoom', () => {
  it('zooming in at the middle of the canvas leaves the view where it was', () => {
    const canvas = open();
    fireEvent.wheel(canvas, { deltaY: -100, clientX: 400, clientY: 300 });
    expect(num('zoom')).toBeCloseTo(1.25, 9);
    expect(num('pan-x')).toBeCloseTo(0, 9);
    expect(num('pan-y')).toBeCloseTo(0, 9);
  });

  it('zooming in at a point keeps the drawing under the pointer put', () => {
    const canvas = open();
    // Pointer at pixel (600,200) -> drawing point (200mm, 100mm).
    fireEvent.wheel(canvas, { deltaY: -100, clientX: 600, clientY: 200 });
    const zoom = num('zoom');
    // Where that drawing point is drawn now, relative to the canvas middle.
    const screenX = num('pan-x') + zoom * 200;
    const screenY = num('pan-y') - zoom * 100;
    expect(screenX).toBeCloseTo(600 - 400, 9);
    expect(screenY).toBeCloseTo(200 - 300, 9);
  });

  it('zooming out at a point keeps it put too, and zooming back returns to the start', () => {
    const canvas = open();
    fireEvent.wheel(canvas, { deltaY: -100, clientX: 600, clientY: 200 });
    const zoomedIn = num('zoom');
    fireEvent.wheel(canvas, { deltaY: 100, clientX: 600, clientY: 200 });
    expect(num('zoom')).toBeCloseTo(zoomedIn * 0.75, 9);
    expect(num('pan-x') + num('zoom') * 200).toBeCloseTo(200, 9);
  });

  it('keeps the pointer point put when the pan has already moved', () => {
    const canvas = open();
    fireEvent.wheel(canvas, { deltaY: -100, clientX: 100, clientY: 500 });
    fireEvent.wheel(canvas, { deltaY: -100, clientX: 700, clientY: 100 });
    // Whatever was under (700,100) is still there: it is at +300,-200 from the middle.
    const zoom = num('zoom');
    const before = { x: (300 - num('pan-x')) / zoom, y: -(-200 - num('pan-y')) / zoom };
    fireEvent.wheel(canvas, { deltaY: -100, clientX: 700, clientY: 100 });
    expect(num('pan-x') + num('zoom') * before.x).toBeCloseTo(300, 6);
    expect(num('pan-y') - num('zoom') * before.y).toBeCloseTo(-200, 6);
  });
});

describe('DrawingCanvas map key', () => {
  it('M shows and hides the map', () => {
    const canvas = open();
    expect(screen.getByTestId('map').textContent).toBe('true');
    fireEvent.keyDown(canvas, { key: 'm' });
    expect(screen.getByTestId('map').textContent).toBe('false');
    fireEvent.keyDown(canvas, { key: 'm' });
    expect(screen.getByTestId('map').textContent).toBe('true');
  });
});
