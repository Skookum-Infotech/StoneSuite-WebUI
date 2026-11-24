// The target cursor: after Save in the Cutout dialog the new cutout follows the
// pointer over its piece and is added where the board is clicked.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { toast } from 'sonner';
import type { Cutout, Drawing, Piece } from '@/types/drawing';

vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

import { CutoutPlacementLayer } from './CutoutPlacementLayer';
import { DrawingEditorProvider, useDrawingEditor } from './DrawingEditorContext';

const NEW_CUTOUT: Cutout = {
  id: 'new', type: 'other', shape: 'rect', center: { x: 0, y: 0 }, widthMm: 100, depthMm: 60, label: 'Cutout - Other',
};

const PIECE: Piece = {
  id: 'p1', label: 'A-1', shape: 'rect',
  outline: [{ x: 0, y: 0 }, { x: 600, y: 0 }, { x: 600, y: -400 }, { x: 0, y: -400 }],
  position: { x: 0, y: 0 }, rotationDeg: 0, thicknessMm: 30, edges: [], seams: [], cutouts: [],
};

const DRAWING: Drawing = {
  schemaVersion: 1, salesOrderId: 'so1', version: 0, displayUnit: 'in', fractionDenominator: 32,
  areas: [{ id: 'a1', name: 'Area 1', code: '', sortOrder: 0, pieces: [PIECE], cabinets: [], notes: [] }],
  updatedAt: '2026-11-16T00:00:00.000Z', updatedBy: { id: 'u1', name: 'Test' },
};

function Harness() {
  const { state, startPlacing, placing } = useDrawingEditor();
  return (
    <>
      <button type="button" onClick={() => startPlacing('p1', NEW_CUTOUT)}>start placing</button>
      <span data-testid="placing">{placing ? 'yes' : 'no'}</span>
      <span data-testid="cutouts">{JSON.stringify(state.present.areas[0].pieces[0].cutouts)}</span>
      <span data-testid="selected-cutout">{state.selectedCutoutId ?? ''}</span>
    </>
  );
}

function renderLayer() {
  render(
    <DrawingEditorProvider drawing={DRAWING} materialLines={[]}>
      <Harness />
      <svg><CutoutPlacementLayer /></svg>
    </DrawingEditorProvider>,
  );
}

const cutouts = (): Cutout[] => JSON.parse(screen.getByTestId('cutouts').textContent ?? '[]');

/** The board is 800 x 600 with the origin at (400, 300): 1px is 1mm. */
const at = (x: number, y: number) => ({ clientX: 400 + x, clientY: 300 - y });

beforeEach(() => {
  vi.spyOn(SVGElement.prototype, 'getBoundingClientRect').mockReturnValue({
    left: 0, top: 0, width: 800, height: 600, right: 800, bottom: 600, x: 0, y: 0, toJSON: () => undefined,
  } as DOMRect);
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.mocked(toast.error).mockClear();
});

describe('CutoutPlacementLayer', () => {
  it('is not there until a cutout is waiting to be placed', () => {
    renderLayer();
    expect(screen.queryByTestId('cutout-placement')).toBeNull();
  });

  it('is a crosshair sheet over the board once one is waiting', () => {
    renderLayer();
    fireEvent.click(screen.getByRole('button', { name: 'start placing' }));
    expect(screen.getByTestId('cutout-placement').getAttribute('class')).toContain('cursor-crosshair');
  });

  it('shows the cutout following the pointer, blue where it fits and red where it does not', () => {
    renderLayer();
    fireEvent.click(screen.getByRole('button', { name: 'start placing' }));
    const sheet = screen.getByTestId('cutout-placement');

    fireEvent.pointerMove(sheet, at(300, -200));
    expect(screen.getByTestId('cutout-ghost').getAttribute('data-valid')).toBe('true');
    expect(screen.getByTestId('cutout-ghost').getAttribute('class')).toContain('stroke-sky-600');

    fireEvent.pointerMove(sheet, at(10, -10)); // hanging off the corner
    expect(screen.getByTestId('cutout-ghost').getAttribute('data-valid')).toBe('false');
    expect(screen.getByTestId('cutout-ghost').getAttribute('class')).toContain('stroke-red-600');
  });

  it('adds the cutout where it is clicked, selects it, and stops waiting', () => {
    renderLayer();
    fireEvent.click(screen.getByRole('button', { name: 'start placing' }));
    fireEvent.click(screen.getByTestId('cutout-placement'), at(300, -200));

    expect(cutouts()).toHaveLength(1);
    expect(Math.abs(cutouts()[0].center.x - 300)).toBeLessThanOrEqual(3.2);
    expect(Math.abs(cutouts()[0].center.y + 200)).toBeLessThanOrEqual(3.2);
    expect(screen.getByTestId('selected-cutout').textContent).toBe('new');
    expect(screen.getByTestId('placing').textContent).toBe('no');
    expect(screen.queryByTestId('cutout-placement')).toBeNull();
  });

  it('refuses a click where it does not fit, says why, and keeps waiting', () => {
    renderLayer();
    fireEvent.click(screen.getByRole('button', { name: 'start placing' }));
    fireEvent.click(screen.getByTestId('cutout-placement'), at(10, -10));

    expect(toast.error).toHaveBeenCalledWith(expect.stringMatching(/inside the piece/));
    expect(cutouts()).toHaveLength(0);
    expect(screen.getByTestId('placing').textContent).toBe('yes');
  });

  it('Escape gives up without adding anything', () => {
    renderLayer();
    fireEvent.click(screen.getByRole('button', { name: 'start placing' }));
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.getByTestId('placing').textContent).toBe('no');
    expect(cutouts()).toHaveLength(0);
  });
});
