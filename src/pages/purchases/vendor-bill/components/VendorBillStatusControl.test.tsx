import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('@/hooks/useUserPermissions', () => ({ useUserPermissions: vi.fn() }));

import { VendorBillStatusControl } from './VendorBillStatusControl';
import { useUserPermissions } from '@/hooks/useUserPermissions';

function mockPermissions(canTransition = true) {
  vi.mocked(useUserPermissions).mockReturnValue({
    grants: [],
    isLoading: false,
    activeRoleId: '',
    hasPermission: (resource: string, action: string) =>
      resource === 'vendor_bill' && action === 'transition' ? canTransition : false,
  } as ReturnType<typeof useUserPermissions>);
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('VendorBillStatusControl', () => {
  it('shows action-verb transition labels, not bare status names', async () => {
    const user = userEvent.setup();
    mockPermissions();
    render(
      <VendorBillStatusControl
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
      <VendorBillStatusControl
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

  it('requires a second click to confirm a terminal move (Void)', async () => {
    const user = userEvent.setup();
    mockPermissions();
    const onChange = vi.fn();
    render(
      <VendorBillStatusControl
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
