import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SelectAllCheckbox, SelectRowCheckbox } from './SelectionCheckboxes';

describe('SelectRowCheckbox', () => {
  it.each([true, false])('reflects checked=%s and names the row', (checked) => {
    render(<SelectRowCheckbox checked={checked} label="Select INV-1" onToggle={() => {}} />);
    expect(screen.getByRole('checkbox', { name: 'Select INV-1', checked })).toBeInTheDocument();
  });

  it('toggles on click', async () => {
    const onToggle = vi.fn();
    render(<SelectRowCheckbox checked={false} label="Select INV-1" onToggle={onToggle} />);
    await userEvent.setup().click(screen.getByRole('checkbox', { name: 'Select INV-1' }));
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it('is reachable by Tab and toggles on Space', async () => {
    const onToggle = vi.fn();
    render(<SelectRowCheckbox checked={false} label="Select INV-1" onToggle={onToggle} />);
    const user = userEvent.setup();
    await user.tab();
    expect(screen.getByRole('checkbox', { name: 'Select INV-1' })).toHaveFocus();
    await user.keyboard(' ');
    expect(onToggle).toHaveBeenCalledTimes(1);
  });
});

describe('SelectAllCheckbox', () => {
  const cases = [
    { name: 'none ticked', selected: 0, page: 5, state: 'false' },
    { name: 'some ticked is a dash', selected: 2, page: 5, state: 'mixed' },
    { name: 'every row on the page', selected: 5, page: 5, state: 'true' },
    { name: 'an empty page is never ticked', selected: 0, page: 0, state: 'false' },
  ];
  it.each(cases)('$name', ({ selected, page, state }) => {
    render(<SelectAllCheckbox selectedCount={selected} pageCount={page} onToggle={() => {}} />);
    expect(screen.getByRole('checkbox', { name: 'Select all on this page' })).toHaveAttribute('aria-checked', state);
  });

  it('is disabled when there is nothing to select', () => {
    render(<SelectAllCheckbox selectedCount={0} pageCount={0} onToggle={() => {}} />);
    expect(screen.getByRole('checkbox', { name: 'Select all on this page' })).toBeDisabled();
  });

  it('toggles from the keyboard', async () => {
    const onToggle = vi.fn();
    render(<SelectAllCheckbox selectedCount={0} pageCount={3} onToggle={onToggle} />);
    await userEvent.setup().tab();
    await userEvent.setup().keyboard(' ');
    expect(onToggle).toHaveBeenCalledTimes(1);
  });
});
