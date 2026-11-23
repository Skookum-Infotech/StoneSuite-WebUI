// @vitest-environment jsdom
// The Edges tool end to end: arm it from the rail, pick an edge type in the bar
// and click a side to paint it. The editor dialog is in EdgeEditor.test.tsx.

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, screen, within } from '@testing-library/react';

vi.mock('@/services/drawingService', () => ({
  drawingService: { getEdgeTypes: vi.fn(), createEdgeType: vi.fn(), updateEdgeType: vi.fn() },
}));

import { arm, edges, open, pick, picker, resetEdgeServer, setServerTypes, tool } from './edgeToolHarness';

beforeEach(resetEdgeServer);

describe('Edges tool', () => {
  it('arms from the rail with the bar, the pointer message and a dot of the picked colour', async () => {
    const user = open();
    expect(screen.queryByRole('group', { name: 'Edges tool' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Edges' })).toBeEnabled();
    await arm(user);
    expect(tool()).toBe('edge');
    expect(screen.getByRole('heading', { name: 'Edges' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Close (Esc)' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Edit edge' })).toBeEnabled();
    expect(screen.getByText('Click on a border to apply')).toBeTruthy();
    // The first type stands in until one is picked.
    expect(screen.getByText('Ease', { selector: 'span.font-semibold' })).toBeTruthy();
  });

  it('lists the shop\'s edge types with Add new last', async () => {
    const user = open();
    await arm(user);
    await user.click(picker());
    const list = await screen.findByRole('listbox', { name: 'Edge type' });
    expect(within(list).getAllByRole('option').map((o) => o.textContent)).toEqual(['Ease', 'Appliance', 'Finished', 'Unfinished']);
    expect(screen.getByRole('button', { name: 'Add new' })).toBeTruthy();
  });

  it('paints a clicked side in the picked type\'s colour', async () => {
    const user = open();
    await arm(user);
    await pick(user, 'Appliance');
    expect(picker().textContent).toContain('Appliance');
    expect(screen.getByText('Appliance', { selector: 'span.font-semibold' })).toBeTruthy();

    await user.click(screen.getByRole('button', { name: 'Side B of A-1' }));
    expect(edges()).toEqual([{ index: 1, edgeTypeId: 'e2' }]);
    expect(screen.getByTestId('edge-color-1').getAttribute('stroke')).toBe('#15803d');
    // Only that side is coloured.
    expect(screen.queryByTestId('edge-color-0')).toBeNull();
  });

  it('paints each side in the type picked at the time, and a later type replaces an earlier one', async () => {
    const user = open();
    await arm(user);
    await user.click(screen.getByRole('button', { name: 'Side A of A-1' }));
    await pick(user, 'Unfinished');
    await user.click(screen.getByRole('button', { name: 'Side C of A-1' }));
    await user.click(screen.getByRole('button', { name: 'Side A of A-1' }));
    expect(edges()).toEqual([{ index: 0, edgeTypeId: 'e4' }, { index: 2, edgeTypeId: 'e4' }]);
    expect(screen.getByTestId('edge-color-0').getAttribute('stroke')).toBe('#6b7280');
  });

  it('is one undo step per painted side, and painting the same type again adds none', async () => {
    const user = open();
    await arm(user);
    await user.click(screen.getByRole('button', { name: 'Side B of A-1' }));
    await user.click(screen.getByRole('button', { name: 'Side B of A-1' }));
    await user.click(screen.getByRole('button', { name: 'undo' }));
    expect(edges()).toEqual([]);
  });

  it('paints with the keyboard', async () => {
    const user = open();
    await arm(user);
    screen.getByRole('button', { name: 'Side D of A-1' }).focus();
    await user.keyboard('{Enter}');
    expect(edges()).toEqual([{ index: 3, edgeTypeId: 'e1' }]);
  });

  it('keeps the colour when the tool is closed, and keeps the picked type when it is reopened', async () => {
    const user = open();
    await arm(user);
    await pick(user, 'Finished');
    await user.click(screen.getByRole('button', { name: 'Side A of A-1' }));
    await user.click(screen.getByRole('button', { name: 'Close (Esc)' }));
    expect(tool()).toBe('select');
    expect(screen.queryByRole('group', { name: 'Edges tool' })).toBeNull();
    expect(screen.getByTestId('edge-color-0').getAttribute('stroke')).toBe('#d97706');

    await user.click(screen.getByRole('button', { name: 'Edges' }));
    expect(picker().textContent).toContain('Finished');
    await user.keyboard('{Escape}');
    expect(tool()).toBe('select');
  });

  it('is toggled by the E key', async () => {
    open();
    const canvas = screen.getByRole('application', { name: 'Drawing canvas' });
    fireEvent.keyDown(canvas, { key: 'e' });
    expect(tool()).toBe('edge');
    fireEvent.keyDown(canvas, { key: 'e' });
    expect(tool()).toBe('select');
  });

  it('draws no colour for a side whose type is not in the list', async () => {
    setServerTypes([]);
    const user = open();
    await user.click(screen.getByRole('button', { name: 'Edges' }));
    expect(await screen.findByText(/No edge types yet/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Edit edge' })).toBeDisabled();
    // With nothing to paint, a click on a side changes nothing.
    await user.click(screen.getByRole('button', { name: 'Side A of A-1' }));
    expect(edges()).toEqual([]);
  });
});
