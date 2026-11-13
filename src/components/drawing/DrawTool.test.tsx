// @vitest-environment jsdom
// The Draw tool end to end: the pencil on the rail, the Draw / Square bar,
// click-to-drop a default square, and dragging a side to resize it. Runs on a
// real reducer so assertions are on the document, not on dispatch mocks. The
// SVG is mocked to render at its 800x600 viewBox, so 1px = 1mm at zoom 1 with
// the world origin at pixel (400,300).

import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Drawing } from '@/types/drawing';
import { DEFAULT_DRAW_DEPTH_MM, DEFAULT_DRAW_LENGTH_MM, DRAW_RESIZE_STEP_MM } from '@/lib/drawing/constants';
import { DrawModeBar } from './DrawModeBar';
import { DrawingCanvas } from './DrawingCanvas';
import { DrawingEditorProvider, useDrawingEditor } from './DrawingEditorContext';
import { ToolRail } from './ToolRail';

vi.mock('@/services/drawingService', () => ({
  drawingService: { getEdgeCodes: vi.fn().mockResolvedValue([]) },
}));
const toastError = vi.hoisted(() => vi.fn());
vi.mock('sonner', () => ({ toast: { error: toastError, success: vi.fn() } }));

const ORIGIN_X = 400;
const ORIGIN_Y = 300;
const RIGHT_SIDE = 1;
const LEFT_SIDE = 3;
const PRIMARY = 0;
const SECONDARY = 2;

function drawing(withPiece: boolean): Drawing {
  return {
    schemaVersion: 1, salesOrderId: 'so1', version: 0, displayUnit: 'in', fractionDenominator: 32,
    areas: [{
      id: 'area-1', name: 'Area 1', code: '', sortOrder: 0, cabinets: [], notes: [],
      pieces: withPiece ? [{
        id: 'p1', label: 'A-1', shape: 'rect',
        outline: [{ x: 0, y: 0 }, { x: 600, y: 0 }, { x: 600, y: -400 }, { x: 0, y: -400 }],
        position: { x: 0, y: 0 }, rotationDeg: 0, thicknessMm: 30, edges: [], seams: [], cutouts: [],
      }] : [],
    }],
    updatedAt: '', updatedBy: { id: 'u', name: 'U' },
  };
}

function Readout() {
  const { state, tool } = useDrawingEditor();
  const pieces = state.present.areas[0].pieces;
  return (
    <div>
      <span data-testid="tool">{tool}</span>
      <span data-testid="count">{pieces.length}</span>
      <span data-testid="history">{state.past.length}</span>
      <span data-testid="pieces">{JSON.stringify(pieces)}</span>
    </div>
  );
}

function pieces(): Array<{ outline: Array<{ x: number; y: number }>; position: { x: number; y: number }; label: string }> {
  return JSON.parse(screen.getByTestId('pieces').textContent ?? '[]');
}

async function open(withPiece: boolean) {
  vi.spyOn(SVGElement.prototype, 'getBoundingClientRect').mockReturnValue({
    left: 0, top: 0, width: 800, height: 600, right: 800, bottom: 600, x: 0, y: 0, toJSON: () => undefined,
  } as DOMRect);
  render(
    <DrawingEditorProvider drawing={drawing(withPiece)} materialLines={[]}>
      <ToolRail />
      <DrawingCanvas />
      <DrawModeBar />
      <Readout />
    </DrawingEditorProvider>,
  );
  await userEvent.click(screen.getByRole('button', { name: 'Draw' }));
}

/** A press-release at world (x, y) on the tool's click sheet. */
function click(worldX: number, worldY: number, button = PRIMARY) {
  const sheet = screen.getByTestId('tool-capture');
  const at = { pointerId: 1, button, clientX: ORIGIN_X + worldX, clientY: ORIGIN_Y - worldY };
  fireEvent.pointerDown(sheet, at);
  fireEvent.pointerUp(sheet, at);
}

/** Drags a side's grab strip by (dx, dy) pixels from its middle. */
function dragSide(index: number, dx: number, dy: number, button = PRIMARY) {
  const grab = screen.getByTestId(`edge-grab-A-1-${index}`);
  const from = index === RIGHT_SIDE
    ? { clientX: ORIGIN_X + 600, clientY: ORIGIN_Y + 200 }
    : { clientX: ORIGIN_X, clientY: ORIGIN_Y + 200 };
  fireEvent.pointerDown(grab, { pointerId: 1, button, ...from });
  fireEvent.pointerMove(grab, { pointerId: 1, clientX: from.clientX + dx, clientY: from.clientY + dy });
  return {
    release: () => fireEvent.pointerUp(grab, { pointerId: 1, clientX: from.clientX + dx, clientY: from.clientY + dy }),
  };
}

afterEach(() => {
  vi.restoreAllMocks();
  toastError.mockClear();
});

