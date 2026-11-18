// What a placed cutout says on the board: its name and Length x Height in the
// middle, and the distance lines it asked for once Dimensions are switched on.

import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Cutout, Drawing, Piece } from '@/types/drawing';
import { MM_PER_INCH } from '@/lib/drawing/constants';
import { CutoutDistanceLines } from './CutoutDistanceLines';
import { CutoutLabel } from './CutoutLabel';
import { DrawingEditorProvider, useDrawingEditor } from './DrawingEditorContext';

const SINK: Cutout = {
  id: 'c1', type: 'sink', shape: 'rect', center: { x: 400, y: -200 }, widthMm: 23 * MM_PER_INCH, depthMm: 14 * MM_PER_INCH,
  label: 'Kitchen sink',
  distanceLines: { top: 'hidden', right: 'hidden', bottom: 'center', left: 'center' },
};

const PIECE: Piece = {
  id: 'p1', label: 'A-1', shape: 'rect',
  outline: [{ x: 0, y: 0 }, { x: 1000, y: 0 }, { x: 1000, y: -600 }, { x: 0, y: -600 }],
  position: { x: 0, y: 0 }, rotationDeg: 0, thicknessMm: 30, edges: [], seams: [], cutouts: [SINK],
};

const DRAWING: Drawing = {
  schemaVersion: 1, salesOrderId: 'so1', version: 0, displayUnit: 'in', fractionDenominator: 32,
  areas: [{ id: 'a1', name: 'Area 1', code: '', sortOrder: 0, pieces: [PIECE], cabinets: [], notes: [] }],
  updatedAt: '2026-11-16T00:00:00.000Z', updatedBy: { id: 'u1', name: 'Test' },
};

function Tabs() {
  const { setWorkspace } = useDrawingEditor();
  return (
    <>
      <button type="button" onClick={() => setWorkspace('cutout')}>cutout tab</button>
      <button type="button" onClick={() => setWorkspace('sketch')}>sketch tab</button>
    </>
  );
}

function renderCutout(cutout: Cutout) {
  render(
    <DrawingEditorProvider drawing={DRAWING} materialLines={[]}>
      <Tabs />
      <svg>
        <CutoutLabel cutout={cutout} rotationDeg={0} />
        <CutoutDistanceLines piece={PIECE} cutout={cutout} />
      </svg>
    </DrawingEditorProvider>,
  );
}

describe('CutoutLabel', () => {
  it('puts the name and Length x Height in the middle of the cutout', () => {
    renderCutout(SINK);
    expect(screen.getByText('Kitchen sink')).toBeDefined();
    expect(screen.getByText('23" x 14"')).toBeDefined();
  });

  it('falls back to the type name when the cutout has no name', () => {
    renderCutout({ ...SINK, label: undefined });
    expect(screen.getByText('Sink')).toBeDefined();
  });

  it('leaves the name off when Hide name is ticked, keeping the size', () => {
    renderCutout({ ...SINK, hideName: true });
    expect(screen.queryByText('Kitchen sink')).toBeNull();
    expect(screen.getByText('23" x 14"')).toBeDefined();
  });

  it('leaves the size off when Hide measurements is ticked, keeping the name', () => {
    renderCutout({ ...SINK, hideMeasurements: true });
    expect(screen.getByText('Kitchen sink')).toBeDefined();
    expect(screen.queryByText('23" x 14"')).toBeNull();
  });

  it('says nothing when both are hidden', () => {
    renderCutout({ ...SINK, hideName: true, hideMeasurements: true });
    expect(screen.queryByText('Kitchen sink')).toBeNull();
    expect(screen.queryByText('23" x 14"')).toBeNull();
  });

  it('describes a round opening by its diameter both ways', () => {
    renderCutout({ ...SINK, shape: 'round', widthMm: undefined, depthMm: undefined, diameterMm: 2 * MM_PER_INCH });
    expect(screen.getByText('2" x 2"')).toBeDefined();
  });
});

describe('CutoutDistanceLines', () => {
  it('shows only in the Cutout tab: hidden in Sketch, gone again on switching back', async () => {
    renderCutout(SINK);
    expect(screen.queryByText('15 3/4"')).toBeNull();

    await userEvent.click(screen.getByRole('button', { name: 'cutout tab' }));
    // Centre (400, -200) to the left edge is 400mm; to the bottom edge 400mm.
    expect(screen.getAllByText('15 3/4"')).toHaveLength(2);

    await userEvent.click(screen.getByRole('button', { name: 'sketch tab' }));
    expect(screen.queryByText('15 3/4"')).toBeNull();
  });

  it('draws only the sides that are not hidden', async () => {
    renderCutout({ ...SINK, distanceLines: { top: 'hidden', right: 'center', bottom: 'hidden', left: 'hidden' } });
    await userEvent.click(screen.getByRole('button', { name: 'cutout tab' }));
    // Centre to the right edge: 600mm.
    expect(screen.getAllByText('23 5/8"')).toHaveLength(1);
  });

  it('a centre line starts at the middle of the cutout, a border line at its edge', async () => {
    const { container } = render(
      <DrawingEditorProvider drawing={DRAWING} materialLines={[]}>
        <Tabs />
        <svg>
          <CutoutDistanceLines piece={PIECE} cutout={{ ...SINK, distanceLines: { top: 'hidden', right: 'hidden', bottom: 'hidden', left: 'center' } }} />
          <CutoutDistanceLines piece={PIECE} cutout={{ ...SINK, distanceLines: { top: 'hidden', right: 'hidden', bottom: 'hidden', left: 'border' } }} />
        </svg>
      </DrawingEditorProvider>,
    );
    await userEvent.click(screen.getAllByRole('button', { name: 'cutout tab' })[0]);
    const starts = Array.from(container.querySelectorAll('circle')).map((c) => Number(c.getAttribute('cx')));
    expect(starts[0]).toBe(400);
    expect(starts[1]).toBeCloseTo(400 - (23 * MM_PER_INCH) / 2, 5);
  });
});
