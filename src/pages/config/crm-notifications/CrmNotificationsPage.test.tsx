import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('@/services/crmNotifyService', () => ({
  crmNotifyService: { getRecipients: vi.fn(), saveRecipients: vi.fn() },
}));
vi.mock('@/services/tenantServices', () => ({
  rbacService: { listRoles: vi.fn() },
}));

const hasPermission = vi.fn<(resource: string, action: string) => boolean>();
vi.mock('@/hooks/useUserPermissions', () => ({
  useUserPermissions: () => ({ hasPermission, grants: [], isLoading: false, activeRoleId: '' }),
}));

import CrmNotificationsPage from './CrmNotificationsPage';
import { crmNotifyService } from '@/services/crmNotifyService';
import { rbacService } from '@/services/tenantServices';

const ROLES = [
  { id: 'r-sales', key: 'sales_lead', name: 'Sales Lead', description: '', isSystem: false, permissions: [] },
  { id: 'r-fin', key: 'finance', name: 'Finance Team', description: '', isSystem: false, permissions: [] },
];

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <CrmNotificationsPage />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  hasPermission.mockReturnValue(true);
  vi.mocked(rbacService.listRoles).mockResolvedValue(ROLES);
});

describe('CrmNotificationsPage', () => {
  it('shows the saved mapping with the mapped roles ticked in their group', async () => {
    vi.mocked(crmNotifyService.getRecipients).mockResolvedValue({
      manager: [{ roleId: 'r-sales', roleName: 'Sales Lead' }],
      finance: [{ roleId: 'r-fin', roleName: 'Finance Team' }],
    });
    renderPage();

    const boxes = await screen.findAllByRole('checkbox');
    // Two groups × two roles, manager group first.
    expect(boxes).toHaveLength(4);
    expect(boxes[0]).toBeChecked();
    expect(boxes[1]).not.toBeChecked();
    expect(boxes[2]).not.toBeChecked();
    expect(boxes[3]).toBeChecked();
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
  });

  it('saves the edited role ids for both groups', async () => {
    const user = userEvent.setup();
    vi.mocked(crmNotifyService.getRecipients).mockResolvedValue({ manager: [], finance: [] });
    vi.mocked(crmNotifyService.saveRecipients).mockResolvedValue(undefined);
    renderPage();

    const boxes = await screen.findAllByRole('checkbox');
    await user.click(boxes[0]); // Managers → Sales Lead
    await user.click(boxes[3]); // Finance → Finance Team
    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() =>
      expect(crmNotifyService.saveRecipients).toHaveBeenCalledWith({ manager: ['r-sales'], finance: ['r-fin'] }),
    );
  });

  it('disables editing and explains why without configure permission', async () => {
    hasPermission.mockReturnValue(false);
    vi.mocked(crmNotifyService.getRecipients).mockResolvedValue({ manager: [], finance: [] });
    renderPage();

    const boxes = await screen.findAllByRole('checkbox');
    boxes.forEach((b) => expect(b).toBeDisabled());
    expect(screen.getByText(/requires Workflow Config Configure access/)).toBeInTheDocument();
  });
});
