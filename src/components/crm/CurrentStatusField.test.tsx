import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { StatusInfo, Workflow } from '@/types/tenant';

vi.mock('@/services/crmService', () => ({
  crmService: { getWorkflowStatuses: vi.fn() },
}));

import { CurrentStatusField } from './CurrentStatusField';
import { crmService } from '@/services/crmService';

// This suite shares the machine with ~170 others in parallel jsdom workers, and
// a starved worker can take well over the 1s default to settle a mocked query.
const SETTLE_TIMEOUT_MS = 5_000;
const SETTLE = { timeout: SETTLE_TIMEOUT_MS };

function status(overrides: Partial<StatusInfo>): StatusInfo {
  return {
    stateId: '1', stateKey: 'CDRF', statusLabel: 'Draft',
    workflowKey: 'customer', workflowName: 'Customer',
    isInitial: false, isTerminal: false, sortOrder: 1, color: '',
    ...overrides,
  };
}

function renderField(statusId: string) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <CurrentStatusField workflowKey="customer" statusId={statusId} />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('CurrentStatusField', () => {
  it("shows the record's own status, read-only", async () => {
    vi.mocked(crmService.getWorkflowStatuses).mockResolvedValue({
      workflow: { key: 'customer' } as Workflow,
      statuses: [
        status({ stateId: '14', stateKey: 'CDRF', statusLabel: 'Draft', isInitial: true }),
        status({ stateId: '20', stateKey: 'CACT', statusLabel: 'Active' }),
        status({ stateId: '22', stateKey: 'CCHD', statusLabel: 'Credit Hold' }),
      ],
    });

    renderField('22');

    expect(await screen.findByText('Credit Hold', undefined, SETTLE)).toBeInTheDocument();
    expect(screen.queryByText('Active')).not.toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
  });

  it('shows a dash when the status is not in the catalog', async () => {
    vi.mocked(crmService.getWorkflowStatuses).mockResolvedValue({
      workflow: { key: 'customer' } as Workflow,
      statuses: [status({ stateId: '20', stateKey: 'CACT', statusLabel: 'Active' })],
    });

    renderField('999');

    expect(await screen.findByText('—', undefined, SETTLE)).toBeInTheDocument();
  });
});
