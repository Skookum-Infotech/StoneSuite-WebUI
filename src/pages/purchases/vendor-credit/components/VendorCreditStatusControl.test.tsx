import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('@/hooks/useUserPermissions', () => ({ useUserPermissions: vi.fn() }));

import { VendorCreditStatusControl } from './VendorCreditStatusControl';
import { useUserPermissions } from '@/hooks/useUserPermissions';

function mockPermissions(allowedActions: string[] = ['approve', 'transition']) {
  vi.mocked(useUserPermissions).mockReturnValue({
    grants: [],
    isLoading: false,
    activeRoleId: '',
    hasPermission: (resource: string, action: string) =>
      resource === 'vendor_credit' && allowedActions.includes(action),
  } as ReturnType<typeof useUserPermissions>);
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('VendorCreditStatusControl', () => {
  it('shows action-verb transition labels, not bare status names', async () => {
    const user = userEvent.setup();
    mockPermissions();
    render(
      <VendorCreditStatusControl
        order={{ statusCode: 'DRFT', approvalStatus: 'none' }}
        onChange={vi.fn()}
        variant="pill"
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Draft' }));

    expect(screen.getByRole('option', { name: 'Approve' })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'Approved' })).not.toBeInTheDocument();
  });

  it('fires onChange once for a permitted move (DRFT -> APPV, needs vendor_credit:approve)', async () => {
    const user = userEvent.setup();
    mockPermissions(['approve', 'transition']);
    const onChange = vi.fn();
    render(
      <VendorCreditStatusControl
        order={{ statusCode: 'DRFT', approvalStatus: 'none' }}
        onChange={onChange}
        variant="pill"
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Draft' }));
    await user.click(screen.getByRole('option', { name: 'Approve' }));

    expect(onChange).toHaveBeenCalledOnce();
    expect(onChange).toHaveBeenCalledWith('APPV');
  });

  it('blocks DRFT -> APPV when the user only has vendor_credit:transition, not :approve', async () => {
    const user = userEvent.setup();
    mockPermissions(['transition']);
    const onChange = vi.fn();
    render(
      <VendorCreditStatusControl
        order={{ statusCode: 'DRFT', approvalStatus: 'none' }}
        onChange={onChange}
        variant="pill"
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Draft' }));
    const approveOption = screen.getByRole('option', { name: /Approve/ });
    expect(approveOption).toHaveTextContent('Needs the approve permission');

    await user.click(approveOption);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('requires a second click to confirm a terminal move (Void)', async () => {
    const user = userEvent.setup();
    mockPermissions();
    const onChange = vi.fn();
    render(
      <VendorCreditStatusControl
        order={{ statusCode: 'DRFT', approvalStatus: 'none' }}
        onChange={onChange}
        variant="pill"
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Draft' }));
    await user.click(screen.getByRole('option', { name: 'Void' }));

    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByRole('option', { name: 'Confirm: Void' })).toBeInTheDocument();

    await user.click(screen.getByRole('option', { name: 'Confirm: Void' }));

    expect(onChange).toHaveBeenCalledOnce();
    expect(onChange).toHaveBeenCalledWith('VOID');
  });
});
