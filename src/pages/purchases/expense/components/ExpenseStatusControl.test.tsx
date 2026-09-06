import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('@/hooks/useUserPermissions', () => ({ useUserPermissions: vi.fn() }));

import { ExpenseStatusControl } from './ExpenseStatusControl';
import { useUserPermissions } from '@/hooks/useUserPermissions';

function mockPermissions(canTransition = true) {
  vi.mocked(useUserPermissions).mockReturnValue({
    grants: [],
    isLoading: false,
    activeRoleId: '',
    hasPermission: (resource: string, action: string) =>
      resource === 'expense' && action === 'transition' ? canTransition : false,
  } as ReturnType<typeof useUserPermissions>);
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('ExpenseStatusControl', () => {
  it('shows action-verb transition labels, not bare status names', async () => {
    const user = userEvent.setup();
    mockPermissions();
    render(
      <ExpenseStatusControl
        order={{ statusCode: 'DRFT', approvalStatus: 'none' }}
        onChange={vi.fn()}
        variant="pill"
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Draft' }));

    expect(screen.getByRole('option', { name: 'Submit for Approval' })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'Submitted' })).not.toBeInTheDocument();
  });

  it('never offers RJCT as a plain option — rejection is a dedicated action', async () => {
    const user = userEvent.setup();
    mockPermissions();
    render(
      <ExpenseStatusControl
        order={{ statusCode: 'SUBM', approvalStatus: 'none' }}
        onChange={vi.fn()}
        variant="pill"
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Submitted' }));

    expect(screen.queryByRole('option', { name: /Reject/ })).not.toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Approve & Advance' })).toBeInTheDocument();
  });

  it('fires onChange once for a permitted, non-terminal move', async () => {
    const user = userEvent.setup();
    mockPermissions();
    const onChange = vi.fn();
    render(
      <ExpenseStatusControl
        order={{ statusCode: 'DRFT', approvalStatus: 'none' }}
        onChange={onChange}
        variant="pill"
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Draft' }));
    await user.click(screen.getByRole('option', { name: 'Submit for Approval' }));

    expect(onChange).toHaveBeenCalledOnce();
    expect(onChange).toHaveBeenCalledWith('SUBM');
  });

  it('requires a second click to confirm a terminal move (Mark Reimbursed)', async () => {
    const user = userEvent.setup();
    mockPermissions();
    const onChange = vi.fn();
    render(
      <ExpenseStatusControl
        order={{ statusCode: 'APPV', approvalStatus: 'approved' }}
        onChange={onChange}
        variant="pill"
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Approved' }));
    await user.click(screen.getByRole('option', { name: 'Mark Reimbursed' }));

    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByRole('option', { name: 'Confirm: Mark Reimbursed' })).toBeInTheDocument();

    await user.click(screen.getByRole('option', { name: 'Confirm: Mark Reimbursed' }));

    expect(onChange).toHaveBeenCalledOnce();
    expect(onChange).toHaveBeenCalledWith('REIM');
  });
});
