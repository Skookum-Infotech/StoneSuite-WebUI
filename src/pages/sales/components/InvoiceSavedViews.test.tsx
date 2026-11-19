import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { InvoiceSavedViews } from './InvoiceSavedViews';
import { useAuthStore } from '@/store/useAuthStore';
import { ADD_VIEW_MESSAGES, MAX_SAVED_VIEWS, MAX_VIEW_NAME_LENGTH, savedViewsKey } from '@/lib/savedViews';
import { INVOICE_VIEWS_PAGE, type InvoiceViewState } from '@/lib/invoiceSavedViews';
import type { UserProfile } from '@/types/auth';

const TENANT = 'tenant-1';
const key = (userId = 'user-1') => savedViewsKey(INVOICE_VIEWS_PAGE, userId, TENANT);

const NONE: InvoiceViewState = { term: '', sortBy: 'createdAt', sortDir: 'desc' };
const OVERDUE: InvoiceViewState = { term: 'overdue', sortBy: 'balanceDue', sortDir: 'desc' };
const RECENT: InvoiceViewState = { term: '', sortBy: 'invoiceDate', sortDir: 'asc' };

function signIn(id: string) {
  useAuthStore.setState({
    user: { id, email: `${id}@example.com`, fullName: id } as UserProfile,
    activeTenantId: TENANT,
  });
}

function seed(views: { id: string; name: string; state: InvoiceViewState }[], userId = 'user-1') {
  window.localStorage.setItem(key(userId), JSON.stringify(views));
}

function stored(userId = 'user-1'): { name: string; state: InvoiceViewState }[] {
  return JSON.parse(window.localStorage.getItem(key(userId)) ?? '[]');
}

function setup(current: InvoiceViewState = NONE) {
  const onApply = vi.fn();
  const utils = render(<InvoiceSavedViews current={current} onApply={onApply} />);
  return { onApply, ...utils };
}

const saveButton = () => screen.getByRole('button', { name: 'Save view' });
const nameInput = () => screen.getByRole('textbox', { name: 'View name' });
const applyBox = () => screen.getByRole('combobox', { name: 'Apply a saved view' });

async function saveAs(user: ReturnType<typeof userEvent.setup>, name: string) {
  await user.click(saveButton());
  await user.type(nameInput(), name);
  await user.click(screen.getByRole('button', { name: 'Save' }));
}

