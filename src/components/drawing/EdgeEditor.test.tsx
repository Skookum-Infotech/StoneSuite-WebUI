// @vitest-environment jsdom
// The edge editor dialog: change the picked type, add a new one, the finishes,
// and the ways saving can be refused.

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';

vi.mock('@/services/drawingService', () => ({
  drawingService: { getEdgeTypes: vi.fn(), createEdgeType: vi.fn(), updateEdgeType: vi.fn() },
}));

import { drawingService } from '@/services/drawingService';
import { arm, edges, open, picker, resetEdgeServer, tool } from './edgeToolHarness';

beforeEach(resetEdgeServer);

describe('edge editor', () => {
  it('opens on the picked type with its values, and saves a change to it', async () => {
    const user = open();
    await arm(user);
    await user.click(screen.getByRole('button', { name: 'Edit edge' }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByRole('heading', { name: 'Edit edge' })).toBeTruthy();
    expect(within(dialog).getByLabelText('Name')).toHaveValue('Ease');
    expect(within(dialog).getByLabelText('Price')).toHaveValue(0);
    expect(within(dialog).getByLabelText('Alias')).toHaveValue('E');
    expect(within(dialog).getByLabelText('Color')).toHaveValue('#2563eb');
    expect(within(dialog).getByRole('combobox', { name: 'Pricing type' }).textContent).toContain('Linear');
    expect(within(dialog).getByRole('radio', { name: 'Eased' })).toBeChecked();

    const price = within(dialog).getByLabelText('Price');
    await user.clear(price);
    await user.type(price, '12.5');
    await user.click(within(dialog).getByRole('radio', { name: 'Ogee' }));
    await user.click(within(dialog).getByRole('button', { name: 'Save' }));

    expect(drawingService.updateEdgeType).toHaveBeenCalledWith('e1', {
      name: 'Ease', pricingType: 'linear', price: 12.5, alias: 'E', color: '#2563eb', finish: 'ogee',
    });
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(tool()).toBe('edge');
  });

  it('offers the eight finishes, None first, and shows no finish on the sketch', async () => {
    const user = open();
    await arm(user);
    await user.click(screen.getByRole('button', { name: 'Edit edge' }));
    const group = await screen.findByRole('radiogroup', { name: 'Finish (3D)' });
    expect(within(group).getAllByRole('radio').map((r) => r.getAttribute('aria-label'))).toEqual(
      ['None', 'Raw', 'Ogee', 'Beveled', 'Eased', 'Waterfall', 'Half Bullnose', 'Bullnose'],
    );
    await user.click(within(group).getByRole('radio', { name: 'Bullnose' }));
    expect(within(group).getByRole('radio', { name: 'Bullnose' })).toBeChecked();
    expect(within(group).getByRole('radio', { name: 'Eased' })).not.toBeChecked();
  });

  it('adds a new type, which then becomes the one painted with', async () => {
    const user = open();
    await arm(user);
    await user.click(picker());
    await user.click(await screen.findByRole('button', { name: 'Add new' }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByRole('heading', { name: 'New edge' })).toBeTruthy();
    expect(within(dialog).getByLabelText('Name')).toHaveValue('');
    expect(within(dialog).getByRole('radio', { name: 'None' })).toBeChecked();

    // Nothing is sent until it is valid.
    await user.click(within(dialog).getByRole('button', { name: 'Save' }));
    expect(within(dialog).getByRole('alert').textContent).toBe('Enter a name for the edge.');
    expect(drawingService.createEdgeType).not.toHaveBeenCalled();

    await user.type(within(dialog).getByLabelText('Name'), 'Cove');
    await user.type(within(dialog).getByLabelText('Alias'), 'C');
    fireEvent.change(within(dialog).getByLabelText('Color'), { target: { value: '#aa00ff' } });
    await user.click(within(dialog).getByRole('radio', { name: 'Bullnose' }));
    await user.click(within(dialog).getByRole('button', { name: 'Save' }));

    expect(drawingService.createEdgeType).toHaveBeenCalledWith({
      name: 'Cove', pricingType: 'linear', price: 0, alias: 'C', color: '#aa00ff', finish: 'bullnose',
    });
    await waitFor(() => expect(picker().textContent).toContain('Cove'));
    expect(screen.queryByRole('dialog')).toBeNull();

    await user.click(screen.getByRole('button', { name: 'Side A of A-1' }));
    expect(edges()).toEqual([{ index: 0, edgeTypeId: 'new1' }]);
    expect(screen.getByTestId('edge-color-0').getAttribute('stroke')).toBe('#aa00ff');
  });

  it('refuses a name that is already in the list, without asking the server', async () => {
    const user = open();
    await arm(user);
    await user.click(picker());
    await user.click(await screen.findByRole('button', { name: 'Add new' }));
    const dialog = await screen.findByRole('dialog');
    await user.type(within(dialog).getByLabelText('Name'), 'appliance');
    await user.click(within(dialog).getByRole('button', { name: 'Save' }));
    expect(within(dialog).getByRole('alert').textContent).toBe('An edge with that name already exists.');
    expect(drawingService.createEdgeType).not.toHaveBeenCalled();
  });

  it('shows the server\'s reason and stays open when saving fails', async () => {
    vi.mocked(drawingService.createEdgeType).mockRejectedValueOnce(new Error('You do not have permission to change edge types.'));
    const user = open();
    await arm(user);
    await user.click(picker());
    await user.click(await screen.findByRole('button', { name: 'Add new' }));
    const dialog = await screen.findByRole('dialog');
    await user.type(within(dialog).getByLabelText('Name'), 'Cove');
    await user.click(within(dialog).getByRole('button', { name: 'Save' }));
    expect((await within(dialog).findByRole('alert')).textContent).toBe('You do not have permission to change edge types.');
    expect(screen.getByRole('dialog')).toBeTruthy();
  });

  it('closes with Back or Escape without saving, and Escape leaves the tool armed', async () => {
    const user = open();
    await arm(user);
    await user.click(screen.getByRole('button', { name: 'Edit edge' }));
    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Back' }));
    expect(screen.queryByRole('dialog')).toBeNull();

    await user.click(screen.getByRole('button', { name: 'Edit edge' }));
    await screen.findByRole('dialog');
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(tool()).toBe('edge');
    expect(drawingService.updateEdgeType).not.toHaveBeenCalled();
    // Now nothing is open, Escape closes the tool.
    await user.keyboard('{Escape}');
    expect(tool()).toBe('select');
  });
});
