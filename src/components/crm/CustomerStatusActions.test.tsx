import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AxiosError } from 'axios';
import type * as CrmServiceModule from '@/services/crmService';
import type { StatusInfo, WorkflowRecord } from '@/types/tenant';

vi.mock('@/services/crmService', async (importOriginal) => {
  const actual = await importOriginal<typeof CrmServiceModule>();
  return { ...actual, crmService: { transitionRecord: vi.fn() } };
});
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { CustomerStatusActions } from './CustomerStatusActions';
import { crmService } from '@/services/crmService';
import { toast } from 'sonner';

const CUSTOMER_ID = 'customer-1';

// This suite shares the machine with ~170 others in parallel jsdom workers, and
// a starved worker can take well over the 1s default to settle a mocked call.
const SETTLE_TIMEOUT_MS = 5_000;
const SETTLE = { timeout: SETTLE_TIMEOUT_MS };

function status(stateId: string, stateKey: string, statusLabel: string): StatusInfo {
  return {
    stateId, stateKey, statusLabel, workflowKey: 'customer', workflowName: 'Customer',
    isInitial: stateKey === 'CDRF', isTerminal: false, sortOrder: Number(stateId), color: '',
  };
}

const STATUSES: StatusInfo[] = [
  status('14', 'CDRF', 'Draft'),
  status('20', 'CACT', 'Active'),
  status('21', 'CINA', 'Inactive'),
  status('22', 'CCHD', 'Credit Hold'),
];

function makeRecord(currentStateId: string): WorkflowRecord {
  return {
    id: CUSTOMER_ID, workflowId: 'customer', currentStateId, coreFields: {}, customFields: {},
    createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z',
  };
}

interface Options {
  statusCode?: string;
  gated?: boolean;
  statuses?: StatusInfo[];
}

function renderActions({ statusCode = 'CACT', gated = false, statuses = STATUSES }: Options = {}) {
  const onChanged = vi.fn();
  const queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <CustomerStatusActions
        recordId={CUSTOMER_ID}
        statusCode={statusCode}
        gated={gated}
        statuses={statuses}
        onChanged={onChanged}
      />
    </QueryClientProvider>,
  );
  return { onChanged };
}

const labels = () => screen.queryAllByRole('button').map((b) => b.textContent);

beforeEach(() => {
  vi.clearAllMocks();
});

describe('CustomerStatusActions — which buttons show', () => {
  it.each([
    ['CDRF', ['Make Active']],
    ['CACT', ['Credit Hold', 'Make Inactive']],
    ['CCHD', ['Release Hold', 'Make Inactive']],
    ['CINA', ['Make Active']],
  ])('a customer in %s is offered %j', (statusCode, want) => {
    renderActions({ statusCode });
    expect(labels()).toEqual(want);
  });

  it('shows nothing while the customer is awaiting approval', () => {
    renderActions({ statusCode: 'CDRF', gated: true });
    expect(labels()).toEqual([]);
  });

  it("hides a button whose target status isn't in the catalog yet", () => {
    renderActions({ statusCode: 'CACT', statuses: STATUSES.filter((s) => s.stateKey !== 'CCHD') });
    expect(labels()).toEqual(['Make Inactive']);
  });
});

describe('CustomerStatusActions — pressing one', () => {
  it.each([
    ['CDRF', 'Make Active', '20', 'Customer is now Active.'],
    ['CACT', 'Credit Hold', '22', 'Customer put on Credit Hold.'],
    ['CACT', 'Make Inactive', '21', 'Customer is now Inactive.'],
    ['CCHD', 'Release Hold', '20', 'Credit Hold released. Customer is Active.'],
    ['CINA', 'Make Active', '20', 'Customer is now Active.'],
  ])('%s: %s sends the customer to status %s and says so', async (statusCode, label, toStateId, message) => {
    const updated = makeRecord(toStateId);
    vi.mocked(crmService.transitionRecord).mockResolvedValue(updated);
    const { onChanged } = renderActions({ statusCode });

    await userEvent.click(screen.getByRole('button', { name: label }));

    await waitFor(() => expect(onChanged).toHaveBeenCalledWith(updated), SETTLE);
    expect(crmService.transitionRecord).toHaveBeenCalledWith(CUSTOMER_ID, toStateId, 'customer');
    expect(toast.success).toHaveBeenCalledWith(message);
  });

  it("surfaces the server's message and reports nothing done when the move is refused", async () => {
    const err = new AxiosError('Conflict');
    err.response = {
      status: 409, statusText: 'Conflict', headers: {}, config: {} as never,
      data: { message: 'This record must be approved before it can leave its current status.' },
    };
    vi.mocked(crmService.transitionRecord).mockRejectedValue(err);
    const { onChanged } = renderActions({ statusCode: 'CACT' });

    await userEvent.click(screen.getByRole('button', { name: 'Credit Hold' }));

    await waitFor(
      () => expect(toast.error).toHaveBeenCalledWith('This record must be approved before it can leave its current status.'),
      SETTLE,
    );
    expect(onChanged).not.toHaveBeenCalled();
    expect(toast.success).not.toHaveBeenCalled();
  });

  it('falls back to its own message when the failure carries none', async () => {
    vi.mocked(crmService.transitionRecord).mockRejectedValue('network down');
    renderActions({ statusCode: 'CACT' });

    await userEvent.click(screen.getByRole('button', { name: 'Make Inactive' }));

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Failed to change the customer's status."), SETTLE);
  });

  it('disables every button while a move is in flight, so a second click cannot fire', async () => {
    let finish: (value: WorkflowRecord) => void = () => {};
    vi.mocked(crmService.transitionRecord).mockReturnValue(new Promise((resolve) => { finish = resolve; }));
    renderActions({ statusCode: 'CACT' });

    await userEvent.click(screen.getByRole('button', { name: 'Credit Hold' }));

    await waitFor(() => expect(screen.getByRole('button', { name: 'Make Inactive' })).toBeDisabled(), SETTLE);
    expect(crmService.transitionRecord).toHaveBeenCalledTimes(1);

    finish(makeRecord('22'));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Make Inactive' })).toBeEnabled(), SETTLE);
  });
});
