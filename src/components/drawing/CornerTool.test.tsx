// @vitest-environment jsdom
// The Corner tool end to end: arm a change from the rail, click a corner, type
// the numbers (named by the side letters they are measured on), Apply.

import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Drawing, Piece } from '@/types/drawing';
import { rectOutline } from '@/lib/drawing/geometry';
import { DrawingCanvas } from './DrawingCanvas';
import { DrawingEditorProvider, useDrawingEditor } from './DrawingEditorContext';
import { BorderModeBar } from './BorderModeBar';
import { CornerModeBar } from './CornerModeBar';
import { ToolRail } from './ToolRail';

const piece: Piece = {
  id: 'p1', label: 'A-1', shape: 'rect', outline: rectOutline(2000, 800), position: { x: 0, y: 0 }, rotationDeg: 0,
  thicknessMm: 30, edges: [], seams: [], cutouts: [],
};
const drawing: Drawing = {
  schemaVersion: 1, salesOrderId: 's', version: 0, displayUnit: 'mm', fractionDenominator: 32,
  areas: [{ id: 'a', name: 'A', code: '', sortOrder: 0, pieces: [piece], cabinets: [], notes: [] }],
  updatedAt: '', updatedBy: { id: 'u', name: 'U' },
};

function Readout() {
  const { state, tool, dispatch } = useDrawingEditor();
  const p = state.present.areas[0].pieces[0];
  return (
    <>
      <span data-testid="tool">{tool}</span>
      <span data-testid="piece">{JSON.stringify({ shape: p.shape, outline: p.outline, edges: p.edges })}</span>
      <button type="button" onClick={() => dispatch({ type: 'undo' })}>undo</button>
    </>
  );
}

function open() {
  render(
    <DrawingEditorProvider drawing={drawing} materialLines={[]}>
      <ToolRail />
      <div className="relative">
        <DrawingCanvas />
        <BorderModeBar />
        <CornerModeBar />
      </div>
      <Readout />
    </DrawingEditorProvider>,
  );
  return userEvent.setup();
}

const read = () => JSON.parse(screen.getByTestId('piece').textContent ?? '{}');

async function arm(user: ReturnType<typeof userEvent.setup>, style: string) {
  await user.click(screen.getByRole('button', { name: 'Corner' }));
  await user.click(screen.getByRole('menuitem', { name: style }));
}

