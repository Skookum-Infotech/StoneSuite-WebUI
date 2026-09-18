import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('@/hooks/useUserPermissions', () => ({ useUserPermissions: vi.fn() }));

import { EstimateStatusControl } from './EstimateStatusControl';
import { useUserPermissions } from '@/hooks/useUserPermissions';

function mockPermissions(canTransition = true) {
  vi.mocked(useUserPermissions).mockReturnValue({
    grants: [],
    isLoading: false,
    activeRoleId: '',
    hasPermission: (resource: string, action: string) =>
      resource === 'estimate' && action === 'transition' ? canTransition : false,
  } as ReturnType<typeof useUserPermissions>);
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('EstimateStatusControl', () => {
  it('offers "Submit for Approval" instead of the bare "Pending Approval" status label', async () => {
    const user = userEvent.setup();
    mockPermissions();
    render(
      <EstimateStatusControl
        estimate={{ statusCode: 'DRFT', approvalStatus: 'none' }}
        onChange={vi.fn()}
        variant="pill"
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Draft' }));

    expect(screen.getByRole('option', { name: 'Submit for Approval' })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'Pending Approval' })).not.toBeInTheDocument();
  });

  it('still fires onChange with the real PAPV code — only the label changes', async () => {
    const user = userEvent.setup();
    mockPermissions();
    const onChange = vi.fn();
    render(
      <EstimateStatusControl
        estimate={{ statusCode: 'DRFT', approvalStatus: 'none' }}
        onChange={onChange}
        variant="pill"
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Draft' }));
    await user.click(screen.getByRole('option', { name: 'Submit for Approval' }));

    expect(onChange).toHaveBeenCalledOnce();
    expect(onChange).toHaveBeenCalledWith('PAPV');
  });

  it('offers Sent directly, with no approval step at all, when the backend collapsed the checkpoint', async () => {
    const user = userEvent.setup();
    mockPermissions();
    const onChange = vi.fn();
    render(
      <EstimateStatusControl
        // nextStatusCodes is what the backend sends for a Draft with nobody
        // configured to approve: the PAPV checkpoint and Approved are gone.
        estimate={{ statusCode: 'DRFT', approvalStatus: 'none', nextStatusCodes: ['CANC', 'SENT'] }}
        onChange={onChange}
        variant="pill"
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Draft' }));

    expect(screen.queryByRole('option', { name: 'Submit for Approval' })).not.toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'Approved' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('option', { name: 'Sent' }));

    expect(onChange).toHaveBeenCalledOnce();
    expect(onChange).toHaveBeenCalledWith('SENT');
  });

});
