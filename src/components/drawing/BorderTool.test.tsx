// @vitest-environment jsdom
// The Border tool end to end: arm a reshape from the rail, click a side, type
// the numbers (named by the side letters they produce), Apply.

import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Drawing, Piece } from '@/types/drawing';
import { rectOutline } from '@/lib/drawing/geometry';
import { DrawingCanvas } from './DrawingCanvas';
import { DrawingEditorProvider, useDrawingEditor } from './DrawingEditorContext';
import { BorderModeBar } from './BorderModeBar';
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
      </div>
      <Readout />
    </DrawingEditorProvider>,
  );
  return userEvent.setup();
}

const read = () => JSON.parse(screen.getByTestId('piece').textContent ?? '{}');

async function arm(user: ReturnType<typeof userEvent.setup>, style: string) {
  await user.click(screen.getByRole('button', { name: 'Border' }));
  await user.click(screen.getByRole('menuitem', { name: style }));
}

describe('Border tool', () => {
  it('shows the bar, the pointer message, and a strip on every side once armed', async () => {
    const user = open();
    expect(screen.queryByRole('group', { name: 'Border tool' })).toBeNull();
    await arm(user, 'Full Radius Out');
    expect(screen.getByRole('heading', { name: 'Applying Full Radius Out' })).toBeTruthy();
    expect(screen.getByText('Click on any border')).toBeTruthy();
    expect(screen.getAllByRole('button', { name: /^Side [A-D] of A-1$/ })).toHaveLength(4);
    // Nothing to type until a side is picked.
    expect(screen.queryByRole('form', { name: 'Border measurements' })).toBeNull();
  });

  it('Full Radius Out asks for one arc height (named by its side) and bows that side', async () => {
    const user = open();
    await arm(user, 'Full Radius Out');
    await user.click(screen.getByRole('button', { name: 'Side A of A-1' }));
    const height = screen.getByRole('textbox', { name: 'A, arc height' }) as HTMLInputElement;
    expect(height.value).toBe('76.2mm');
    await user.clear(height);
    await user.type(height, '100mm');
    await user.click(screen.getByRole('button', { name: 'Apply' }));
    expect(read().edges).toMatchObject([{ index: 0, arcHeightMm: 100, borderStyle: 'fullRadiusOut' }]);
    expect(read().outline).toHaveLength(4);
    // Drawn as a true arc, not a straight line between the same corners.
    expect(document.querySelector('path[d*=" A"][class*="stroke-stone-900"]')).not.toBeNull();
    // The tool stays armed for the next side, with nothing picked.
    expect(screen.getByTestId('tool').textContent).toBe('border');
    expect(screen.queryByRole('form', { name: 'Border measurements' })).toBeNull();
  });

  it('Bump Out asks for gap, height and gap — each named by the letters of its sides — and builds the bump', async () => {
    const user = open();
    await arm(user, 'Bump Out');
    await user.click(screen.getByRole('button', { name: 'Side A of A-1' }));
    const gap1 = screen.getByRole('textbox', { name: 'A, gap' }) as HTMLInputElement;
    const height = screen.getByRole('textbox', { name: 'B, D, height' }) as HTMLInputElement;
    const gap2 = screen.getByRole('textbox', { name: 'E, gap' }) as HTMLInputElement;
    expect([gap1.value, height.value, gap2.value]).toEqual(['101.6mm', '76.2mm', '101.6mm']);
    await user.clear(gap1);
    await user.type(gap1, '200mm');
    await user.clear(height);
    await user.type(height, '50mm');
    await user.click(screen.getByRole('button', { name: 'Apply' }));
    expect(read().shape).toBe('polygon');
    expect(read().outline.slice(0, 6)).toEqual([
      { x: 0, y: 0 }, { x: 200, y: 0 }, { x: 200, y: 50 }, { x: 1898.4, y: 50 }, { x: 1898.4, y: 0 }, { x: 2000, y: 0 },
    ]);
  });

  it('names the inputs by whichever side was clicked, so the letters match the drawing', async () => {
    const user = open();
    await arm(user, 'Arc Bump In');
    await user.click(screen.getByRole('button', { name: 'Side C of A-1' }));
    expect(screen.getByRole('textbox', { name: 'C, gap' })).toBeTruthy();
    expect(screen.getByRole('textbox', { name: 'D, arch height' })).toBeTruthy();
    expect(screen.getByRole('textbox', { name: 'E, gap' })).toBeTruthy();
  });

  it('switching style in the bar keeps the clicked side and re-labels the inputs', async () => {
    const user = open();
    await arm(user, 'Bump Out');
    await user.click(screen.getByRole('button', { name: 'Side A of A-1' }));
    await user.click(screen.getByRole('button', { name: 'Arc Bump Out' }));
    expect(screen.getByRole('heading', { name: 'Applying Arc Bump Out' })).toBeTruthy();
    expect(screen.getByRole('textbox', { name: 'B, arch height' })).toBeTruthy();
  });

  it('refuses numbers that cannot work and leaves the piece alone', async () => {
    const user = open();
    await arm(user, 'Bump Out');
    await user.click(screen.getByRole('button', { name: 'Side A of A-1' }));
    const gap1 = screen.getByRole('textbox', { name: 'A, gap' });
    await user.clear(gap1);
    await user.type(gap1, '1900mm');
    await user.click(screen.getByRole('button', { name: 'Apply' }));
    expect((await screen.findByRole('alert')).textContent).toBe('The gaps leave no room on side A.');
    expect(read().outline).toHaveLength(4);
  });

  it('says what is wrong with text that is not a length', async () => {
    const user = open();
    await arm(user, 'Full Radius In');
    await user.click(screen.getByRole('button', { name: 'Side B of A-1' }));
    const height = screen.getByRole('textbox', { name: 'B, arc height' });
    await user.clear(height);
    await user.type(height, 'tall');
    await user.click(screen.getByRole('button', { name: 'Apply' }));
    expect((await screen.findByRole('alert')).textContent).toMatch(/isn't a length/);
    expect(read().edges).toEqual([]);
  });

  it('a side that already has a border takes no second one until it is made standard again', async () => {
    const user = open();
    await arm(user, 'Bump Out');
    await user.click(screen.getByRole('button', { name: 'Side A of A-1' }));
    await user.click(screen.getByRole('button', { name: 'Apply' }));
    expect(read().outline).toHaveLength(8);

    // Any of the bump's five sides (A-E) says so instead of offering the numbers.
    await user.click(screen.getByRole('button', { name: 'Side C of A-1' }));
    expect(screen.queryByRole('form', { name: 'Border measurements' })).toBeNull();
    const existing = screen.getByRole('group', { name: 'Existing border' });
    expect(existing.textContent).toMatch(/Sides A–E already have a Bump Out/);
    // Picking another style in the bar does not get round it.
    await user.click(screen.getByRole('button', { name: 'Full Radius Out' }));
    expect(screen.queryByRole('form', { name: 'Border measurements' })).toBeNull();
    expect(read().outline).toHaveLength(8);

    // Making it standard puts the straight side back, and then anything can go on it.
    await user.click(screen.getByRole('button', { name: 'Make standard' }));
    expect(read().outline).toEqual(rectOutline(2000, 800));
    expect(read().edges).toEqual([]);
    expect(screen.queryByRole('group', { name: 'Existing border' })).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Side A of A-1' }));
    await user.click(screen.getByRole('button', { name: 'Apply' }));
    expect(read().edges).toMatchObject([{ index: 0, arcHeightMm: 76.2, borderStyle: 'fullRadiusOut' }]);
  });

  it('Make standard is one undo step', async () => {
    const user = open();
    await arm(user, 'Full Radius Out');
    await user.click(screen.getByRole('button', { name: 'Side B of A-1' }));
    await user.click(screen.getByRole('button', { name: 'Apply' }));
    await user.click(screen.getByRole('button', { name: 'Side B of A-1' }));
    expect(screen.getByRole('group', { name: 'Existing border' }).textContent).toMatch(/Side B already has a Full Radius Out/);
    await user.click(screen.getByRole('button', { name: 'Make standard' }));
    expect(read().edges).toEqual([]);
    await user.click(screen.getByRole('button', { name: 'undo' }));
    expect(read().edges).toHaveLength(1);
  });

  it('is one undo step, and Close (Esc) or the Escape key hands back to Select', async () => {
    const user = open();
    await arm(user, 'Full Radius Out');
    await user.click(screen.getByRole('button', { name: 'Side A of A-1' }));
    await user.click(screen.getByRole('button', { name: 'Apply' }));
    expect(read().edges).toHaveLength(1);
    await user.click(screen.getByRole('button', { name: 'undo' }));
    expect(read().edges).toEqual([]);

    await user.click(screen.getByRole('button', { name: 'Close (Esc)' }));
    expect(screen.getByTestId('tool').textContent).toBe('select');
    expect(screen.queryByRole('group', { name: 'Border tool' })).toBeNull();
    await arm(user, 'Bump In');
    await user.keyboard('{Escape}');
    expect(screen.getByTestId('tool').textContent).toBe('select');
  });
});
