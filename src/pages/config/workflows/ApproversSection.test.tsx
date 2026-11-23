import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('@/services/tenantServices', () => ({
  workflowService: { updateApprovers: vi.fn() },
  userService: { listUsers: vi.fn() },
}));

import { ApproversSection } from './WorkflowBuilderPage';
import { workflowService, userService } from '@/services/tenantServices';
import type { WorkspaceUser } from '@/types/tenant';

const WORKFLOW_ID = 'wf-lead';

function makeUser(overrides: Partial<WorkspaceUser> = {}): WorkspaceUser {
  return {
    id: '301',
    identityId: 'ident-301',
    email: 'casey@example.com',
    fullName: 'Casey Approver',
    status: 'active',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    roles: [],
    ...overrides,
  };
}

function renderSection(approverUserIds: string[] = []) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  render(
    <QueryClientProvider client={queryClient}>
      <ApproversSection workflowId={WORKFLOW_ID} approverUserIds={approverUserIds} />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(userService.listUsers).mockResolvedValue([makeUser()]);
});

describe('ApproversSection', () => {
  it('shows a disabled toggle and no picker when there are no approvers', async () => {
    renderSection([]);

    expect(await screen.findByRole('switch', { name: 'Enable approval chain' })).not.toBeChecked();
    expect(screen.queryByLabelText('Search active users to add as an approver')).not.toBeInTheDocument();
    expect(screen.getByText(/Approval is disabled/)).toBeInTheDocument();
  });

  it('shows an enabled toggle and the picker when approvers are already configured', async () => {
    renderSection(['301']);

    expect(await screen.findByRole('switch', { name: 'Disable approval chain' })).toBeChecked();
    expect(await screen.findByLabelText('Search active users to add as an approver')).toBeInTheDocument();
  });

  it('turning the toggle on reveals the picker without saving until an approver is picked', async () => {
    const user = userEvent.setup();
    renderSection([]);

    await user.click(await screen.findByRole('switch', { name: 'Enable approval chain' }));

    expect(await screen.findByLabelText('Search active users to add as an approver')).toBeInTheDocument();
    expect(workflowService.updateApprovers).not.toHaveBeenCalled();
  });

  it('turning the toggle off clears the configured approvers and hides the picker', async () => {
    const user = userEvent.setup();
    vi.mocked(workflowService.updateApprovers).mockResolvedValue([]);
    renderSection(['301']);

    await user.click(await screen.findByRole('switch', { name: 'Disable approval chain' }));

    expect(screen.queryByLabelText('Search active users to add as an approver')).not.toBeInTheDocument();
    await waitFor(() => expect(workflowService.updateApprovers).toHaveBeenCalledWith(WORKFLOW_ID, []));
  });

  it('turning the toggle on focuses the approver search box', async () => {
    const user = userEvent.setup();
    renderSection([]);

    await user.click(await screen.findByRole('switch', { name: 'Enable approval chain' }));

    expect(await screen.findByLabelText('Search active users to add as an approver')).toHaveFocus();
  });

  it('does not steal focus into the picker when approvers already exist on load', async () => {
    renderSection(['301']);

    const searchInput = await screen.findByLabelText('Search active users to add as an approver');
    expect(searchInput).not.toHaveFocus();
  });

  it('reverts the toggle to enabled when disabling fails to save', async () => {
    const user = userEvent.setup();
    vi.mocked(workflowService.updateApprovers).mockRejectedValue(new Error('save failed'));
    renderSection(['301']);

    await user.click(await screen.findByRole('switch', { name: 'Disable approval chain' }));

    await waitFor(() => expect(workflowService.updateApprovers).toHaveBeenCalled());
    expect(await screen.findByRole('switch', { name: 'Disable approval chain' })).toBeChecked();
    expect(await screen.findByLabelText('Search active users to add as an approver')).toBeInTheDocument();
  });
});