describe('Corner tool', () => {
  it('shows the bar, the pointer message, and a dot on every corner once armed', async () => {
    const user = open();
    expect(screen.queryByRole('group', { name: 'Corner tool' })).toBeNull();
    await arm(user, 'Clip');
    expect(screen.getByRole('heading', { name: 'Applying Clip' })).toBeTruthy();
    expect(screen.getByText('Click on any corner')).toBeTruthy();
    expect(screen.getAllByRole('button', { name: /^Corner [A-D] and [A-D] of A-1$/ })).toHaveLength(4);
    // Nothing to type until a corner is picked.
    expect(screen.queryByRole('form', { name: 'Corner measurements' })).toBeNull();
    // The six styles sit in the bar to switch between.
    for (const name of ['Clip', 'Radius', 'Radius In', 'Bump Out', 'Bump In', 'Notch']) {
      expect(screen.getByRole('button', { name })).toBeTruthy();
    }
  });

  it('Clip asks for the two sides\' sizes (named by their letters), default 4", and cuts the corner', async () => {
    const user = open();
    await arm(user, 'Clip');
    // The top-right corner joins side A (top) and side B (right).
    await user.click(screen.getByRole('button', { name: 'Corner A and B of A-1' }));
    const a = screen.getByRole('textbox', { name: 'A, size' }) as HTMLInputElement;
    const b = screen.getByRole('textbox', { name: 'B, size' }) as HTMLInputElement;
    expect([a.value, b.value]).toEqual(['101.6mm', '101.6mm']);
    await user.clear(a);
    await user.type(a, '200mm');
    await user.click(screen.getByRole('button', { name: 'Apply' }));
    expect(read().shape).toBe('polygon');
    // A is 200 along the top from the corner, B the default 101.6 down the right.
    expect(read().outline).toEqual([
      { x: 0, y: 0 }, { x: 1800, y: 0 }, { x: 2000, y: -101.6 }, { x: 2000, y: -800 }, { x: 0, y: -800 },
    ]);
    // The tool stays armed for the next corner, with nothing picked.
    expect(screen.getByTestId('tool').textContent).toBe('corner');
    expect(screen.queryByRole('form', { name: 'Corner measurements' })).toBeNull();
  });

  it('Radius draws an arc side, a quarter circle at 4 x 4', async () => {
    const user = open();
    await arm(user, 'Radius');
    await user.click(screen.getByRole('button', { name: 'Corner A and B of A-1' }));
    await user.click(screen.getByRole('button', { name: 'Apply' }));
    expect(read().edges).toHaveLength(1);
    expect(read().edges[0]).toMatchObject({ index: 1, cornerStyle: 'radius' });
    expect(read().edges[0].arcHeightMm).toBeCloseTo(101.6 * (1 - Math.SQRT1_2), 6);
    expect(document.querySelector('path[d*=" A"][class*="stroke-stone-900"]')).not.toBeNull();
  });

  it('Bump Out asks for gap, height and gap, and builds a rotated bump out of the corner', async () => {
    const user = open();
    await arm(user, 'Bump Out');
    await user.click(screen.getByRole('button', { name: 'Corner A and B of A-1' }));
    // Gaps are measured on the sides that meet; the height is the two sides the bump adds (B and D here).
    const gap1 = screen.getByRole('textbox', { name: 'A, gap' }) as HTMLInputElement;
    const height = screen.getByRole('textbox', { name: 'B, D, height' }) as HTMLInputElement;
    const gap2 = screen.getByRole('textbox', { name: 'B, gap' }) as HTMLInputElement;
    expect([gap1.value, height.value, gap2.value]).toEqual(['101.6mm', '101.6mm', '101.6mm']);
    await user.click(screen.getByRole('button', { name: 'Apply' }));
    expect(read().outline).toHaveLength(7);
    expect(read().edges.map((e: { index: number }) => e.index)).toEqual([1, 2, 3]);
  });

  it('Notch asks for two sizes and bites a square out', async () => {
    const user = open();
    await arm(user, 'Notch');
    await user.click(screen.getByRole('button', { name: 'Corner A and B of A-1' }));
    await user.click(screen.getByRole('button', { name: 'Apply' }));
    expect(read().outline).toHaveLength(6);
    expect(read().outline[2]).toEqual({ x: 1898.4, y: -101.6 });
  });

  it('names the inputs by whichever corner was clicked, so the letters match the drawing', async () => {
    const user = open();
    await arm(user, 'Clip');
    await user.click(screen.getByRole('button', { name: 'Corner C and D of A-1' }));
    expect(screen.getByRole('textbox', { name: 'C, size' })).toBeTruthy();
    expect(screen.getByRole('textbox', { name: 'D, size' })).toBeTruthy();
    // The first corner closes the loop: the side before it is the last.
    await user.click(screen.getByRole('button', { name: 'Corner D and A of A-1' }));
    expect(screen.getByRole('textbox', { name: 'D, size' })).toBeTruthy();
    expect(screen.getByRole('textbox', { name: 'A, size' })).toBeTruthy();
  });

  it('switching style in the bar keeps the clicked corner and re-labels the inputs', async () => {
    const user = open();
    await arm(user, 'Clip');
    await user.click(screen.getByRole('button', { name: 'Corner A and B of A-1' }));
    expect(screen.queryByRole('textbox', { name: 'B, D, height' })).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Bump In' }));
    expect(screen.getByRole('heading', { name: 'Applying Bump In' })).toBeTruthy();
    expect(screen.getByRole('textbox', { name: 'B, D, height' })).toBeTruthy();
  });

  it('refuses numbers that cannot work and leaves the piece alone', async () => {
    const user = open();
    await arm(user, 'Clip');
    await user.click(screen.getByRole('button', { name: 'Corner A and B of A-1' }));
    const a = screen.getByRole('textbox', { name: 'A, size' });
    await user.clear(a);
    await user.type(a, '2000mm');
    await user.click(screen.getByRole('button', { name: 'Apply' }));
    expect((await screen.findByRole('alert')).textContent).toBe('Side A is too short for that size.');
    expect(read().outline).toHaveLength(4);
  });

  it('says what is wrong with text that is not a length', async () => {
    const user = open();
    await arm(user, 'Clip');
    await user.click(screen.getByRole('button', { name: 'Corner A and B of A-1' }));
    const a = screen.getByRole('textbox', { name: 'A, size' });
    await user.clear(a);
    await user.type(a, 'big');
    await user.click(screen.getByRole('button', { name: 'Apply' }));
    expect((await screen.findByRole('alert')).textContent).toMatch(/isn't a length/);
    expect(read().edges).toEqual([]);
  });

  it('a corner that already has a change takes no second one until it is made standard again', async () => {
    const user = open();
    await arm(user, 'Clip');
    await user.click(screen.getByRole('button', { name: 'Corner A and B of A-1' }));
    await user.click(screen.getByRole('button', { name: 'Apply' }));
    expect(read().outline).toHaveLength(5);

    // Either end of the clip (corners 1 and 2) says so instead of offering the numbers.
    await user.click(screen.getByRole('button', { name: 'Corner B and C of A-1' }));
    expect(screen.queryByRole('form', { name: 'Corner measurements' })).toBeNull();
    expect(screen.getByRole('group', { name: 'Existing corner change' }).textContent).toMatch(/already has a Clip/);
    // Picking another style in the bar does not get round it.
    await user.click(screen.getByRole('button', { name: 'Notch' }));
    expect(screen.queryByRole('form', { name: 'Corner measurements' })).toBeNull();
    expect(read().outline).toHaveLength(5);

    // Making it standard puts the sharp corner back, and then anything can go on it.
    await user.click(screen.getByRole('button', { name: 'Make standard' }));
    expect(read().outline).toEqual(rectOutline(2000, 800));
    expect(read().edges).toEqual([]);
    expect(screen.queryByRole('group', { name: 'Existing corner change' })).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Corner A and B of A-1' }));
    await user.click(screen.getByRole('button', { name: 'Apply' }));
    expect(read().edges).toMatchObject([{ index: 1, cornerStyle: 'notch' }, { index: 2, cornerStyle: 'notch' }]);
  });

  it('Make standard is one undo step', async () => {
    const user = open();
    await arm(user, 'Radius In');
    await user.click(screen.getByRole('button', { name: 'Corner B and C of A-1' }));
    await user.click(screen.getByRole('button', { name: 'Apply' }));
    await user.click(screen.getByRole('button', { name: 'Corner B and C of A-1' }));
    await user.click(screen.getByRole('button', { name: 'Make standard' }));
    expect(read().edges).toEqual([]);
    await user.click(screen.getByRole('button', { name: 'undo' }));
    expect(read().edges).toHaveLength(1);
  });

  it('a side a corner change made takes no border, and the Border tool says why', async () => {
    const user = open();
    await arm(user, 'Clip');
    await user.click(screen.getByRole('button', { name: 'Corner A and B of A-1' }));
    await user.click(screen.getByRole('button', { name: 'Apply' }));
    // Switch tools: the clip's new side is side B.
    await user.click(screen.getByRole('button', { name: 'Close (Esc)' }));
    await user.click(screen.getByRole('button', { name: 'Border' }));
    await user.click(screen.getByRole('menuitem', { name: 'Full Radius Out' }));
    await user.click(screen.getByRole('button', { name: 'Side B of A-1' }));
    expect(screen.queryByRole('form', { name: 'Border measurements' })).toBeNull();
    expect(screen.getByRole('status').textContent).toMatch(/belongs to a corner change/);
  });

  it('is one undo step, and Close (Esc) or the Escape key hands back to Select', async () => {
    const user = open();
    await arm(user, 'Clip');
    await user.click(screen.getByRole('button', { name: 'Corner A and B of A-1' }));
    await user.click(screen.getByRole('button', { name: 'Apply' }));
    expect(read().outline).toHaveLength(5);
    await user.click(screen.getByRole('button', { name: 'undo' }));
    expect(read().outline).toHaveLength(4);

    await user.click(screen.getByRole('button', { name: 'Close (Esc)' }));
    expect(screen.getByTestId('tool').textContent).toBe('select');
    expect(screen.queryByRole('group', { name: 'Corner tool' })).toBeNull();
    await arm(user, 'Notch');
    await user.keyboard('{Escape}');
    expect(screen.getByTestId('tool').textContent).toBe('select');
  });
});
