// @vitest-environment jsdom
// The corner map: drag or click to move the view, scroll to zoom, arrow keys,
// and the ✕ / "Map" show-hide. Runs on the real reducer; the canvas is not
// rendered, only the map inside a stand-in canvas container measured at
// 800x600, with the map box itself at its true 176x112.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Drawing } from '@/types/drawing';
import { fitExtent, mapExtent, piecesBounds, viewportRect } from '@/lib/drawing/minimap';
import { DrawingEditorProvider, useDrawingEditor } from './DrawingEditorContext';
import { MiniMap } from './MiniMap';

const CANVAS = { width: 800, height: 600 };
const MAP = { width: 176, height: 112 };

const drawing: Drawing = {
  schemaVersion: 1, salesOrderId: 's', version: 0, displayUnit: 'in', fractionDenominator: 32,
  areas: [{
    id: 'a', name: 'A', code: '', sortOrder: 0, cabinets: [], notes: [],
    pieces: [{
      id: 'p1', label: 'A-1', shape: 'rect',
      outline: [{ x: 0, y: 0 }, { x: 600, y: 0 }, { x: 600, y: -400 }, { x: 0, y: -400 }],
      position: { x: 0, y: 0 }, rotationDeg: 0, thicknessMm: 30, edges: [], seams: [], cutouts: [],
    }],
  }],
  updatedAt: '', updatedBy: { id: 'u', name: 'U' },
};

function Readout() {
  const { state } = useDrawingEditor();
  return (
    <div>
      <span data-testid="pan-x">{state.pan.x}</span>
      <span data-testid="pan-y">{state.pan.y}</span>
      <span data-testid="zoom">{state.zoom}</span>
      <span data-testid="history">{state.past.length}</span>
    </div>
  );
}

function MapSwitch() {
  const { toggleMap } = useDrawingEditor();
  return <button type="button" onClick={toggleMap}>switch map</button>;
}

const num = (id: string) => Number(screen.getByTestId(id).textContent);

/** The point of the drawing the canvas currently has in its middle. */
const centre = () => ({ x: -num('pan-x') / num('zoom'), y: num('pan-y') / num('zoom') });

/** Where, in the map box, a drawing point sits while the view is at rest. */
function boxPoint(world: { x: number; y: number }, view = viewportRect({ x: 0, y: 0 }, 1, CANVAS.width, CANVAS.height)) {
  const fit = fitExtent(mapExtent(piecesBounds(drawing.areas[0].pieces), view), MAP.width, MAP.height);
  return {
    clientX: (world.x - fit.extent.minX) * fit.scale + fit.offsetX,
    clientY: (fit.extent.maxY - world.y) * fit.scale + fit.offsetY,
    fit,
  };
}

function open() {
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
    const size = this.tagName.toLowerCase() === 'svg' ? MAP : CANVAS;
    return { left: 0, top: 0, right: size.width, bottom: size.height, x: 0, y: 0, ...size, toJSON: () => undefined } as DOMRect;
  });
  render(
    <DrawingEditorProvider drawing={drawing} materialLines={[]}>
      <div>
        <MiniMap />
      </div>
      <Readout />
      <MapSwitch />
    </DrawingEditorProvider>,
  );
}

const map = () => screen.getByTestId('minimap');

