// @vitest-environment jsdom
// The white board has no edge: the invisible sheets that catch clicks must
// reach far past anywhere the user can zoom out or pan to. They used to stop
// at +/-5 m, which left dead patches where an armed Draw tool did nothing.

import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Drawing } from '@/types/drawing';
import { ZOOM_MIN } from '@/lib/drawing/constants';
import { DrawingCanvas } from './DrawingCanvas';
import { DrawingEditorProvider, useDrawingEditor } from './DrawingEditorContext';

const drawing: Drawing = {
  schemaVersion: 1, salesOrderId: 's', version: 0, displayUnit: 'in', fractionDenominator: 32,
  areas: [{ id: 'a', name: 'A', code: '', sortOrder: 0, pieces: [], cabinets: [], notes: [] }],
  updatedAt: '', updatedBy: { id: 'u', name: 'U' },
};

function ArmDraw() {
  const { setTool } = useDrawingEditor();
  return <button type="button" onClick={() => setTool('draw')}>arm draw</button>;
}

/** The farthest a 4K-wide screen shows from the board's centre when fully
 *  zoomed out and panned a screen's width away, in mm. */
const FARTHEST_VISIBLE_MM = (3840 / ZOOM_MIN) * 2;

const halfExtent = (rect: HTMLElement) => Math.abs(Number(rect.getAttribute('x')));

describe('canvas hit sheets', () => {
  it('cover every place a click can land, however far the board is zoomed out or panned', async () => {
    render(
      <DrawingEditorProvider drawing={drawing} materialLines={[]}>
        <ArmDraw />
        <DrawingCanvas />
      </DrawingEditorProvider>,
    );
    expect(halfExtent(screen.getByTestId('canvas-background'))).toBeGreaterThan(FARTHEST_VISIBLE_MM);
    await userEvent.click(screen.getByRole('button', { name: 'arm draw' }));
    expect(halfExtent(screen.getByTestId('tool-capture'))).toBeGreaterThan(FARTHEST_VISIBLE_MM);
  });
});
