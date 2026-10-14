import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

vi.mock('@/hooks/useUserPermissions', () => ({ useUserPermissions: vi.fn() }));
vi.mock('@/hooks/useBinTransferCustomFields', () => ({ useBinTransferCustomFields: () => [] }));
vi.mock('@/services/binTransferService', () => ({
  binTransferService: {
    get: vi.fn(), history: vi.fn(), approve: vi.fn(), reject: vi.fn(), complete: vi.fn(), transition: vi.fn(), remove: vi.fn(),
  },
}));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { useUserPermissions } from '@/hooks/useUserPermissions';
import { binTransferService } from '@/services/binTransferService';
import BinTransferDetailPage from './BinTransferDetailPage';
import { makeLine, makeTransfer } from './components/binTransferFixtures';
import type { BinTransfer } from '@/types/binTransfer';

function renderPage(transfer: BinTransfer, granted: (resource: string, action: string) => boolean = () => true) {
  vi.mocked(useUserPermissions).mockReturnValue({
    grants: [], isLoading: false, activeRoleId: '', isSuperAdmin: false,
    hasPermission: granted,
  } as unknown as ReturnType<typeof useUserPermissions>);
  vi.mocked(binTransferService.get).mockResolvedValue(transfer);
  vi.mocked(binTransferService.history).mockResolvedValue([
    { action: 'create', toStatus: 'DRFT', at: '2026-10-14T08:00:00', byName: 'Maria Lopez' },
  ]);
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[`/inventory/bin_transfer/${transfer.id}`]}>
        <Routes>
          <Route path="/inventory/bin_transfer/:id" element={<BinTransferDetailPage />} />
          <Route path="/inventory/bin_transfer/:id/edit" element={<p>edit page</p>} />
          <Route path="/inventory/bin_transfer" element={<p>transfer list</p>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

// The page header and the sidebar each render once per layout (desktop + mobile),
// so a control can legitimately appear twice.
const titled = () => screen.findAllByRole('heading', { name: 'BTRF-000012' });

beforeEach(() => vi.clearAllMocks());

describe('BinTransferDetailPage', () => {
  it('shows the number, location, status and what is moving where', async () => {
    renderPage(makeTransfer());

    expect((await titled()).length).toBeGreaterThan(0);
    expect(screen.getAllByText('Main Yard').length).toBeGreaterThan(0);
    expect(screen.getByText('SLB-000231')).toBeInTheDocument();
    expect(screen.getAllByText('YARD/A1').length).toBeGreaterThan(0);
    expect(screen.getAllByText('RACK/B2').length).toBeGreaterThan(0);
  });

  it('places the transfer on its progress steps', async () => {
    renderPage(makeTransfer({ statusCode: 'APPV', statusName: 'Approved', nextStatusCodes: ['CANC', 'COMP', 'DRFT'] }));

    const steps = within(await screen.findByRole('navigation', { name: 'Transfer progress' }));
    expect(steps.getByText('Approved').closest('li')).toHaveAttribute('aria-current', 'step');
    expect(steps.getByText('Draft').closest('li')).not.toHaveAttribute('aria-current');
  });

  it('puts Edit and Delete on a draft only', async () => {
    renderPage(makeTransfer());

    await titled();
    expect(screen.getAllByRole('button', { name: /edit transfer/i }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('button', { name: 'Delete transfer' }).length).toBeGreaterThan(0);
  });

  it('freezes an approved transfer: no Edit, no Delete — Revise is the way back', async () => {
    renderPage(makeTransfer({ statusCode: 'APPV', statusName: 'Approved', nextStatusCodes: ['CANC', 'COMP', 'DRFT'] }));

    await titled();
    expect(screen.queryByRole('button', { name: /edit transfer/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Delete transfer' })).not.toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Revise' }).length).toBeGreaterThan(0);
  });

  it('asks the configured approver for sign-off and sends it', async () => {
    vi.mocked(binTransferService.approve).mockResolvedValue({} as never);
    const user = userEvent.setup();
    renderPage(makeTransfer({
      statusCode: 'PAPV', statusName: 'Pending Approval', nextStatusCodes: ['APPV', 'CANC', 'DRFT'],
      gated: true, canApprove: true, canReject: true, requiredApprovals: 1,
      approvers: [{ id: '1', name: 'Sam Ortiz', approved: false }],
    }));

    await user.click(await screen.findByRole('button', { name: 'Approve this record' }));

    await waitFor(() => expect(binTransferService.approve).toHaveBeenCalledWith('bt-12'));
    // Rejecting is offered beside it, and a pending transfer is cancellable but
    // not manually pushed forward or back.
    expect(screen.getByRole('button', { name: 'Reject this bin transfer' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Return to Draft' })).not.toBeInTheDocument();
  });

  it('tells someone who is not an approver who the transfer is waiting on', async () => {
    renderPage(makeTransfer({
      statusCode: 'PAPV', statusName: 'Pending Approval', nextStatusCodes: ['APPV', 'CANC', 'DRFT'],
      gated: true, canApprove: false, requiredApprovals: 1,
      approvers: [{ id: '1', name: 'Sam Ortiz', approved: false }],
    }));

    expect(await screen.findByText(/Awaiting approval from Sam Ortiz/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Approve this record/ })).not.toBeInTheDocument();
  });

  it('shows why an approver sent it back', async () => {
    renderPage(makeTransfer({
      rejection: { byName: 'Sam Ortiz', reason: 'Rack B2 is being re-bolted', at: '2026-10-14T09:00:00' },
    }));

    expect(await screen.findByText(/Rack B2 is being re-bolted/)).toBeInTheDocument();
    expect(screen.getByText(/submit it for approval again/i)).toBeInTheDocument();
  });

  it('records a finished transfer as completed and offers no more moves', async () => {
    renderPage(makeTransfer({
      statusCode: 'COMP', statusName: 'Completed', nextStatusCodes: [], completedByName: 'Maria Lopez',
      completedAt: '2026-10-14T10:42:00', lines: [makeLine({ movedAt: '2026-10-14T10:42:00' })],
    }));

    expect(await screen.findByText(/Completed by Maria Lopez/)).toBeInTheDocument();
    expect(screen.getByText('Moved')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Complete' })).not.toBeInTheDocument();
  });

  it('warns on a pending line whose slab can no longer move', async () => {
    renderPage(makeTransfer({
      lines: [makeLine({ unitStatus: 'scrapped', currentBinPath: '' })],
    }));

    expect(await screen.findByText(/can no longer be moved/i)).toBeInTheDocument();
  });

  it('hides every action from someone who may only read', async () => {
    renderPage(makeTransfer(), (_resource, action) => action === 'read');

    await titled();
    expect(screen.queryByRole('button', { name: 'Complete' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /edit transfer/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Delete transfer' })).not.toBeInTheDocument();
  });
});
