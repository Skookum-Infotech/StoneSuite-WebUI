import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { WidgetAllocationMatrix } from './WidgetAllocationMatrix';
import type { WidgetDefinition } from '@/types/dashboardWidgets';

const CATALOG: WidgetDefinition[] = [
  { id: 'core-1', title: 'Core 1', description: '', category: 'core', size: 'full', defaultEnabled: true },
  { id: 'sales-1', title: 'Sales 1', description: '', category: 'sales', size: 'half', defaultEnabled: false },
];

const ROLES = [
  { id: 'role-sales', name: 'Sales Rep', locked: false },
  { id: 'role-viewer', name: 'Viewer', locked: false },
  { id: 'role-admin', name: 'Tenant Admin', locked: true },
];

const ALLOCATED = {
  'role-sales': ['core-1'],
  'role-viewer': [],
};

function renderMatrix(overrides: Partial<Parameters<typeof WidgetAllocationMatrix>[0]> = {}) {
  render(
    <WidgetAllocationMatrix
      catalog={CATALOG}
      roles={ROLES}
      allocatedIdsByRole={ALLOCATED}
      onToggleCell={vi.fn()}
      onToggleWidgetForAllRoles={vi.fn()}
      onToggleCategoryForRole={vi.fn()}
      {...overrides}
    />,
  );
}

describe('WidgetAllocationMatrix', () => {
  it('renders a separate table per category, each headed by its label', () => {
    renderMatrix();
    expect(screen.getByText('Core')).toBeInTheDocument();
    expect(screen.getByText('Sales')).toBeInTheDocument();
  });

  it('checks a cell for a role the widget is allocated to', () => {
    renderMatrix();
    expect(screen.getByRole('checkbox', { name: 'Core 1 for Sales Rep' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Core 1 for Viewer' })).not.toBeChecked();
  });

  it('renders the locked role column as checked and disabled for every widget', () => {
    renderMatrix();
    const cell = screen.getByRole('checkbox', { name: 'Core 1 for Tenant Admin' });
    expect(cell).toBeChecked();
    expect(cell).toBeDisabled();
  });

  it('calls onToggleCell with the flipped value when a cell is clicked', async () => {
    const onToggleCell = vi.fn();
    renderMatrix({ onToggleCell });
    await userEvent.click(screen.getByRole('checkbox', { name: 'Core 1 for Viewer' }));
    expect(onToggleCell).toHaveBeenCalledWith('role-viewer', 'core-1', true);
  });

  it('calls onToggleWidgetForAllRoles when a widget row label is clicked', async () => {
    const onToggleWidgetForAllRoles = vi.fn();
    renderMatrix({ onToggleWidgetForAllRoles });
    await userEvent.click(screen.getByRole('button', { name: 'Core 1' }));
    // role-sales has core-1 but role-viewer doesn't, so not every editable role
    // is on — the click should grant it to all, not clear it.
    expect(onToggleWidgetForAllRoles).toHaveBeenCalledWith('core-1', true);
  });

  it('calls onToggleCategoryForRole with only that category\'s widget ids when a column header is clicked', async () => {
    const onToggleCategoryForRole = vi.fn();
    renderMatrix({ onToggleCategoryForRole });
    await userEvent.click(screen.getByRole('button', { name: 'Assign every Core widget for Viewer' }));
    expect(onToggleCategoryForRole).toHaveBeenCalledWith('role-viewer', ['core-1'], true);
  });

  it("scopes a column header toggle to its own category, leaving other categories untouched", async () => {
    const onToggleCategoryForRole = vi.fn();
    renderMatrix({ onToggleCategoryForRole });
    await userEvent.click(screen.getByRole('button', { name: 'Assign every Sales widget for Viewer' }));
    expect(onToggleCategoryForRole).toHaveBeenCalledWith('role-viewer', ['sales-1'], true);
  });

  it('does not render a clickable header control for a locked role, in either category table', () => {
    renderMatrix();
    expect(screen.queryByRole('button', { name: /Tenant Admin/ })).not.toBeInTheDocument();
    expect(screen.getAllByText('Tenant Admin')).toHaveLength(2);
  });
});
