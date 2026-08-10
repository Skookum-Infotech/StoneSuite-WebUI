import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { WidgetAllocationCard } from './WidgetAllocationCard';
import type { WidgetDefinition } from '@/types/dashboardWidgets';

const WIDGET: WidgetDefinition = {
  id: 'kpi-strip',
  title: 'KPI Strip',
  description: 'Revenue, open leads, sales orders, and approvals at a glance.',
  category: 'core',
  size: 'full',
  defaultEnabled: true,
};

const ROLES = [
  { id: 'role-admin', name: 'Tenant Admin', locked: true },
  { id: 'role-sales', name: 'Sales Rep', locked: false },
  { id: 'role-accounting', name: 'Accountant', locked: false },
];

describe('WidgetAllocationCard', () => {
  it('renders an assigned chip for a role already allocated the widget', () => {
    render(
      <WidgetAllocationCard
        widget={WIDGET}
        roles={ROLES}
        assignedRoleIds={['role-sales']}
        onToggleRole={vi.fn()}
        onToggleAll={vi.fn()}
      />,
    );
    const chip = screen.getByRole('button', { name: 'Remove Sales Rep from KPI Strip' });
    expect(chip).toHaveAttribute('aria-pressed', 'true');
  });

  it('renders an unassigned chip for a role without the widget', () => {
    render(
      <WidgetAllocationCard
        widget={WIDGET}
        roles={ROLES}
        assignedRoleIds={['role-sales']}
        onToggleRole={vi.fn()}
        onToggleAll={vi.fn()}
      />,
    );
    const chip = screen.getByRole('button', { name: 'Add Accountant to KPI Strip' });
    expect(chip).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByText('+ Accountant')).toBeInTheDocument();
  });

  it('renders a locked role as a static badge, not a toggle button', () => {
    render(
      <WidgetAllocationCard widget={WIDGET} roles={ROLES} assignedRoleIds={[]} onToggleRole={vi.fn()} onToggleAll={vi.fn()} />,
    );
    expect(screen.queryByRole('button', { name: /Tenant Admin/ })).not.toBeInTheDocument();
    expect(screen.getByText('Tenant Admin')).toBeInTheDocument();
  });

  it('calls onToggleRole(roleId, true) when clicking an unassigned chip', async () => {
    const onToggleRole = vi.fn();
    render(
      <WidgetAllocationCard
        widget={WIDGET}
        roles={ROLES}
        assignedRoleIds={[]}
        onToggleRole={onToggleRole}
        onToggleAll={vi.fn()}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Add Sales Rep to KPI Strip' }));
    expect(onToggleRole).toHaveBeenCalledWith('role-sales', true);
  });

  it('calls onToggleRole(roleId, false) when clicking an assigned chip', async () => {
    const onToggleRole = vi.fn();
    render(
      <WidgetAllocationCard
        widget={WIDGET}
        roles={ROLES}
        assignedRoleIds={['role-sales']}
        onToggleRole={onToggleRole}
        onToggleAll={vi.fn()}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Remove Sales Rep from KPI Strip' }));
    expect(onToggleRole).toHaveBeenCalledWith('role-sales', false);
  });

  it('shows "Select all" and calls onToggleAll(true) when no editable role is fully assigned', async () => {
    const onToggleAll = vi.fn();
    render(
      <WidgetAllocationCard widget={WIDGET} roles={ROLES} assignedRoleIds={[]} onToggleRole={vi.fn()} onToggleAll={onToggleAll} />,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Assign KPI Strip for every role' }));
    expect(onToggleAll).toHaveBeenCalledWith(true);
  });

  it('shows "Clear all" and calls onToggleAll(false) once every editable role is assigned', async () => {
    const onToggleAll = vi.fn();
    render(
      <WidgetAllocationCard
        widget={WIDGET}
        roles={ROLES}
        assignedRoleIds={['role-sales', 'role-accounting']}
        onToggleRole={vi.fn()}
        onToggleAll={onToggleAll}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Clear KPI Strip for every role' }));
    expect(onToggleAll).toHaveBeenCalledWith(false);
  });

  it('ignores the locked role when deciding whether every role is assigned', () => {
    // role-admin is locked and not in assignedRoleIds, but both editable roles are.
    render(
      <WidgetAllocationCard
        widget={WIDGET}
        roles={ROLES}
        assignedRoleIds={['role-sales', 'role-accounting']}
        onToggleRole={vi.fn()}
        onToggleAll={vi.fn()}
      />,
    );
    expect(screen.getByRole('button', { name: 'Clear KPI Strip for every role' })).toBeInTheDocument();
  });
});
