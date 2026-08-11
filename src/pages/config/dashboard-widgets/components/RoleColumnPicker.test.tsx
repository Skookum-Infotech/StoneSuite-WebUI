import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RoleColumnPicker } from './RoleColumnPicker';

const ROLES = [
  { id: 'role-sales', name: 'Sales Rep' },
  { id: 'role-ops', name: 'Ops Manager' },
  { id: 'role-viewer', name: 'Viewer' },
];

describe('RoleColumnPicker', () => {
  it('shows how many of the full role list are currently selected', () => {
    render(
      <RoleColumnPicker roles={ROLES} selectedIds={['role-sales']} onChange={vi.fn()} onReset={vi.fn()} />,
    );
    expect(screen.getByText('Comparing 1 of 3 roles')).toBeInTheDocument();
  });

  it('renders a removable chip for each selected role', () => {
    render(
      <RoleColumnPicker
        roles={ROLES}
        selectedIds={['role-sales', 'role-ops']}
        onChange={vi.fn()}
        onReset={vi.fn()}
      />,
    );
    expect(screen.getByText('Sales Rep')).toBeInTheDocument();
    expect(screen.getByText('Ops Manager')).toBeInTheDocument();
  });

  it('calls onChange without the removed id when a chip is removed', async () => {
    const onChange = vi.fn();
    render(
      <RoleColumnPicker
        roles={ROLES}
        selectedIds={['role-sales', 'role-ops']}
        onChange={onChange}
        onReset={vi.fn()}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Remove Sales Rep from the comparison' }));
    expect(onChange).toHaveBeenCalledWith(['role-ops']);
  });

  it('only offers unselected roles in the search results', async () => {
    const onChange = vi.fn();
    render(
      <RoleColumnPicker roles={ROLES} selectedIds={['role-sales']} onChange={onChange} onReset={vi.fn()} />,
    );
    await userEvent.click(screen.getByLabelText('Search roles to add to the comparison'));
    expect(screen.queryByRole('button', { name: 'Sales Rep' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Ops Manager' })).toBeInTheDocument();
  });

  it('calls onChange with the added id when a search result is clicked', async () => {
    const onChange = vi.fn();
    render(
      <RoleColumnPicker roles={ROLES} selectedIds={['role-sales']} onChange={onChange} onReset={vi.fn()} />,
    );
    await userEvent.click(screen.getByLabelText('Search roles to add to the comparison'));
    await userEvent.click(screen.getByRole('button', { name: 'Ops Manager' }));
    expect(onChange).toHaveBeenCalledWith(['role-sales', 'role-ops']);
  });

  it('filters search results by query', async () => {
    const onChange = vi.fn();
    render(<RoleColumnPicker roles={ROLES} selectedIds={[]} onChange={onChange} onReset={vi.fn()} />);
    const input = screen.getByLabelText('Search roles to add to the comparison');
    await userEvent.type(input, 'view');
    expect(screen.getByRole('button', { name: 'Viewer' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Sales Rep' })).not.toBeInTheDocument();
  });

  it('calls onChange with every role id when "Select all" is clicked', async () => {
    const onChange = vi.fn();
    render(
      <RoleColumnPicker roles={ROLES} selectedIds={['role-sales']} onChange={onChange} onReset={vi.fn()} />,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Select all' }));
    expect(onChange).toHaveBeenCalledWith(['role-sales', 'role-ops', 'role-viewer']);
  });

  it('calls onReset when "Reset" is clicked', async () => {
    const onReset = vi.fn();
    render(
      <RoleColumnPicker roles={ROLES} selectedIds={['role-sales']} onChange={vi.fn()} onReset={onReset} />,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Reset' }));
    expect(onReset).toHaveBeenCalled();
  });
});
