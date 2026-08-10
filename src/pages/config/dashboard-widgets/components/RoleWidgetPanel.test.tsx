import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RoleWidgetPanel } from './RoleWidgetPanel';
import type { WidgetDefinition } from '@/types/dashboardWidgets';

const CATALOG: WidgetDefinition[] = [
  { id: 'core-1', title: 'Core 1', description: 'd1', category: 'core', size: 'full', defaultEnabled: true },
  { id: 'core-2', title: 'Core 2', description: 'd2', category: 'core', size: 'half', defaultEnabled: true },
  { id: 'sales-1', title: 'Sales 1', description: 'd3', category: 'sales', size: 'half', defaultEnabled: false },
];

const ROLE = { id: 'role-sales', name: 'Sales Rep', locked: false };
const OTHER_ROLES = [{ id: 'role-ops', name: 'Ops Manager' }];

describe('RoleWidgetPanel', () => {
  it('shows the allocated-of-total summary for an editable role', () => {
    render(
      <RoleWidgetPanel
        role={ROLE}
        catalog={CATALOG}
        allocatedIds={['core-1']}
        otherEditableRoles={OTHER_ROLES}
        onChange={vi.fn()}
        onCopyFrom={vi.fn()}
      />,
    );
    expect(screen.getByText('1 of 3 widgets allocated.')).toBeInTheDocument();
  });

  it('applies a preset via onChange when a preset chip is clicked', async () => {
    const onChange = vi.fn();
    render(
      <RoleWidgetPanel
        role={ROLE}
        catalog={CATALOG}
        allocatedIds={[]}
        otherEditableRoles={OTHER_ROLES}
        onChange={onChange}
        onCopyFrom={vi.fn()}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Apply the Essentials preset to Sales Rep' }));
    expect(onChange).toHaveBeenCalledWith(['core-1', 'core-2']);
  });

  it('marks the matching preset as active', () => {
    render(
      <RoleWidgetPanel
        role={ROLE}
        catalog={CATALOG}
        allocatedIds={['core-1', 'core-2']}
        otherEditableRoles={OTHER_ROLES}
        onChange={vi.fn()}
        onCopyFrom={vi.fn()}
      />,
    );
    expect(screen.getByRole('button', { name: 'Apply the Essentials preset to Sales Rep' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it('toggles a single widget tile via onChange', async () => {
    const onChange = vi.fn();
    render(
      <RoleWidgetPanel
        role={ROLE}
        catalog={CATALOG}
        allocatedIds={['core-1']}
        otherEditableRoles={OTHER_ROLES}
        onChange={onChange}
        onCopyFrom={vi.fn()}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Add Core 2' }));
    expect(onChange).toHaveBeenCalledWith(['core-1', 'core-2']);
  });

  it('clears an entire category via the category toggle when fully on', async () => {
    const onChange = vi.fn();
    render(
      <RoleWidgetPanel
        role={ROLE}
        catalog={CATALOG}
        allocatedIds={['core-1', 'core-2', 'sales-1']}
        otherEditableRoles={OTHER_ROLES}
        onChange={onChange}
        onCopyFrom={vi.fn()}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Clear every Core widget for Sales Rep' }));
    expect(onChange).toHaveBeenCalledWith(['sales-1']);
  });

  it('calls onCopyFrom with the selected role id', async () => {
    const onCopyFrom = vi.fn();
    render(
      <RoleWidgetPanel
        role={ROLE}
        catalog={CATALOG}
        allocatedIds={[]}
        otherEditableRoles={OTHER_ROLES}
        onChange={vi.fn()}
        onCopyFrom={onCopyFrom}
      />,
    );
    await userEvent.selectOptions(
      screen.getByLabelText('Copy widget allocation into Sales Rep from another role'),
      'role-ops',
    );
    expect(onCopyFrom).toHaveBeenCalledWith('role-ops');
  });

  it('renders a locked role as read-only with every tile checked and disabled, no presets or copy-from', () => {
    render(
      <RoleWidgetPanel
        role={{ id: 'role-admin', name: 'Tenant Admin', locked: true }}
        catalog={CATALOG}
        allocatedIds={[]}
        otherEditableRoles={OTHER_ROLES}
        onChange={vi.fn()}
        onCopyFrom={vi.fn()}
      />,
    );
    expect(screen.getByText('Tenant Admin always has every widget')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Apply the .* preset/ })).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/Copy widget allocation/)).not.toBeInTheDocument();
    const tile = screen.getByRole('button', { name: 'Remove Core 1' });
    expect(tile).toBeDisabled();
  });
});
