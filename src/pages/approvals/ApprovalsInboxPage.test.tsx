import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, useLocation } from 'react-router-dom';
import ApprovalsInboxPage from './ApprovalsInboxPage';
import { approvalInboxService } from '@/services/approvalInboxService';
import type { ApprovalInboxItem, ApprovalInboxPage } from '@/types/approvalInbox';

let superAdmin = false;
vi.mock('@/hooks/useUserPermissions', () => ({
  useUserPermissions: () => ({ isSuperAdmin: superAdmin, isLoading: false, hasPermission: () => false }),
}));
vi.mock('@/hooks/useWorkflows', () => ({
  useWorkflows: () => ({ isWorkflowEnabled: () => true, isLoading: false, workflows: [] }),
}));
vi.mock('@/services/approvalInboxService', () => ({
  approvalInboxService: { list: vi.fn(), listCrmPending: vi.fn() },
}));

const listMock = vi.mocked(approvalInboxService.list);

function item(over: Partial<ApprovalInboxItem> = {}): ApprovalInboxItem {
  return {
    module: 'invoice', label: 'Invoice', number: 'INV-1', domain: 'sales', routeModule: 'invoice',
    recordUuid: 'u1', partyName: 'Acme', amount: 500, currency: 'USD', ownerName: 'Sam',
    waitingSince: new Date(Date.now() - 5 * 86_400_000).toISOString(),
    approvedCount: 1, requiredApprovals: 2, canApprove: true, ...over,
  };
}

function page(over: Partial<ApprovalInboxPage> = {}): ApprovalInboxPage {
  return {
    items: [item()],
    modules: [{ module: 'invoice', label: 'Invoice', count: 3 }, { module: 'quote', label: 'Quote', count: 4 }],
    total: 7, isApprover: true, nextCursor: '', ...over,
  };
}

function Probe() {
  return <span data-testid="url">{useLocation().search}</span>;
}

function renderPage(initial = '/approvals') {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter initialEntries={[initial]}>
        <ApprovalsInboxPage />
        <Probe />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('ApprovalsInboxPage', () => {
  beforeEach(() => {
    superAdmin = false;
    listMock.mockReset();
    vi.mocked(approvalInboxService.listCrmPending).mockResolvedValue([]);
  });

  it('shows module chips with counts and the row details', async () => {
    listMock.mockResolvedValue(page());
    renderPage();

    expect(await screen.findByRole('button', { name: 'All 7' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Invoice 3' })).toBeInTheDocument();
    expect(screen.getByText('Invoice INV-1')).toHaveAttribute('href', '/sales/invoice/u1');
    expect(screen.getByText('$500.00')).toBeInTheDocument();
    expect(screen.getByText('Waiting 5 days')).toHaveAttribute('data-tone', 'red');
    expect(screen.getByText('1 of 2 approved')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Review Invoice INV-1' })).toBeInTheDocument();
  });

  it('puts the chosen module in the URL and the request', async () => {
    const user = userEvent.setup();
    listMock.mockResolvedValue(page());
    renderPage();

    await user.click(await screen.findByRole('button', { name: 'Invoice 3' }));

    await waitFor(() => expect(screen.getByTestId('url')).toHaveTextContent('module=invoice'));
    await waitFor(() => expect(listMock).toHaveBeenCalledWith(expect.objectContaining({ module: 'invoice', scope: 'mine' })));
  });

  it('shows "View only" when the caller cannot approve', async () => {
    listMock.mockResolvedValue(page({ items: [item({ canApprove: false })] }));
    renderPage();

    expect(await screen.findByText('View only')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /review/i })).not.toBeInTheDocument();
  });

  it('pages forward with the server cursor and back again', async () => {
    const user = userEvent.setup();
    listMock.mockImplementation(async (p) => page({ nextCursor: p.cursor ? '' : 'c2' }));
    renderPage();

    await user.click(await screen.findByRole('button', { name: 'Next page' }));
    await waitFor(() => expect(listMock).toHaveBeenCalledWith(expect.objectContaining({ cursor: 'c2' })));

    await user.click(await screen.findByRole('button', { name: 'Previous page' }));
    await waitFor(() => expect(screen.getByText(/Page 1/)).toBeInTheDocument());
  });

  it('hides the scope toggle from non-super-admins and shows it to super admins', async () => {
    listMock.mockResolvedValue(page());
    renderPage('/approvals?scope=all');
    await screen.findByRole('button', { name: 'All 7' });
    expect(screen.queryByRole('group', { name: 'Approval scope' })).not.toBeInTheDocument();
    expect(listMock).toHaveBeenCalledWith(expect.objectContaining({ scope: 'mine' }));
  });

  it('requests scope=all for a super admin who asked for it', async () => {
    superAdmin = true;
    listMock.mockResolvedValue(page());
    renderPage('/approvals?scope=all');

    expect(await screen.findByRole('group', { name: 'Approval scope' })).toBeInTheDocument();
    expect(listMock).toHaveBeenCalledWith(expect.objectContaining({ scope: 'all' }));
  });

  it('shows the empty state for an approver', async () => {
    listMock.mockResolvedValue(page({ items: [], modules: [], total: 0 }));
    renderPage();
    expect(await screen.findByText('Nothing is waiting for you.')).toBeInTheDocument();
  });

  it('shows the non-approver empty state', async () => {
    listMock.mockResolvedValue(page({ items: [], modules: [], total: 0, isApprover: false }));
    renderPage();
    expect(await screen.findByText(/You are not an approver on any workflow/)).toBeInTheDocument();
  });

  it('shows an error with Retry', async () => {
    const user = userEvent.setup();
    listMock.mockRejectedValueOnce(new Error('boom')).mockResolvedValue(page());
    renderPage();

    await user.click(await screen.findByRole('button', { name: 'Retry' }));
    expect(await screen.findByRole('button', { name: 'All 7' })).toBeInTheDocument();
  });
});