describe('InvoiceSavedViews', () => {
  beforeEach(() => {
    window.localStorage.clear();
    signIn('user-1');
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('offers only "Save view" until something is saved', () => {
    setup();
    expect(saveButton()).toBeInTheDocument();
    expect(screen.queryByRole('combobox', { name: 'Apply a saved view' })).toBeNull();
  });

  it('saves the current search and sort under a name, and keeps it in this browser', async () => {
    const user = userEvent.setup();
    setup(OVERDUE);
    await saveAs(user, '  Overdue, biggest first ');

    expect(stored()).toEqual([{ id: expect.any(String), name: 'Overdue, biggest first', state: OVERDUE }]);
    // The form closes and the view is now the one the screen matches.
    expect(screen.queryByRole('textbox', { name: 'View name' })).toBeNull();
    expect(applyBox()).toHaveTextContent('Overdue, biggest first');
  });

  it('saves from the keyboard with Enter', async () => {
    const user = userEvent.setup();
    setup(OVERDUE);
    await user.click(saveButton());
    await user.type(nameInput(), 'Quick{Enter}');
    expect(stored().map((v) => v.name)).toEqual(['Quick']);
  });

  it('applies a saved view when it is picked', async () => {
    seed([{ id: 'a', name: 'Overdue', state: OVERDUE }, { id: 'b', name: 'Oldest first', state: RECENT }]);
    const user = userEvent.setup();
    const { onApply } = setup(NONE);

    await user.click(applyBox());
    await user.click(await screen.findByRole('option', { name: 'Oldest first' }));
    expect(onApply).toHaveBeenCalledTimes(1);
    expect(onApply).toHaveBeenCalledWith(RECENT);
  });

  it('deletes the view the screen matches, and keeps the others', async () => {
    seed([{ id: 'a', name: 'Overdue', state: OVERDUE }, { id: 'b', name: 'Oldest first', state: RECENT }]);
    const user = userEvent.setup();
    setup(OVERDUE);

    await user.click(screen.getByRole('button', { name: 'Delete saved view Overdue' }));
    expect(stored().map((v) => v.name)).toEqual(['Oldest first']);
    expect(screen.queryByRole('button', { name: /^Delete saved view/ })).toBeNull();
  });

  it('offers delete only for a view the screen currently matches', () => {
    seed([{ id: 'a', name: 'Overdue', state: OVERDUE }]);
    setup(NONE);
    expect(screen.queryByRole('button', { name: /^Delete saved view/ })).toBeNull();
  });

  it('removes the dropdown again after the last view is deleted', async () => {
    seed([{ id: 'a', name: 'Overdue', state: OVERDUE }]);
    setup(OVERDUE);
    await userEvent.setup().click(screen.getByRole('button', { name: 'Delete saved view Overdue' }));
    expect(stored()).toEqual([]);
    expect(screen.queryByRole('combobox', { name: 'Apply a saved view' })).toBeNull();
  });

  describe('names', () => {
    it.each([
      ['empty', '', ADD_VIEW_MESSAGES.empty],
      ['blank', '   ', ADD_VIEW_MESSAGES.empty],
      ['a repeat of an existing view, ignoring case', 'overdue', ADD_VIEW_MESSAGES.duplicate],
      ['too long', 'x'.repeat(MAX_VIEW_NAME_LENGTH + 1), ADD_VIEW_MESSAGES['too-long']],
    ])('refuses a name that is %s, says why, and saves nothing', async (_label, typed, message) => {
      seed([{ id: 'a', name: 'Overdue', state: OVERDUE }]);
      const user = userEvent.setup();
      setup(RECENT);
      await user.click(saveButton());
      if (typed) await user.type(nameInput(), typed);
      await user.click(screen.getByRole('button', { name: 'Save' }));

      expect(screen.getByRole('alert')).toHaveTextContent(message);
      expect(nameInput()).toHaveAttribute('aria-invalid', 'true');
      expect(stored()).toHaveLength(1);
    });

    it('clears the message as soon as the name is edited', async () => {
      const user = userEvent.setup();
      setup();
      await user.click(saveButton());
      await user.click(screen.getByRole('button', { name: 'Save' }));
      expect(screen.getByRole('alert')).toBeInTheDocument();
      await user.type(nameInput(), 'a');
      expect(screen.queryByRole('alert')).toBeNull();
    });

    it('Cancel closes the form without saving', async () => {
      const user = userEvent.setup();
      setup();
      await user.click(saveButton());
      await user.type(nameInput(), 'Never saved');
      await user.click(screen.getByRole('button', { name: 'Cancel' }));
      expect(screen.queryByRole('textbox', { name: 'View name' })).toBeNull();
      expect(stored()).toEqual([]);
    });
  });

  describe('the limit of 20', () => {
    const twenty = Array.from({ length: MAX_SAVED_VIEWS }, (_, i) => ({ id: `id-${i}`, name: `View ${i}`, state: NONE }));

    it('takes the 20th view', async () => {
      seed(twenty.slice(0, MAX_SAVED_VIEWS - 1));
      const user = userEvent.setup();
      setup(OVERDUE);
      await saveAs(user, 'Number twenty');
      expect(stored()).toHaveLength(MAX_SAVED_VIEWS);
    });

    it('refuses the 21st, says so, and keeps the 20', async () => {
      seed(twenty);
      const user = userEvent.setup();
      setup(OVERDUE);
      await saveAs(user, 'Number twenty-one');
      expect(screen.getByRole('alert')).toHaveTextContent(ADD_VIEW_MESSAGES.limit);
      expect(stored()).toHaveLength(MAX_SAVED_VIEWS);
    });

    it('lets a view be saved again after one is deleted', async () => {
      seed(twenty);
      const user = userEvent.setup();
      setup({ ...NONE });
      await user.click(screen.getByRole('button', { name: /^Delete saved view View 0/ }));
      expect(stored()).toHaveLength(MAX_SAVED_VIEWS - 1);
    });
  });

  describe('when browser storage misbehaves', () => {
    it('ignores a corrupt entry and starts with no views', async () => {
      window.localStorage.setItem(key(), '{this is not json');
      const user = userEvent.setup();
      setup(OVERDUE);
      expect(screen.queryByRole('combobox', { name: 'Apply a saved view' })).toBeNull();
      // And saving over it works.
      await saveAs(user, 'Fresh start');
      expect(stored().map((v) => v.name)).toEqual(['Fresh start']);
    });

    it('shows the valid views and skips the malformed ones', async () => {
      window.localStorage.setItem(key(), JSON.stringify([
        { id: 'a', name: 'Good', state: OVERDUE },
        { id: 'b', name: 'Wrong sort', state: { term: '', sortBy: 'nope', sortDir: 'asc' } },
        'junk',
      ]));
      const user = userEvent.setup();
      setup(NONE);
      await user.click(applyBox());
      const options = await screen.findAllByRole('option');
      expect(options.map((o) => o.textContent)).toEqual(expect.arrayContaining(['Good']));
      expect(within(screen.getByRole('listbox')).queryByText('Wrong sort')).toBeNull();
    });

    it('does not crash when storage cannot be read at all', () => {
      vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
        throw new DOMException('blocked', 'SecurityError');
      });
      expect(() => setup()).not.toThrow();
      expect(saveButton()).toBeInTheDocument();
    });

    it('still lets a view be saved and used for now when storage will not keep it, and says so', async () => {
      vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new DOMException('full', 'QuotaExceededError');
      });
      const user = userEvent.setup();
      setup(OVERDUE);
      await saveAs(user, 'Only this session');

      expect(applyBox()).toHaveTextContent('Only this session');
      expect(screen.getByRole('status')).toHaveTextContent(/not keeping saved views/i);
    });
  });

  it('keeps each user\'s views to themselves', () => {
    seed([{ id: 'a', name: 'Mine', state: OVERDUE }], 'user-1');
    signIn('user-2');
    setup(OVERDUE);
    expect(screen.queryByRole('combobox', { name: 'Apply a saved view' })).toBeNull();
  });

  it('shows a saved view again after the page is reloaded', async () => {
    const user = userEvent.setup();
    const first = setup(OVERDUE);
    await saveAs(user, 'Survives reload');
    first.unmount();

    setup(OVERDUE);
    expect(applyBox()).toHaveTextContent('Survives reload');
  });
});
