import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('@/hooks/useUserPermissions', () => ({ useUserPermissions: vi.fn() }));

import { RequisitionStatusControl } from './RequisitionStatusControl';
import { useUserPermissions } from '@/hooks/useUserPermissions';

function mockPermissions(canTransition = true) {
  vi.mocked(useUserPermissions).mockReturnValue({
    grants: [],
    isLoading: false,
    activeRoleId: '', isSuperAdmin: false,
    hasPermission: (resource: string, action: string) =>
      resource === 'requisition' && action === 'transition' ? canTransition : false,
  } as ReturnType<typeof useUserPermissions>);
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('RequisitionStatusControl', () => {
  it('shows action-verb transition labels, not bare status names', async () => {
    const user = userEvent.setup();
    mockPermissions();
    render(
      <RequisitionStatusControl
        order={{ statusCode: 'DRFT', approvalStatus: 'none' }}
        onChange={vi.fn()}
        variant="pill"
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Draft' }));

    expect(screen.getByRole('option', { name: 'Submit for Approval' })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'Pending Approval' })).not.toBeInTheDocument();
  });

  it('fires onChange once for a permitted, non-terminal move', async () => {
    const user = userEvent.setup();
    mockPermissions();
    const onChange = vi.fn();
    render(
      <RequisitionStatusControl
        order={{ statusCode: 'DRFT', approvalStatus: 'none' }}
        onChange={onChange}
        variant="pill"
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Draft' }));
    await user.click(screen.getByRole('option', { name: 'Submit for Approval' }));

    expect(onChange).toHaveBeenCalledOnce();
    expect(onChange).toHaveBeenCalledWith('PAPV');
  });

  it('requires a second click to confirm a terminal move (Cancel)', async () => {
    const user = userEvent.setup();
    mockPermissions();
    const onChange = vi.fn();
    render(
      <RequisitionStatusControl
        order={{ statusCode: 'DRFT', approvalStatus: 'none' }}
        onChange={onChange}
        variant="pill"
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Draft' }));
    await user.click(screen.getByRole('option', { name: 'Cancel' }));

    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByRole('option', { name: 'Confirm: Cancel' })).toBeInTheDocument();

    await user.click(screen.getByRole('option', { name: 'Confirm: Cancel' }));

    expect(onChange).toHaveBeenCalledOnce();
    expect(onChange).toHaveBeenCalledWith('CANC');
  });

  it('offers a one-click "Approve" instead of "Submit for Approval" when the backend collapsed the checkpoint', async () => {
    const user = userEvent.setup();
    mockPermissions();
    const onChange = vi.fn();
    render(
      <RequisitionStatusControl
        // nextStatusCodes is what the backend sends for a Draft with nobody
        // configured to approve: Approved itself is offered (a requisition
        // rests there until it becomes a PO), the PAPV checkpoint is not.
        order={{ statusCode: 'DRFT', approvalStatus: 'none', nextStatusCodes: ['APPV', 'CANC'] }}
        onChange={onChange}
        variant="pill"
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Draft' }));

    expect(screen.queryByRole('option', { name: 'Submit for Approval' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('option', { name: 'Approve' }));

    expect(onChange).toHaveBeenCalledOnce();
    expect(onChange).toHaveBeenCalledWith('APPV');
  });
});
