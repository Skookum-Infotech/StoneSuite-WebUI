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

import { LeadStatusActions } from './LeadStatusActions';
import { crmService } from '@/services/crmService';
import { toast } from 'sonner';

const LEAD_ID = 'lead-1';

// This suite shares the machine with ~170 others in parallel jsdom workers, and
// a starved worker can take well over the 1s default to settle a mocked call.
const SETTLE_TIMEOUT_MS = 5_000;
const SETTLE = { timeout: SETTLE_TIMEOUT_MS };

function status(stateId: string, stateKey: string, statusLabel: string): StatusInfo {
  return {
    stateId, stateKey, statusLabel, workflowKey: 'lead', workflowName: 'Lead',
    isInitial: stateKey === 'LNEW', isTerminal: stateKey !== 'LNEW', sortOrder: Number(stateId), color: '',
  };
}

const STATUSES: StatusInfo[] = [
  status('12', 'LNEW', 'New'),
  status('1', 'LQUA', 'Lead Qualified'),
  status('2', 'LUNQ', 'Lead Unqualified'),
];

function makeRecord(currentStateId: string): WorkflowRecord {
  return {
    id: LEAD_ID, workflowId: 'lead', currentStateId, coreFields: {}, customFields: {},
    createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z',
  };
}

interface Options {
  statusCode?: string;
  gated?: boolean;
  statuses?: StatusInfo[];
}

function renderActions({ statusCode = 'LNEW', gated = false, statuses = STATUSES }: Options = {}) {
  const onChanged = vi.fn();
  const queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <LeadStatusActions
        recordId={LEAD_ID}
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

describe('LeadStatusActions — which buttons show', () => {
  it.each([
    ['LNEW', ['Mark Qualified', 'Mark Unqualified']],
    ['LQUA', []],
    ['LUNQ', []],
  ])('a lead in %s is offered %j', (statusCode, want) => {
    renderActions({ statusCode });
    expect(labels()).toEqual(want);
  });

  it("hides a button whose target status isn't in the catalog yet", () => {
    renderActions({ statuses: STATUSES.filter((s) => s.stateKey !== 'LQUA') });
    expect(labels()).toEqual(['Mark Unqualified']);
  });

  it('keeps Mark Unqualified enabled while awaiting approval, but blocks Mark Qualified', async () => {
    const { onChanged } = renderActions({ gated: true });
    const qualify = screen.getByRole('button', { name: 'Mark Qualified' });

    // aria-disabled, not the native attribute — kept focusable so screen
    // reader / keyboard users still reach it and its title explains why.
    expect(qualify).toHaveAttribute('aria-disabled', 'true');
    expect(qualify).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Mark Unqualified' })).not.toHaveAttribute('aria-disabled', 'true');

    await userEvent.click(qualify);
    expect(crmService.transitionRecord).not.toHaveBeenCalled();
    expect(onChanged).not.toHaveBeenCalled();
  });
});

describe('LeadStatusActions — pressing one', () => {
  it.each([
    ['Mark Qualified', '1', 'Lead marked Qualified.'],
    ['Mark Unqualified', '2', 'Lead marked Unqualified.'],
  ])('%s sends the lead to status %s and says so', async (label, toStateId, message) => {
    const updated = makeRecord(toStateId);
    vi.mocked(crmService.transitionRecord).mockResolvedValue(updated);
    const { onChanged } = renderActions();

    await userEvent.click(screen.getByRole('button', { name: label }));

    await waitFor(() => expect(onChanged).toHaveBeenCalledWith(updated), SETTLE);
    expect(crmService.transitionRecord).toHaveBeenCalledWith(LEAD_ID, toStateId, 'lead');
    expect(toast.success).toHaveBeenCalledWith(message);
  });

  it("surfaces the server's message and reports nothing done when the move is refused", async () => {
    const err = new AxiosError('Conflict');
    err.response = {
      status: 409, statusText: 'Conflict', headers: {}, config: {} as never,
      data: { message: 'This record must be approved before it can leave its current status.' },
    };
    vi.mocked(crmService.transitionRecord).mockRejectedValue(err);
    const { onChanged } = renderActions();

    await userEvent.click(screen.getByRole('button', { name: 'Mark Qualified' }));

    await waitFor(
      () => expect(toast.error).toHaveBeenCalledWith('This record must be approved before it can leave its current status.'),
      SETTLE,
    );
    expect(onChanged).not.toHaveBeenCalled();
    expect(toast.success).not.toHaveBeenCalled();
  });

  it('falls back to its own message when the failure carries none', async () => {
    vi.mocked(crmService.transitionRecord).mockRejectedValue('network down');
    renderActions();

    await userEvent.click(screen.getByRole('button', { name: 'Mark Unqualified' }));

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Failed to change the lead's status."), SETTLE);
  });

  it('disables every button while a move is in flight, so a second click cannot fire', async () => {
    let finish: (value: WorkflowRecord) => void = () => {};
    vi.mocked(crmService.transitionRecord).mockReturnValue(new Promise((resolve) => { finish = resolve; }));
    renderActions();

    await userEvent.click(screen.getByRole('button', { name: 'Mark Qualified' }));

    await waitFor(() => expect(screen.getByRole('button', { name: 'Mark Unqualified' })).toBeDisabled(), SETTLE);
    expect(crmService.transitionRecord).toHaveBeenCalledTimes(1);

    finish(makeRecord('1'));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Mark Unqualified' })).toBeEnabled(), SETTLE);
  });
});