describe('Draw tool — rail and mode bar', () => {
  it('the pencil arms the Draw tool and shows the Draw bar with Square selected', async () => {
    await open(false);
    expect(screen.getByTestId('tool').textContent).toBe('draw');
    const bar = screen.getByRole('group', { name: 'Draw mode' });
    expect(bar.textContent).toContain('Draw');
    expect(screen.getByRole('button', { name: 'Square' }).getAttribute('aria-pressed')).toBe('true');
  });

  it('Circle and Points are present but disabled until they are built', async () => {
    await open(false);
    expect((screen.getByRole('button', { name: 'Circle' }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole('button', { name: 'Points' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('the pencil toggles the tool off again and hides the bar', async () => {
    await open(false);
    await userEvent.click(screen.getByRole('button', { name: 'Draw' }));
    expect(screen.getByTestId('tool').textContent).toBe('select');
    expect(screen.queryByRole('group', { name: 'Draw mode' })).toBeNull();
  });
});

describe('Draw tool — click to drop a square', () => {
  it('drops a 25 5/8" x 25 1/2" square centred on the click and stays armed', async () => {
    await open(false);
    click(0, 0);
    const [piece] = pieces();
    expect(pieces()).toHaveLength(1);
    expect(piece.outline[1].x - piece.outline[0].x).toBeCloseTo(DEFAULT_DRAW_LENGTH_MM, 6);
    expect(piece.outline[0].y - piece.outline[3].y).toBeCloseTo(DEFAULT_DRAW_DEPTH_MM, 6);
    // Centred on the click (to within the 1/16" the position snaps to).
    const centreX = piece.position.x + DEFAULT_DRAW_LENGTH_MM / 2;
    const centreY = piece.position.y - DEFAULT_DRAW_DEPTH_MM / 2;
    expect(Math.abs(centreX)).toBeLessThanOrEqual(DRAW_RESIZE_STEP_MM);
    expect(Math.abs(centreY)).toBeLessThanOrEqual(DRAW_RESIZE_STEP_MM);
    expect(screen.getByTestId('tool').textContent).toBe('draw');
  });

  it('places a second square with the next label', async () => {
    await open(false);
    click(0, 0);
    click(2000, 0);
    expect(pieces().map((p) => p.label)).toEqual(['A-1', 'A-2']);
  });

  it('each square is one undo step', async () => {
    await open(false);
    click(0, 0);
    expect(screen.getByTestId('history').textContent).toBe('1');
  });

  it('a right-click does not drop a square', async () => {
    await open(false);
    click(0, 0, SECONDARY);
    expect(pieces()).toHaveLength(0);
  });

  it('a click on an existing piece does not stack another square on it', async () => {
    await open(true);
    click(300, -200);
    expect(pieces()).toHaveLength(1);
  });

  it('a drag pans the canvas instead of dropping a square', async () => {
    await open(false);
    const sheet = screen.getByTestId('tool-capture');
    fireEvent.pointerDown(sheet, { pointerId: 1, button: PRIMARY, clientX: 100, clientY: 100 });
    fireEvent.pointerMove(sheet, { pointerId: 1, clientX: 160, clientY: 100, movementX: 60, movementY: 0 });
    fireEvent.pointerUp(sheet, { pointerId: 1, button: PRIMARY, clientX: 160, clientY: 100 });
    expect(pieces()).toHaveLength(0);
  });
});

describe('Draw tool — drag a side to resize', () => {
  it('pulling the right side out grows the piece in 1/16" steps and leaves the left side put', async () => {
    await open(true);
    dragSide(RIGHT_SIDE, 50, 0).release();
    const [{ outline }] = pieces();
    expect(outline[0].x).toBe(0);
    expect(outline[3].x).toBe(0);
    expect(outline[1].x).toBe(outline[2].x);
    const grew = outline[1].x - 600;
    expect(grew).toBeGreaterThan(0);
    expect(Math.abs(grew - 50)).toBeLessThanOrEqual(DRAW_RESIZE_STEP_MM / 2 + 1e-9);
    expect(Math.abs(grew / DRAW_RESIZE_STEP_MM - Math.round(grew / DRAW_RESIZE_STEP_MM))).toBeLessThan(1e-9);
  });

  it('pushing the left side in shrinks the piece from the left', async () => {
    await open(true);
    dragSide(LEFT_SIDE, 100, 0).release();
    const [{ outline }] = pieces();
    expect(outline[1].x).toBe(600);
    expect(outline[2].x).toBe(600);
    expect(outline[0].x).toBeGreaterThan(98);
    expect(outline[0].x).toBeLessThan(102);
  });

  it('works with the right mouse button held, too', async () => {
    await open(true);
    dragSide(RIGHT_SIDE, 50, 0, SECONDARY).release();
    expect(pieces()[0].outline[1].x).toBeGreaterThan(640);
  });

  it('shows the resized piece while dragging but saves only on release, as one undo step', async () => {
    await open(true);
    const drag = dragSide(RIGHT_SIDE, 50, 0);
    expect(pieces()[0].outline[1].x).toBe(600);
    expect(screen.getByTestId('history').textContent).toBe('0');
    drag.release();
    expect(screen.getByTestId('history').textContent).toBe('1');
  });

  it('a drag that goes nowhere saves nothing', async () => {
    await open(true);
    dragSide(RIGHT_SIDE, 0, 0).release();
    expect(screen.getByTestId('history').textContent).toBe('0');
  });

  it('dragging a side past the opposite one is refused and the piece is left alone', async () => {
    await open(true);
    dragSide(RIGHT_SIDE, -700, 0).release();
    expect(pieces()[0].outline[1].x).toBe(600);
    expect(toastError).toHaveBeenCalledTimes(1);
  });

  it('Escape during a drag abandons it', async () => {
    await open(true);
    dragSide(RIGHT_SIDE, 50, 0);
    fireEvent.keyDown(screen.getByRole('application', { name: 'Drawing canvas' }), { key: 'Escape' });
    expect(pieces()[0].outline[1].x).toBe(600);
    expect(screen.getByTestId('tool').textContent).toBe('select');
  });
});
