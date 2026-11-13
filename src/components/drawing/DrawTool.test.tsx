// @vitest-environment jsdom
// The Draw tool end to end: the pencil on the rail, the Draw / Square bar,
// click-to-drop a default square, dragging a side to resize it, and dragging
// a side along itself to grow a return leg. Runs on a
// real reducer so assertions are on the document, not on dispatch mocks. The
// SVG is mocked to render at its 800x600 viewBox, so 1px = 1mm at zoom 1 with
// the world origin at pixel (400,300).

import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Drawing } from '@/types/drawing';
import { DEFAULT_DRAW_DEPTH_MM, DEFAULT_DRAW_LENGTH_MM, DRAW_RESIZE_STEP_MM, LEG_WIDTH_MM } from '@/lib/drawing/constants';
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

const PIECE_WIDTH = 600;
const PIECE_DEPTH = 400;

function drawing(withPiece: boolean, width: number): Drawing {
  return {
    schemaVersion: 1, salesOrderId: 'so1', version: 0, displayUnit: 'in', fractionDenominator: 32,
    areas: [{
      id: 'area-1', name: 'Area 1', code: '', sortOrder: 0, cabinets: [], notes: [],
      pieces: withPiece ? [{
        id: 'p1', label: 'A-1', shape: 'rect',
        outline: [{ x: 0, y: 0 }, { x: width, y: 0 }, { x: width, y: -PIECE_DEPTH }, { x: 0, y: -PIECE_DEPTH }],
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

async function open(withPiece: boolean, width = PIECE_WIDTH) {
  vi.spyOn(SVGElement.prototype, 'getBoundingClientRect').mockReturnValue({
    left: 0, top: 0, width: 800, height: 600, right: 800, bottom: 600, x: 0, y: 0, toJSON: () => undefined,
  } as DOMRect);
  render(
    <DrawingEditorProvider drawing={drawing(withPiece, width)} materialLines={[]}>
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

/** Drags a side's grab strip by (dx, dy) pixels from its middle. `width` is
 *  the piece's, for finding its right side. */
function dragSide(index: number, dx: number, dy: number, button = PRIMARY, width = PIECE_WIDTH) {
  const grab = screen.getByTestId(`edge-grab-A-1-${index}`);
  const from = {
    clientX: index === RIGHT_SIDE ? ORIGIN_X + width : ORIGIN_X,
    clientY: ORIGIN_Y + PIECE_DEPTH / 2,
  };
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

  it('a click with a little hand wobble still drops the square', async () => {
    await open(false);
    const sheet = screen.getByTestId('tool-capture');
    // The mouse shivers a pixel or two back and forth while pressed. Browsers
    // report each shiver as movement (Chrome on a scaled Windows screen in
    // device pixels, so a 1px shiver can read as 2), but the pointer ends up
    // where it started: that is a click, not a pan.
    fireEvent.pointerDown(sheet, { pointerId: 1, button: PRIMARY, clientX: 100, clientY: 100 });
    fireEvent.pointerMove(sheet, { pointerId: 1, clientX: 102, clientY: 101, movementX: 3, movementY: 2 });
    fireEvent.pointerMove(sheet, { pointerId: 1, clientX: 100, clientY: 100, movementX: -3, movementY: -2 });
    fireEvent.pointerUp(sheet, { pointerId: 1, button: PRIMARY, clientX: 100, clientY: 100 });
    expect(pieces()).toHaveLength(1);
  });

  it('a press that wanders off and comes back is still a pan, not a click', async () => {
    await open(false);
    const sheet = screen.getByTestId('tool-capture');
    fireEvent.pointerDown(sheet, { pointerId: 1, button: PRIMARY, clientX: 100, clientY: 100 });
    fireEvent.pointerMove(sheet, { pointerId: 1, clientX: 160, clientY: 100, movementX: 60, movementY: 0 });
    fireEvent.pointerMove(sheet, { pointerId: 1, clientX: 100, clientY: 100, movementX: -60, movementY: 0 });
    fireEvent.pointerUp(sheet, { pointerId: 1, button: PRIMARY, clientX: 100, clientY: 100 });
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

describe('Draw tool — drag a side along itself to grow a leg', () => {
  // Wide enough for a 25 1/2" leg off its end with plenty of run left over.
  const RUN = 2000;

  it('the right side pulled down grows a 25 1/2" leg off the bottom-right corner, the C5 L-shape', async () => {
    await open(true, RUN);
    dragSide(RIGHT_SIDE, 0, 300, PRIMARY, RUN).release();
    const [{ outline }] = pieces();
    expect(outline).toHaveLength(6);
    expect(outline[0]).toEqual({ x: 0, y: 0 });
    expect(outline[1]).toEqual({ x: RUN, y: 0 });
    // The right side ran on down, by the drag (to the 1/16").
    expect(outline[2].x).toBe(RUN);
    expect(Math.abs(outline[2].y - (-PIECE_DEPTH - 300))).toBeLessThanOrEqual(DRAW_RESIZE_STEP_MM / 2 + 1e-9);
    // The leg is exactly one countertop deep, measured in from the right side.
    expect(outline[3].x).toBeCloseTo(RUN - LEG_WIDTH_MM, 6);
    expect(outline[3].y).toBe(outline[2].y);
    expect(outline[4]).toEqual({ x: RUN - LEG_WIDTH_MM, y: -PIECE_DEPTH });
    // The rest of the bottom side is untouched.
    expect(outline[5]).toEqual({ x: 0, y: -PIECE_DEPTH });
  });

  it('pulled up instead, the leg grows off the top-right corner', async () => {
    await open(true, RUN);
    dragSide(RIGHT_SIDE, 0, -300, PRIMARY, RUN).release();
    const [{ outline }] = pieces();
    expect(outline).toHaveLength(6);
    expect(outline[1]).toEqual({ x: RUN - LEG_WIDTH_MM, y: 0 });
    expect(outline[3].x).toBe(RUN);
    expect(outline[3].y).toBeGreaterThan(290);
    expect(outline[5]).toEqual({ x: 0, y: -PIECE_DEPTH });
  });

  it('a mostly-sideways pull with a little wobble still just resizes', async () => {
    await open(true, RUN);
    dragSide(RIGHT_SIDE, 50, 10, PRIMARY, RUN).release();
    const [{ outline }] = pieces();
    expect(outline).toHaveLength(4);
    expect(outline[1].x).toBeGreaterThan(RUN + 40);
  });

  it('a piece barely wider than a leg is just made deeper, rather than left with a sliver', async () => {
    await open(true, LEG_WIDTH_MM + 10);
    dragSide(RIGHT_SIDE, 0, 300, PRIMARY, LEG_WIDTH_MM + 10).release();
    const [{ outline }] = pieces();
    expect(outline).toHaveLength(4);
    expect(outline[2].y).toBeLessThan(-PIECE_DEPTH - 290);
    expect(outline[3].y).toBe(outline[2].y);
  });

  it('pulled out to the right and then turned up, the resize locks and the leg is cut from the new length', async () => {
    await open(true, RUN);
    const grab = screen.getByTestId('edge-grab-A-1-1');
    const from = { clientX: ORIGIN_X + RUN, clientY: ORIGIN_Y + PIECE_DEPTH / 2 };
    fireEvent.pointerDown(grab, { pointerId: 1, button: PRIMARY, ...from });
    fireEvent.pointerMove(grab, { pointerId: 1, clientX: from.clientX + 200, clientY: from.clientY });
    // Turning up: the hand drifts back left a little on the way — the resize
    // is locked, so that drift must not shorten the run.
    fireEvent.pointerMove(grab, { pointerId: 1, clientX: from.clientX + 190, clientY: from.clientY - 300 });
    fireEvent.pointerUp(grab, { pointerId: 1, clientX: from.clientX + 190, clientY: from.clientY - 300 });
    const [{ outline }] = pieces();
    expect(outline).toHaveLength(6);
    const right = outline[3].x;
    expect(Math.abs(right - (RUN + 200))).toBeLessThanOrEqual(DRAW_RESIZE_STEP_MM / 2 + 1e-9);
    expect(outline[4].x).toBe(right);
    // The top side is the new run length less exactly one leg width.
    expect(outline[1].x).toBeCloseTo(right - LEG_WIDTH_MM, 6);
    expect(outline[1].y).toBe(0);
  });

  it('up and then right cuts a second leg off the first, a staircase, and leaves the box alone', async () => {
    await open(true, RUN);
    const grab = screen.getByTestId('edge-grab-A-1-1');
    const from = { clientX: ORIGIN_X + RUN, clientY: ORIGIN_Y + PIECE_DEPTH / 2 };
    fireEvent.pointerDown(grab, { pointerId: 1, button: PRIMARY, ...from });
    fireEvent.pointerMove(grab, { pointerId: 1, clientX: from.clientX, clientY: from.clientY - 300 });
    fireEvent.pointerMove(grab, { pointerId: 1, clientX: from.clientX + 200, clientY: from.clientY - 300 });
    fireEvent.pointerUp(grab, { pointerId: 1, clientX: from.clientX + 200, clientY: from.clientY - 300 });
    const [{ outline }] = pieces();
    expect(outline).toHaveLength(8);
    // The box itself is untouched: its left side and bottom are where they were.
    expect(outline[0]).toEqual({ x: 0, y: 0 });
    expect(outline[7]).toEqual({ x: 0, y: -PIECE_DEPTH });
    expect(outline[6]).toEqual({ x: RUN, y: -PIECE_DEPTH });
    // First leg: up off the top-right corner, a leg wide.
    expect(outline[1].x).toBeCloseTo(RUN - LEG_WIDTH_MM, 6);
    expect(outline[2].x).toBeCloseTo(RUN - LEG_WIDTH_MM, 6);
    expect(outline[2].y).toBeGreaterThan(290);
    // Second leg: right off the first's end, as deep as a leg is wide, by the
    // pointer's 200 less the 12px dead zone it ignores after the turn.
    expect(outline[3].y).toBe(outline[2].y);
    expect(outline[3].x).toBeGreaterThan(RUN + 180);
    expect(outline[3].x).toBeLessThan(RUN + 200);
    expect(outline[4].x).toBe(outline[3].x);
    expect(outline[4].y).toBeCloseTo(outline[2].y - LEG_WIDTH_MM, 6);
    expect(outline[5]).toEqual({ x: RUN, y: outline[4].y });
  });

  it('right, up, then right again cuts the same staircase, the first run staying where it was left', async () => {
    await open(true, RUN);
    const grab = screen.getByTestId('edge-grab-A-1-1');
    const from = { clientX: ORIGIN_X + RUN, clientY: ORIGIN_Y + PIECE_DEPTH / 2 };
    fireEvent.pointerDown(grab, { pointerId: 1, button: PRIMARY, ...from });
    fireEvent.pointerMove(grab, { pointerId: 1, clientX: from.clientX + 200, clientY: from.clientY });
    fireEvent.pointerMove(grab, { pointerId: 1, clientX: from.clientX + 200, clientY: from.clientY - 300 });
    fireEvent.pointerMove(grab, { pointerId: 1, clientX: from.clientX + 400, clientY: from.clientY - 300 });
    fireEvent.pointerUp(grab, { pointerId: 1, clientX: from.clientX + 400, clientY: from.clientY - 300 });
    const [{ outline }] = pieces();
    expect(outline).toHaveLength(8);
    expect(Math.abs(outline[5].x - (RUN + 200))).toBeLessThanOrEqual(DRAW_RESIZE_STEP_MM / 2 + 1e-9);
    expect(outline[3].x).toBeGreaterThan(RUN + 380);
  });

  it('turning back inside the dead zone after the second leg started removes it again', async () => {
    await open(true, RUN);
    const grab = screen.getByTestId('edge-grab-A-1-1');
    const from = { clientX: ORIGIN_X + RUN, clientY: ORIGIN_Y + PIECE_DEPTH / 2 };
    fireEvent.pointerDown(grab, { pointerId: 1, button: PRIMARY, ...from });
    fireEvent.pointerMove(grab, { pointerId: 1, clientX: from.clientX, clientY: from.clientY - 300 });
    fireEvent.pointerMove(grab, { pointerId: 1, clientX: from.clientX + 200, clientY: from.clientY - 300 });
    fireEvent.pointerMove(grab, { pointerId: 1, clientX: from.clientX + 5, clientY: from.clientY - 300 });
    fireEvent.pointerUp(grab, { pointerId: 1, clientX: from.clientX + 5, clientY: from.clientY - 300 });
    expect(pieces()[0].outline).toHaveLength(6);
  });

  it('highlights only the one border being pulled: the side while resizing, the end of the leg once it turns', async () => {
    await open(true, RUN);
    const grab = screen.getByTestId('edge-grab-A-1-1');
    const from = { clientX: ORIGIN_X + RUN, clientY: ORIGIN_Y + PIECE_DEPTH / 2 };
    const highlighted = () => Array.from(document.querySelectorAll('polyline.stroke-brand'));
    fireEvent.pointerDown(grab, { pointerId: 1, button: PRIMARY, ...from });
    fireEvent.pointerMove(grab, { pointerId: 1, clientX: from.clientX + 200, clientY: from.clientY });
    expect(highlighted()).toHaveLength(1);
    expect(highlighted()[0].getAttribute('points')?.split(' ')).toHaveLength(2);
    fireEvent.pointerMove(grab, { pointerId: 1, clientX: from.clientX + 200, clientY: from.clientY - 300 });
    expect(highlighted()).toHaveLength(1);
    const ends = highlighted()[0].getAttribute('points')?.split(' ') ?? [];
    expect(ends).toHaveLength(2);
    // Both ends of the highlighted border sit at the leg's top — a level line.
    expect(ends[0].split(',')[1]).toBe(ends[1].split(',')[1]);
  });

  it('the end of a leg dragged back onto the run joins it again, leaving one clean top side', async () => {
    await open(true, RUN);
    dragSide(RIGHT_SIDE, 0, -300, PRIMARY, RUN).release();
    expect(pieces()[0].outline).toHaveLength(6);
    const top = pieces()[0].outline[3].y;
    // The leg's end is side index 2 (A-1-2): from its middle, drag it back
    // down to the run's line — a few pixels short, as a hand would.
    const grab = screen.getByTestId('edge-grab-A-1-2');
    const from = { clientX: ORIGIN_X + RUN - LEG_WIDTH_MM / 2, clientY: ORIGIN_Y - top };
    fireEvent.pointerDown(grab, { pointerId: 1, button: PRIMARY, ...from });
    fireEvent.pointerMove(grab, { pointerId: 1, clientX: from.clientX, clientY: from.clientY + top - 3 });
    fireEvent.pointerUp(grab, { pointerId: 1, clientX: from.clientX, clientY: from.clientY + top - 3 });
    const [{ outline }] = pieces();
    expect(toastError).not.toHaveBeenCalled();
    expect(outline).toHaveLength(4);
    expect(outline[0]).toEqual({ x: 0, y: 0 });
    expect(outline[1]).toEqual({ x: RUN, y: 0 });
  });

  it('shows the leg while dragging but saves it only on release, as one undo step', async () => {
    await open(true, RUN);
    const drag = dragSide(RIGHT_SIDE, 0, 300, PRIMARY, RUN);
    expect(pieces()[0].outline).toHaveLength(4);
    expect(screen.getByTestId('history').textContent).toBe('0');
    drag.release();
    expect(screen.getByTestId('history').textContent).toBe('1');
    expect(pieces()[0].outline).toHaveLength(6);
  });

  it('Escape during the drag abandons the leg', async () => {
    await open(true, RUN);
    dragSide(RIGHT_SIDE, 0, 300, PRIMARY, RUN);
    fireEvent.keyDown(screen.getByRole('application', { name: 'Drawing canvas' }), { key: 'Escape' });
    expect(pieces()[0].outline).toHaveLength(4);
  });
});
