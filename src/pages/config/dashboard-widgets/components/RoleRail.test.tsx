import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RoleRail } from './RoleRail';

const ROLES = [
  { id: 'role-sales', name: 'Sales Rep', locked: false },
  { id: 'role-viewer', name: 'Viewer', locked: false },
  { id: 'role-admin', name: 'Tenant Admin', locked: true },
];

describe('RoleRail', () => {
  it('renders each editable role with its widget count', () => {
    render(
      <RoleRail
        roles={ROLES}
        selectedRoleId="role-sales"
        onSelectRole={vi.fn()}
        counts={{ 'role-sales': 6, 'role-viewer': 0 }}
        totalCount={10}
        dirtyRoleIds={[]}
      />,
    );
    expect(screen.getByText('6/10')).toBeInTheDocument();
    expect(screen.getByText('0/10')).toBeInTheDocument();
  });

  it('renders locked roles with a lock badge showing "All" instead of a count', () => {
    render(
      <RoleRail
        roles={ROLES}
        selectedRoleId="role-sales"
        onSelectRole={vi.fn()}
        counts={{}}
        totalCount={10}
        dirtyRoleIds={[]}
      />,
    );
    const lockedButton = screen.getByRole('button', { name: 'View widgets for Tenant Admin' });
    expect(lockedButton).toHaveTextContent('All');
  });

  it('marks the selected role with aria-current', () => {
    render(
      <RoleRail
        roles={ROLES}
        selectedRoleId="role-viewer"
        onSelectRole={vi.fn()}
        counts={{}}
        totalCount={10}
        dirtyRoleIds={[]}
      />,
    );
    expect(screen.getByRole('button', { name: 'View widgets for Viewer' })).toHaveAttribute('aria-current', 'true');
    expect(screen.getByRole('button', { name: 'View widgets for Sales Rep' })).not.toHaveAttribute('aria-current');
  });

  it('calls onSelectRole with the clicked role id', async () => {
    const onSelectRole = vi.fn();
    render(
      <RoleRail
        roles={ROLES}
        selectedRoleId="role-sales"
        onSelectRole={onSelectRole}
        counts={{}}
        totalCount={10}
        dirtyRoleIds={[]}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: 'View widgets for Viewer' }));
    expect(onSelectRole).toHaveBeenCalledWith('role-viewer');
  });

  it('shows an unsaved-changes indicator only for roles in dirtyRoleIds', () => {
    render(
      <RoleRail
        roles={ROLES}
        selectedRoleId="role-sales"
        onSelectRole={vi.fn()}
        counts={{}}
        totalCount={10}
        dirtyRoleIds={['role-sales']}
      />,
    );
    expect(screen.getByRole('button', { name: 'View widgets for Sales Rep' }).querySelector('[aria-label="Unsaved changes"]')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'View widgets for Viewer' }).querySelector('[aria-label="Unsaved changes"]')).not.toBeInTheDocument();
  });
});