beforeEach(() => {
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => { cb(0); return 1; });
  vi.stubGlobal('cancelAnimationFrame', () => undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('MiniMap', () => {
  it('shows the drawing and a box for what the canvas is looking at', () => {
    open();
    expect(screen.getByRole('region', { name: 'Drawing map' })).toBeTruthy();
    expect(map().querySelectorAll('polygon')).toHaveLength(1);
    expect(screen.getByTestId('minimap-view')).toBeTruthy();
  });

  it('the view box follows pan and zoom', () => {
    open();
    const before = Number(screen.getByTestId('minimap-view').getAttribute('width'));
    fireEvent.keyDown(map(), { key: '+' });
    // Zoomed in: the canvas sees less, so its box on the map is narrower.
    expect(Number(screen.getByTestId('minimap-view').getAttribute('width'))).toBeLessThan(before);
  });

  it('clicking the map centres the canvas on the spot clicked', () => {
    open();
    const target = { x: 600, y: -200 };
    const { clientX, clientY } = boxPoint(target);
    fireEvent.pointerDown(map(), { pointerId: 1, button: 0, clientX, clientY });
    fireEvent.pointerUp(map(), { pointerId: 1, button: 0, clientX, clientY });
    expect(centre().x).toBeCloseTo(target.x, 3);
    expect(centre().y).toBeCloseTo(target.y, 3);
  });

  it('dragging the view box carries it along without jumping it onto the pointer', () => {
    open();
    // Grab the box off-centre at (100,100), then drag 200mm to the right.
    const grab = boxPoint({ x: 100, y: 100 });
    const to = boxPoint({ x: 300, y: 100 });
    fireEvent.pointerDown(map(), { pointerId: 1, button: 0, clientX: grab.clientX, clientY: grab.clientY });
    fireEvent.pointerMove(map(), { pointerId: 1, clientX: to.clientX, clientY: to.clientY });
    fireEvent.pointerUp(map(), { pointerId: 1, button: 0, clientX: to.clientX, clientY: to.clientY });
    expect(centre().x).toBeCloseTo(200, 3);
    expect(centre().y).toBeCloseTo(0, 3);
  });

  it('keeps the map still while dragging, so it does not rescale under the pointer', () => {
    open();
    const grab = boxPoint({ x: 100, y: 100 });
    const far = boxPoint({ x: 400, y: 100 });
    fireEvent.pointerDown(map(), { pointerId: 1, button: 0, clientX: grab.clientX, clientY: grab.clientY });
    const polygonBefore = map().querySelector('g')?.getAttribute('transform');
    fireEvent.pointerMove(map(), { pointerId: 1, clientX: far.clientX, clientY: far.clientY });
    expect(map().querySelector('g')?.getAttribute('transform')).toBe(polygonBefore);
    fireEvent.pointerUp(map(), { pointerId: 1, button: 0, clientX: far.clientX, clientY: far.clientY });
  });

  it('ignores a right-click', () => {
    open();
    const { clientX, clientY } = boxPoint({ x: 600, y: -200 });
    fireEvent.pointerDown(map(), { pointerId: 1, button: 2, clientX, clientY });
    fireEvent.pointerUp(map(), { pointerId: 1, button: 2, clientX, clientY });
    expect(centre()).toEqual({ x: -0, y: 0 });
  });

  it('scrolling over the map zooms the drawing about its centre', () => {
    open();
    fireEvent.pointerDown(map(), { pointerId: 1, button: 0, ...boxPoint({ x: 600, y: -200 }) });
    fireEvent.pointerUp(map(), { pointerId: 1, button: 0, ...boxPoint({ x: 600, y: -200 }) });
    const before = centre();
    fireEvent.wheel(screen.getByRole('region', { name: 'Drawing map' }), { deltaY: -100 });
    expect(num('zoom')).toBeGreaterThan(1);
    expect(centre().x).toBeCloseTo(before.x, 3);
    expect(centre().y).toBeCloseTo(before.y, 3);
    fireEvent.wheel(screen.getByRole('region', { name: 'Drawing map' }), { deltaY: 100 });
    expect(num('zoom')).toBeCloseTo(1.25 * 0.75, 6);
  });

  it('the wheel does not also scroll the page behind the map', () => {
    open();
    const wheel = new WheelEvent('wheel', { deltaY: -100, bubbles: true, cancelable: true });
    screen.getByRole('region', { name: 'Drawing map' }).dispatchEvent(wheel);
    expect(wheel.defaultPrevented).toBe(true);
  });

  it('arrow keys move the view by a tenth of what is visible', () => {
    open();
    fireEvent.keyDown(map(), { key: 'ArrowRight' });
    expect(centre().x).toBeCloseTo(80, 6); // 800mm visible -> 80mm
    fireEvent.keyDown(map(), { key: 'ArrowUp' });
    expect(centre().y).toBeCloseTo(80, 6);
  });

  it('is only a view: moving around never touches the undo history', () => {
    open();
    fireEvent.keyDown(map(), { key: 'ArrowLeft' });
    fireEvent.wheel(screen.getByRole('region', { name: 'Drawing map' }), { deltaY: -100 });
    expect(num('history')).toBe(0);
  });

  it('closes with the ✕, and the shared switch brings it back', async () => {
    open();
    await userEvent.click(screen.getByRole('button', { name: 'Close map' }));
    expect(screen.queryByRole('region', { name: 'Drawing map' })).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'switch map' }));
    expect(screen.getByRole('region', { name: 'Drawing map' })).toBeTruthy();
  });

  it('sits in the bottom-right corner', () => {
    open();
    const corner = screen.getByRole('region', { name: 'Drawing map' }).parentElement;
    expect(corner?.className).toContain('right-3');
    expect(corner?.className).toContain('bottom-3');
  });
});
