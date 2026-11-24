// @vitest-environment jsdom
// The Profiles tool end to end: arm it from the rail, pick a profile type and
// measurement in the bar and click a side to paint it. Mirrors EdgeTool.test.tsx.

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, screen, within } from '@testing-library/react';

vi.mock('@/services/drawingService', () => ({
  drawingService: { getAttachedProfileTypes: vi.fn(), createAttachedProfileType: vi.fn(), updateAttachedProfileType: vi.fn() },
}));

import { arm, edges, measurementSelect, open, pick, picker, resetProfileServer, setServerTypes, tool } from './profileToolHarness';

beforeEach(resetProfileServer);

describe('Profiles tool', () => {
  it('arms from the rail with the bar, the pointer message and a dot of the picked colour', async () => {
    const user = open();
    expect(screen.queryByRole('group', { name: 'Profiles tool' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Profiles' })).toBeEnabled();
    await arm(user);
    expect(tool()).toBe('profile');
    expect(screen.getByRole('heading', { name: 'Profiles' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Close (Esc)' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Edit profile' })).toBeEnabled();
    expect(screen.getByText('Click on a border to apply')).toBeTruthy();
    // The first type stands in until one is picked.
    expect(screen.getByText('Backsplash', { selector: 'span.font-semibold' })).toBeTruthy();
  });

  it('lists the shop\'s profile types with Add new last', async () => {
    const user = open();
    await arm(user);
    await user.click(picker());
    const list = await screen.findByRole('listbox', { name: 'Profile type' });
    expect(within(list).getAllByRole('option').map((o) => o.textContent)).toEqual(['Backsplash', 'Lamination', 'Miter Edge', 'Waterfall']);
    expect(screen.getByRole('button', { name: 'Add new' })).toBeTruthy();
  });

  it('offers the picked type\'s measurement presets, defaulting to the first', async () => {
    const user = open();
    await arm(user);
    expect(measurementSelect().textContent).toContain('101.6mm');
    await pick(user, 'Lamination');
    expect(measurementSelect().textContent).toContain('38.1mm');
  });

  it('paints a clicked side with the picked type and measurement', async () => {
    const user = open();
    await arm(user);
    await pick(user, 'Waterfall');
    expect(picker().textContent).toContain('Waterfall');

    await user.click(screen.getByRole('button', { name: 'Side B of A-1' }));
    expect(edges()).toEqual([{ index: 1, attachedProfile: { profileTypeId: 'p4', measurementMm: 609.6 } }]);
    expect(screen.getByText('A-1 Waterfall-B')).toBeTruthy();
  });

  it('paints with the measurement chosen in the bar, not just the type\'s first preset', async () => {
    const user = open();
    await arm(user);
    await user.click(measurementSelect());
    await user.click(await screen.findByRole('option', { name: '152.4mm' }));
    await user.click(screen.getByRole('button', { name: 'Side A of A-1' }));
    expect(edges()).toEqual([{ index: 0, attachedProfile: { profileTypeId: 'p1', measurementMm: 152.4 } }]);
  });

  it('paints each side in the type picked at the time, and a later type replaces an earlier one', async () => {
    const user = open();
    await arm(user);
    await user.click(screen.getByRole('button', { name: 'Side A of A-1' }));
    await pick(user, 'Miter Edge');
    await user.click(screen.getByRole('button', { name: 'Side C of A-1' }));
    await user.click(screen.getByRole('button', { name: 'Side A of A-1' }));
    expect(edges()).toEqual([
      { index: 0, attachedProfile: { profileTypeId: 'p3', measurementMm: 38.1 } },
      { index: 2, attachedProfile: { profileTypeId: 'p3', measurementMm: 38.1 } },
    ]);
  });

  it('is one undo step per painted side, and painting the same type and measurement again adds none', async () => {
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
    expect(edges()).toEqual([{ index: 3, attachedProfile: { profileTypeId: 'p1', measurementMm: 101.6 } }]);
  });

  it('keeps the painted piece when the tool is closed, and keeps the picked type when it is reopened', async () => {
    const user = open();
    await arm(user);
    await pick(user, 'Lamination');
    await user.click(screen.getByRole('button', { name: 'Side A of A-1' }));
    await user.click(screen.getByRole('button', { name: 'Close (Esc)' }));
    expect(tool()).toBe('select');
    expect(screen.queryByRole('group', { name: 'Profiles tool' })).toBeNull();
    expect(screen.getByText('A-1 Lamination-A')).toBeTruthy();

    await user.click(screen.getByRole('button', { name: 'Profiles' }));
    expect(picker().textContent).toContain('Lamination');
    await user.keyboard('{Escape}');
    expect(tool()).toBe('select');
  });

  it('shows the parent-to-profile arrow only while the Profiles tool is armed', async () => {
    const user = open();
    await arm(user);
    await pick(user, 'Waterfall');
    await user.click(screen.getByRole('button', { name: 'Side B of A-1' }));
    expect(screen.getByTestId('profile-attach-arrow')).toBeTruthy();

    await user.click(screen.getByRole('button', { name: 'Close (Esc)' }));
    expect(tool()).toBe('select');
    expect(screen.getByText('A-1 Waterfall-B')).toBeTruthy(); // the piece itself stays
    expect(screen.queryByTestId('profile-attach-arrow')).toBeNull();
  });

  it('dimensions the profile piece on both its length and its width', async () => {
    const user = open();
    await arm(user);
    await pick(user, 'Waterfall');
    await user.click(screen.getByRole('button', { name: 'Side B of A-1' }));
    const canvas = within(screen.getByRole('application', { name: 'Drawing canvas' }));
    expect(canvas.getByText('A-1 Waterfall-B')).toBeTruthy();
    expect(canvas.getByText('800mm')).toBeTruthy(); // side B's own length
    expect(canvas.getByText('609.6mm')).toBeTruthy(); // the painted width/measurement
  });

  it('is toggled by the P key', async () => {
    open();
    const canvas = screen.getByRole('application', { name: 'Drawing canvas' });
    fireEvent.keyDown(canvas, { key: 'p' });
    expect(tool()).toBe('profile');
    fireEvent.keyDown(canvas, { key: 'p' });
    expect(tool()).toBe('select');
  });

  it('paints nothing for a side when the shop has no profile types', async () => {
    setServerTypes([]);
    const user = open();
    await user.click(screen.getByRole('button', { name: 'Profiles' }));
    expect(await screen.findByText(/No profile types yet/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Edit profile' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Side A of A-1' }));
    expect(edges()).toEqual([]);
  });
});
