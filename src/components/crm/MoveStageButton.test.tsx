import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AxiosError } from 'axios';
import type { StatusInfo, WorkflowRecord } from '@/types/tenant';

vi.mock('@/services/crmService', () => ({
  crmService: { getAvailableTransitions: vi.fn(), transitionRecord: vi.fn() },
}));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { MoveStageButton } from './MoveStageButton';
import { crmService } from '@/services/crmService';
import { toast } from 'sonner';

const RECORD_ID = 'prospect-1';
const CURRENT_ID = '10';

// This suite shares the machine with ~170 others in parallel jsdom workers, and
// a starved worker can take well over the 1s default to settle a mocked query.
const SETTLE_TIMEOUT_MS = 5_000;
const SETTLE = { timeout: SETTLE_TIMEOUT_MS };

function status(overrides: Partial<StatusInfo>): StatusInfo {
  return {
    stateId: '0', stateKey: 'XXXX', statusLabel: '', workflowKey: 'prospect', workflowName: 'Prospect',
    isInitial: false, isTerminal: false, sortOrder: 0, color: '',
    ...overrides,
  };
}

const IN_DISCUSSION = status({ stateId: '11', stateKey: 'PDIS', statusLabel: 'In Discussion' });
const PROPOSAL = status({ stateId: '12', stateKey: 'PPRP', statusLabel: 'Proposal' });
const CLOSED_LOST = status({ stateId: '13', stateKey: 'PCLL', statusLabel: 'Closed Lost', isTerminal: true });

function makeRecord(currentStateId: string): WorkflowRecord {
  return {
    id: RECORD_ID, workflowId: 'prospect', currentStateId, coreFields: {}, customFields: {},
    createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z',
  };
}

function renderButton(props: Partial<{ gated: boolean }> = {}) {
  const onChanged = vi.fn();
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <MoveStageButton
        workflowKey="prospect"
        recordId={RECORD_ID}
        currentStateId={CURRENT_ID}
        onChanged={onChanged}
        {...props}
      />
    </QueryClientProvider>,
  );
  return { onChanged };
}

async function openMenu() {
  const user = userEvent.setup();
  await user.click(screen.getByRole('button', { name: 'Move to a different stage' }));
  return user;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('MoveStageButton — the menu', () => {
  it('fetches nothing until opened, then lists only the moves the server offers', async () => {
    vi.mocked(crmService.getAvailableTransitions).mockResolvedValue([IN_DISCUSSION, PROPOSAL, CLOSED_LOST]);
    renderButton();
    expect(crmService.getAvailableTransitions).not.toHaveBeenCalled();

    await openMenu();

    await screen.findByRole('option', { name: 'In Discussion' }, SETTLE);
    expect(screen.getByRole('option', { name: 'Proposal' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Closed Lost' })).toBeInTheDocument();
    expect(crmService.getAvailableTransitions).toHaveBeenCalledWith(RECORD_ID, 'prospect');
  });

  it('shows a message instead of an empty menu once a record has no moves left', async () => {
    vi.mocked(crmService.getAvailableTransitions).mockResolvedValue([]);
    renderButton();

    await openMenu();

    expect(await screen.findByText('No further status changes.', {}, SETTLE)).toBeInTheDocument();
  });
});

describe('MoveStageButton — choosing a stage', () => {
  it('moves to a non-terminal stage on a single click and reports it', async () => {
    vi.mocked(crmService.getAvailableTransitions).mockResolvedValue([IN_DISCUSSION, PROPOSAL]);
    const updated = makeRecord(PROPOSAL.stateId);
    vi.mocked(crmService.transitionRecord).mockResolvedValue(updated);
    const { onChanged } = renderButton();
    const user = await openMenu();

    await user.click(await screen.findByRole('option', { name: 'Proposal' }, SETTLE));

    await waitFor(() => expect(onChanged).toHaveBeenCalledWith(updated), SETTLE);
    expect(crmService.transitionRecord).toHaveBeenCalledWith(RECORD_ID, PROPOSAL.stateId, 'prospect');
    expect(toast.success).toHaveBeenCalledWith('Moved to Proposal.');
  });

  it('arms a terminal target instead of firing immediately, and commits on the second click', async () => {
    vi.mocked(crmService.getAvailableTransitions).mockResolvedValue([IN_DISCUSSION, CLOSED_LOST]);
    vi.mocked(crmService.transitionRecord).mockResolvedValue(makeRecord(CLOSED_LOST.stateId));
    const { onChanged } = renderButton();
    const user = await openMenu();

    const lost = await screen.findByRole('option', { name: 'Closed Lost' }, SETTLE);
    await user.click(lost);

    expect(crmService.transitionRecord).not.toHaveBeenCalled();
    expect(await screen.findByRole('option', { name: 'Confirm: Closed Lost' }, SETTLE)).toBeInTheDocument();

    await user.click(screen.getByRole('option', { name: 'Confirm: Closed Lost' }));

    await waitFor(() => expect(onChanged).toHaveBeenCalled(), SETTLE);
    expect(crmService.transitionRecord).toHaveBeenCalledWith(RECORD_ID, CLOSED_LOST.stateId, 'prospect');
  });

  it("surfaces the server's message and reports nothing done when the move is refused", async () => {
    vi.mocked(crmService.getAvailableTransitions).mockResolvedValue([IN_DISCUSSION]);
    const err = new AxiosError('Conflict');
    err.response = {
      status: 409, statusText: 'Conflict', headers: {}, config: {} as never,
      data: { message: 'This record must be approved before it can leave its current status.' },
    };
    vi.mocked(crmService.transitionRecord).mockRejectedValue(err);
    const { onChanged } = renderButton();
    const user = await openMenu();

    await user.click(await screen.findByRole('option', { name: 'In Discussion' }, SETTLE));

    await waitFor(
      () => expect(toast.error).toHaveBeenCalledWith('This record must be approved before it can leave its current status.'),
      SETTLE,
    );
    expect(onChanged).not.toHaveBeenCalled();
  });

  it('keeps the approval gate: only the always-allowed exit stays selectable while gated', async () => {
    vi.mocked(crmService.getAvailableTransitions).mockResolvedValue([IN_DISCUSSION, CLOSED_LOST]);
    const { onChanged } = renderButton({ gated: true });
    const user = await openMenu();

    const discussion = await screen.findByRole('option', { name: 'In Discussion' }, SETTLE);
    const lost = screen.getByRole('option', { name: 'Closed Lost' });
    expect(discussion).toHaveAttribute('aria-disabled', 'true');
    expect(lost).toHaveAttribute('aria-disabled', 'false');

    await user.click(discussion);
    expect(crmService.transitionRecord).not.toHaveBeenCalled();
    expect(onChanged).not.toHaveBeenCalled();
  });
});
