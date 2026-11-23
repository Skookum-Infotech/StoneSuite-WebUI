// @vitest-environment jsdom
// The profile editor dialog: change the picked type, add a new one, the
// measurements list, angle/finish pickers, and the ways saving can be
// refused. Mirrors EdgeEditor.test.tsx.

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';

vi.mock('@/services/drawingService', () => ({
  drawingService: { getAttachedProfileTypes: vi.fn(), createAttachedProfileType: vi.fn(), updateAttachedProfileType: vi.fn() },
}));

import { drawingService } from '@/services/drawingService';
import { arm, edges, open, picker, resetProfileServer, tool } from './profileToolHarness';

beforeEach(resetProfileServer);

describe('profile editor', () => {
  it('opens on the picked type with its values, including its measurement presets, and saves a change to it', async () => {
    const user = open();
    await arm(user);
    await user.click(screen.getByRole('button', { name: 'Edit profile' }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByRole('heading', { name: 'Edit profile' })).toBeTruthy();
    expect(within(dialog).getByLabelText('Name')).toHaveValue('Backsplash');
    expect(within(dialog).getByLabelText('Price')).toHaveValue(12);
    expect(within(dialog).getByLabelText('Alias')).toHaveValue('BS');
    expect(within(dialog).getByLabelText('Color')).toHaveValue('#2563eb');
    expect(within(dialog).getByLabelText('Measurement 1')).toHaveValue(101.6);
    expect(within(dialog).getByLabelText('Measurement 2')).toHaveValue(152.4);
    expect(within(dialog).getByRole('radio', { name: '90°' })).toBeChecked();
    expect(within(dialog).getByRole('radio', { name: 'None' })).toBeChecked();

    const price = within(dialog).getByLabelText('Price');
    await user.clear(price);
    await user.type(price, '15.5');
    await user.click(within(dialog).getByRole('radio', { name: 'Mitered' }));
    await user.click(within(dialog).getByRole('button', { name: 'Save' }));

    expect(drawingService.updateAttachedProfileType).toHaveBeenCalledWith('p1', {
      name: 'Backsplash', pricingType: 'linear', price: 15.5, alias: 'BS', color: '#2563eb',
      measurementPresetsMm: [101.6, 152.4], angle: 90, finish: 'mitered',
    });
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(tool()).toBe('profile');
  });

  it('offers the three angles and two finishes', async () => {
    const user = open();
    await arm(user);
    await user.click(screen.getByRole('button', { name: 'Edit profile' }));
    const angles = await screen.findByRole('radiogroup', { name: 'Angle (3D)' });
    expect(within(angles).getAllByRole('radio').map((r) => r.getAttribute('aria-label'))).toEqual(['90°', '180°', '270°']);
    const finishes = screen.getByRole('radiogroup', { name: 'Finish (3D)' });
    expect(within(finishes).getAllByRole('radio').map((r) => r.getAttribute('aria-label'))).toEqual(['None', 'Mitered']);
  });

  it('adds and removes measurement rows, and refuses saving with none left', async () => {
    const user = open();
    await arm(user);
    await user.click(screen.getByRole('button', { name: 'Edit profile' }));
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: 'Add measurement' }));
    expect(within(dialog).getByLabelText('Measurement 3')).toBeTruthy();

    await user.click(within(dialog).getByRole('button', { name: 'Remove measurement 3' }));
    expect(within(dialog).queryByLabelText('Measurement 3')).toBeNull();
    await user.click(within(dialog).getByRole('button', { name: 'Remove measurement 2' }));
    await user.clear(within(dialog).getByLabelText('Measurement 1'));
    await user.click(within(dialog).getByRole('button', { name: 'Save' }));
    expect(within(dialog).getByRole('alert').textContent).toBe('Add at least one measurement.');
    expect(drawingService.updateAttachedProfileType).not.toHaveBeenCalled();
  });

  it('adds a new type with its own measurements, which then becomes the one painted with', async () => {
    const user = open();
    await arm(user);
    await user.click(picker());
    await user.click(await screen.findByRole('button', { name: 'Add new' }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByRole('heading', { name: 'New profile' })).toBeTruthy();
    expect(within(dialog).getByLabelText('Name')).toHaveValue('');
    expect(within(dialog).getByRole('radio', { name: '180°' })).toBeChecked();
    expect(within(dialog).getByRole('radio', { name: 'None' })).toBeChecked();

    // Nothing is sent until it is valid.
    await user.click(within(dialog).getByRole('button', { name: 'Save' }));
    expect(within(dialog).getByRole('alert').textContent).toBe('Enter a name for the profile.');
    expect(drawingService.createAttachedProfileType).not.toHaveBeenCalled();

    await user.type(within(dialog).getByLabelText('Name'), 'Bar Top');
    await user.type(within(dialog).getByLabelText('Alias'), 'BT');
    fireEvent.change(within(dialog).getByLabelText('Color'), { target: { value: '#aa00ff' } });
    await user.type(within(dialog).getByLabelText('Measurement 1'), '50');
    await user.click(within(dialog).getByRole('radio', { name: '270°' }));
    await user.click(within(dialog).getByRole('radio', { name: 'Mitered' }));
    await user.click(within(dialog).getByRole('button', { name: 'Save' }));

    expect(drawingService.createAttachedProfileType).toHaveBeenCalledWith({
      name: 'Bar Top', pricingType: 'linear', price: 0, alias: 'BT', color: '#aa00ff',
      measurementPresetsMm: [50], angle: 270, finish: 'mitered',
    });
    await waitFor(() => expect(picker().textContent).toContain('Bar Top'));
    expect(screen.queryByRole('dialog')).toBeNull();

    await user.click(screen.getByRole('button', { name: 'Side A of A-1' }));
    expect(edges()).toEqual([{ index: 0, attachedProfile: { profileTypeId: 'new1', measurementMm: 50 } }]);
  });

  it('refuses a name that is already in the list, without asking the server', async () => {
    const user = open();
    await arm(user);
    await user.click(picker());
    await user.click(await screen.findByRole('button', { name: 'Add new' }));
    const dialog = await screen.findByRole('dialog');
    await user.type(within(dialog).getByLabelText('Name'), 'lamination');
    await user.type(within(dialog).getByLabelText('Measurement 1'), '50');
    await user.click(within(dialog).getByRole('button', { name: 'Save' }));
    expect(within(dialog).getByRole('alert').textContent).toBe('A profile with that name already exists.');
    expect(drawingService.createAttachedProfileType).not.toHaveBeenCalled();
  });

  it('shows the server\'s reason and stays open when saving fails', async () => {
    vi.mocked(drawingService.createAttachedProfileType).mockRejectedValueOnce(new Error('You do not have permission to change profile types.'));
    const user = open();
    await arm(user);
    await user.click(picker());
    await user.click(await screen.findByRole('button', { name: 'Add new' }));
    const dialog = await screen.findByRole('dialog');
    await user.type(within(dialog).getByLabelText('Name'), 'Bar Top');
    await user.type(within(dialog).getByLabelText('Measurement 1'), '50');
    await user.click(within(dialog).getByRole('button', { name: 'Save' }));
    expect((await within(dialog).findByRole('alert')).textContent).toBe('You do not have permission to change profile types.');
    expect(screen.getByRole('dialog')).toBeTruthy();
  });

  it('closes with Back or Escape without saving, and Escape leaves the tool armed', async () => {
    const user = open();
    await arm(user);
    await user.click(screen.getByRole('button', { name: 'Edit profile' }));
    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Back' }));
    expect(screen.queryByRole('dialog')).toBeNull();

    await user.click(screen.getByRole('button', { name: 'Edit profile' }));
    await screen.findByRole('dialog');
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(tool()).toBe('profile');
    expect(drawingService.updateAttachedProfileType).not.toHaveBeenCalled();
    // Now nothing is open, Escape closes the tool.
    await user.keyboard('{Escape}');
    expect(tool()).toBe('select');
  });
});
