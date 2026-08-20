import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('@/services/tenantServices', () => ({
  workflowService: { getApprovalChain: vi.fn(), setApprovalChain: vi.fn() },
}));
vi.mock('@/hooks/useUserPermissions', () => ({ useUserPermissions: vi.fn() }));

import { ApprovalChainSection } from './ApprovalChainSection';
import { workflowService } from '@/services/tenantServices';
import { useUserPermissions } from '@/hooks/useUserPermissions';
import type { ApprovalGate, ApprovalChainEmployee } from '@/types/tenant';

const WORKFLOW_ID = 'wf-fabrication-job';

const FABRICATION_GATES: ApprovalGate[] = [
  { statusCode: 'TMPL', statusLabel: 'Templating', approverEmployeeIds: [] },
  { statusCode: 'QCPD', statusLabel: 'QC Pending', approverEmployeeIds: [] },
];

function makeEmployees(employees: { id: string; name: string }[]): ApprovalChainEmployee[] {
  return employees.map((e) => ({ id: e.id, name: e.name }));
}

function mockPermissions({ canConfigure = true, isLoading = false }: { canConfigure?: boolean; isLoading?: boolean } = {}) {
  vi.mocked(useUserPermissions).mockReturnValue({
    grants: [],
    isLoading,
    activeRoleId: '',
    hasPermission: (resource: string, action: string) => {
      if (resource !== 'workflow_config') return false;
      if (action === 'read') return true;
      if (action === 'configure') return canConfigure;
      return false;
    },
  } as ReturnType<typeof useUserPermissions>);
}

function renderSection(workflowId: string = WORKFLOW_ID) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  render(
    <QueryClientProvider client={queryClient}>
      <ApprovalChainSection workflowId={workflowId} />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('ApprovalChainSection', () => {
  it('renders one approver-picker-backed card per gate returned by getApprovalChain', async () => {
    mockPermissions();
    vi.mocked(workflowService.getApprovalChain).mockResolvedValue({
      gates: FABRICATION_GATES,
      employees: makeEmployees([{ id: '201', name: 'Casey Approver' }]),
    });

    renderSection();

    expect(await screen.findByText('Templating')).toBeInTheDocument();
    expect(screen.getByText('QC Pending')).toBeInTheDocument();
    // Each gate gets its own interactive ApproverPicker search box.
    expect(screen.getAllByLabelText('Search active users to add as an approver')).toHaveLength(2);
  });

  it('adding an approver to a non-first gate calls setApprovalChain with that gate\'s own statusCode', async () => {
    const user = userEvent.setup();
    mockPermissions();
    vi.mocked(workflowService.getApprovalChain).mockResolvedValue({
      gates: FABRICATION_GATES.map((g) => ({ ...g })),
      employees: makeEmployees([{ id: '201', name: 'Casey Approver' }]),
    });
    vi.mocked(workflowService.setApprovalChain).mockResolvedValue(['201']);

    renderSection();

    await screen.findByText('Templating');
    const qcPendingCard = screen.getByText('QC Pending').closest('div');
    if (!qcPendingCard) throw new Error('QC Pending card not found');

    const searchInput = within(qcPendingCard).getByLabelText('Search active users to add as an approver');
    await user.click(searchInput);
    const option = await within(qcPendingCard).findByRole('button', { name: 'Casey Approver' });
    await user.click(option);

    expect(workflowService.setApprovalChain).toHaveBeenCalledWith(WORKFLOW_ID, 'QCPD', ['201']);
    expect(workflowService.setApprovalChain).not.toHaveBeenCalledWith(WORKFLOW_ID, 'TMPL', expect.anything());
  });

  it('removing an approver calls setApprovalChain with that id filtered out', async () => {
    const user = userEvent.setup();
    mockPermissions();
    const gates: ApprovalGate[] = [
      { statusCode: 'PEND', statusLabel: 'Pending Approval', approverEmployeeIds: ['201', '202'] },
    ];
    vi.mocked(workflowService.getApprovalChain).mockResolvedValue({
      gates,
      employees: makeEmployees([
        { id: '201', name: 'Casey Approver' },
        { id: '202', name: 'Jordan Approver' },
      ]),
    });
    vi.mocked(workflowService.setApprovalChain).mockResolvedValue(['202']);

    renderSection();

    await screen.findByText('Pending Approval');
    await user.click(screen.getByRole('button', { name: 'Remove approver Casey Approver' }));

    expect(workflowService.setApprovalChain).toHaveBeenCalledWith(WORKFLOW_ID, 'PEND', ['202']);
  });

  it('renders a read-only approver list and never calls setApprovalChain when configure permission is missing', async () => {
    mockPermissions({ canConfigure: false });
    const gates: ApprovalGate[] = [
      { statusCode: 'PEND', statusLabel: 'Pending Approval', approverEmployeeIds: ['201'] },
    ];
    vi.mocked(workflowService.getApprovalChain).mockResolvedValue({
      gates,
      employees: makeEmployees([{ id: '201', name: 'Casey Approver' }]),
    });

    renderSection();

    expect(await screen.findByText('Casey Approver')).toBeInTheDocument();
    expect(screen.queryByLabelText('Search active users to add as an approver')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Remove approver/ })).not.toBeInTheDocument();
    expect(workflowService.setApprovalChain).not.toHaveBeenCalled();
  });

  it('renders an empty-state message when there are no approval gates', async () => {
    mockPermissions();
    vi.mocked(workflowService.getApprovalChain).mockResolvedValue({ gates: [], employees: [] });

    renderSection();

    expect(await screen.findByText('No approval gates configured for this workflow.')).toBeInTheDocument();
  });
});
