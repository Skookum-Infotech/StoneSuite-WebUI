// @vitest-environment jsdom
// The Seams and Dimension rail tools: their buttons and hotkeys, and the bottom
// bar each one opens, which lists what is already drawn so it can be removed.

import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Drawing } from '@/types/drawing';
import { rectOutline } from '@/lib/drawing/geometry';
import { DimensionModeBar } from './DimensionModeBar';
import { DrawingCanvas } from './DrawingCanvas';
import { DrawingEditorProvider, useDrawingEditor } from './DrawingEditorContext';
import { SeamModeBar } from './SeamModeBar';
import { ToolRail } from './ToolRail';

const drawing: Drawing = {
  schemaVersion: 1, salesOrderId: 'so1', version: 0, displayUnit: 'mm', fractionDenominator: 32,
  areas: [{
    id: 'a', name: 'A', code: '', sortOrder: 0, cabinets: [], notes: [],
    dimensions: [{ id: 'd1', from: { x: 0, y: 0 }, to: { x: 1000, y: 0 }, offsetMm: 100 }],
    pieces: [{
      id: 'p1', label: 'A-1', shape: 'rect', outline: rectOutline(1000, 500), position: { x: 0, y: 0 },
      rotationDeg: 0, thicknessMm: 30, edges: [], cutouts: [],
      seams: [{ from: { x: 100, y: 0 }, to: { x: 100, y: 500 } }, { from: { x: 600, y: 0 }, to: { x: 600, y: 300 } }],
    }],
  }],
  updatedAt: '', updatedBy: { id: 'u1', name: 'T' },
};

function Readout() {
  const { state, tool } = useDrawingEditor();
  const area = state.present.areas[0];
  return (
    <>
      <span data-testid="tool">{tool}</span>
      <span data-testid="seams">{JSON.stringify(area.pieces[0].seams)}</span>
      <span data-testid="dimensions">{JSON.stringify(area.dimensions ?? [])}</span>
    </>
  );
}

function open() {
  render(
    <DrawingEditorProvider drawing={drawing} materialLines={[]}>
      <ToolRail />
      <SeamModeBar />
      <DimensionModeBar />
      <DrawingCanvas />
      <Readout />
    </DrawingEditorProvider>,
  );
  return userEvent.setup();
}

const tool = () => screen.getByTestId('tool').textContent;
const seams = () => JSON.parse(screen.getByTestId('seams').textContent ?? '[]');
const dimensions = () => JSON.parse(screen.getByTestId('dimensions').textContent ?? '[]');
const canvas = () => screen.getByRole('application', { name: 'Drawing canvas' });

describe('Seams tool', () => {
  it('arms from the rail, lights while armed and puts itself away on a second press', async () => {
    const user = open();
    const button = screen.getByRole('button', { name: 'Seams' });
    expect(screen.queryByRole('group', { name: 'Seams tool' })).toBeNull();
    await user.click(button);
    expect(tool()).toBe('line');
    expect(button.getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('group', { name: 'Seams tool' })).toBeTruthy();
    await user.click(button);
    expect(tool()).toBe('select');
    expect(screen.queryByRole('group', { name: 'Seams tool' })).toBeNull();
  });

  it('S arms it and a second S puts it away', () => {
    open();
    fireEvent.keyDown(canvas(), { key: 's' });
    expect(tool()).toBe('line');
    fireEvent.keyDown(canvas(), { key: 's' });
    expect(tool()).toBe('select');
  });

  it('lists every seam on the area and deletes just the one picked', async () => {
    const user = open();
    await user.click(screen.getByRole('button', { name: 'Seams' }));
    const list = screen.getByRole('list', { name: 'Seams on this area' });
    expect(within(list).getAllByRole('listitem').map((li) => li.textContent)).toEqual([
      expect.stringContaining('A-1 · seam 1 · 500mm'),
      expect.stringContaining('A-1 · seam 2 · 300mm'),
    ]);
    await user.click(screen.getByRole('button', { name: 'Delete seam 1 on A-1' }));
    expect(seams()).toEqual([{ from: { x: 600, y: 0 }, to: { x: 600, y: 300 } }]);
  });

  it('Close puts the tool away', async () => {
    const user = open();
    await user.click(screen.getByRole('button', { name: 'Seams' }));
    await user.click(screen.getByRole('button', { name: /Close/ }));
    expect(tool()).toBe('select');
  });
});

describe('Dimension tool', () => {
  it('arms from the rail, lights while armed and puts itself away on a second press', async () => {
    const user = open();
    const button = screen.getByRole('button', { name: 'Dimension' });
    await user.click(button);
    expect(tool()).toBe('dimension');
    expect(button.getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('group', { name: 'Dimension tool' })).toBeTruthy();
    await user.click(button);
    expect(tool()).toBe('select');
  });

  it('D arms it and a second D puts it away', () => {
    open();
    fireEvent.keyDown(canvas(), { key: 'd' });
    expect(tool()).toBe('dimension');
    fireEvent.keyDown(canvas(), { key: 'd' });
    expect(tool()).toBe('select');
  });

  it('lists the manual dimensions, flips one to the other side and deletes it', async () => {
    const user = open();
    await user.click(screen.getByRole('button', { name: 'Dimension' }));
    expect(screen.getByText(/Dimension 1 · 1000mm/)).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Flip dimension 1 to the other side' }));
    expect(dimensions()[0]).toMatchObject({ from: { x: 1000, y: 0 }, to: { x: 0, y: 0 } });
    await user.click(screen.getByRole('button', { name: 'Delete dimension 1' }));
    expect(dimensions()).toEqual([]);
  });
});
