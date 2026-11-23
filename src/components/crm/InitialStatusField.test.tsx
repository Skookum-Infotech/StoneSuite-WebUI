import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { StatusInfo, Workflow } from '@/types/tenant';

vi.mock('@/services/crmService', () => ({
  crmService: { getWorkflowStatuses: vi.fn() },
}));

import { InitialStatusField } from './InitialStatusField';
import { crmService } from '@/services/crmService';

// This suite shares the machine with ~170 others in parallel jsdom workers, and
// a starved worker can take well over the 1s default to settle a mocked query.
const SETTLE_TIMEOUT_MS = 5_000;
const SETTLE = { timeout: SETTLE_TIMEOUT_MS };

function status(overrides: Partial<StatusInfo>): StatusInfo {
  return {
    stateId: '1', stateKey: 'LQUA', statusLabel: 'Lead Qualified',
    workflowKey: 'lead', workflowName: 'Lead',
    isInitial: false, isTerminal: false, sortOrder: 1, color: '',
    ...overrides,
  };
}

function statusesResponse(statuses: StatusInfo[]) {
  return { workflow: { key: 'lead' } as Workflow, statuses };
}

function renderField() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <InitialStatusField workflowKey="lead" />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('InitialStatusField', () => {
  it("shows the stage's initial status and none of the others", async () => {
    // The entry status has the HIGHEST id on a tenant that predates it, so this
    // must go by the server's isInitial flag, never by position.
    vi.mocked(crmService.getWorkflowStatuses).mockResolvedValue(statusesResponse([
      status({ stateId: '1', stateKey: 'LQUA', statusLabel: 'Lead Qualified' }),
      status({ stateId: '2', stateKey: 'LUNQ', statusLabel: 'Lead Unqualified' }),
      status({ stateId: '12', stateKey: 'LNEW', statusLabel: 'New', isInitial: true }),
    ]));

    renderField();

    expect(await screen.findByText('New', {}, SETTLE)).toBeInTheDocument();
    expect(screen.queryByText('Lead Qualified')).not.toBeInTheDocument();
    expect(screen.queryByText('Lead Unqualified')).not.toBeInTheDocument();
  });

  it('shows a loading placeholder until the statuses arrive', () => {
    vi.mocked(crmService.getWorkflowStatuses).mockReturnValue(new Promise(() => {}));

    renderField();

    expect(screen.getByText('Loading…')).toBeInTheDocument();
  });

  it('shows a dash when the workflow reports no initial status', async () => {
    vi.mocked(crmService.getWorkflowStatuses).mockResolvedValue(statusesResponse([
      status({ stateId: '1', stateKey: 'LQUA', statusLabel: 'Lead Qualified' }),
    ]));

    renderField();

    expect(await screen.findByText('—', {}, SETTLE)).toBeInTheDocument();
  });
});
