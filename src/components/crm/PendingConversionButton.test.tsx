import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AxiosError } from 'axios';
import type * as CrmServiceModule from '@/services/crmService';
import type { WorkflowRecord } from '@/types/tenant';

vi.mock('@/services/crmService', async (importOriginal) => {
  const actual = await importOriginal<typeof CrmServiceModule>();
  return { ...actual, crmService: { transitionRecord: vi.fn() } };
});
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { PendingConversionButton } from './PendingConversionButton';
import { crmService } from '@/services/crmService';
import { toast } from 'sonner';

const PROSPECT_ID = 'prospect-1';
const PENDING_CONVERSION_STATE_ID = '15';

// This suite shares the machine with ~170 others in parallel jsdom workers, and
// a starved worker can take well over the 1s default to settle a mocked call.
const SETTLE_TIMEOUT_MS = 5_000;
const SETTLE = { timeout: SETTLE_TIMEOUT_MS };

function makeRecord(overrides: Partial<WorkflowRecord> = {}): WorkflowRecord {
  return {
    id: PROSPECT_ID,
    workflowId: 'prospect',
    currentStateId: PENDING_CONVERSION_STATE_ID,
    coreFields: {},
    customFields: {},
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

function renderButton() {
  const onMarked = vi.fn();
  const queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <PendingConversionButton recordId={PROSPECT_ID} toStateId={PENDING_CONVERSION_STATE_ID} onMarked={onMarked} />
    </QueryClientProvider>,
  );
  // Looked up once: the same node stays mounted while the mutation is pending,
  // and the accessible-name query is too costly to re-run on every poll.
  const button = screen.getByRole('button', { name: 'Pending Conversion' });
  return { onMarked, button };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('PendingConversionButton', () => {
  it('moves the prospect to Pending Conversion and hands the updated record back', async () => {
    const updated = makeRecord();
    vi.mocked(crmService.transitionRecord).mockResolvedValue(updated);
    const { onMarked, button } = renderButton();

    await userEvent.click(button);

    await waitFor(() => expect(onMarked).toHaveBeenCalledWith(updated), SETTLE);
    expect(crmService.transitionRecord).toHaveBeenCalledWith(PROSPECT_ID, PENDING_CONVERSION_STATE_ID, 'prospect');
    expect(toast.success).toHaveBeenCalledWith('Marked as Pending Conversion.');
  });

  it("surfaces the server's message and reports nothing done when the move is refused", async () => {
    const err = new AxiosError('Conflict');
    err.response = {
      status: 409, statusText: 'Conflict', headers: {}, config: {} as never,
      data: { message: 'This record must be approved before it can leave its current status.' },
    };
    vi.mocked(crmService.transitionRecord).mockRejectedValue(err);
    const { onMarked, button } = renderButton();

    await userEvent.click(button);

    await waitFor(
      () => expect(toast.error).toHaveBeenCalledWith('This record must be approved before it can leave its current status.'),
      SETTLE,
    );
    expect(onMarked).not.toHaveBeenCalled();
    expect(toast.success).not.toHaveBeenCalled();
    await waitFor(() => expect(button).toBeEnabled(), SETTLE);
  });

  it('falls back to its own message when the failure carries none', async () => {
    vi.mocked(crmService.transitionRecord).mockRejectedValue('network down');
    const { button } = renderButton();

    await userEvent.click(button);

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Failed to mark as Pending Conversion.'), SETTLE);
  });

  it('disables itself while the move is in flight, so a double click cannot fire twice', async () => {
    let finish: (value: WorkflowRecord) => void = () => {};
    vi.mocked(crmService.transitionRecord).mockReturnValue(new Promise((resolve) => { finish = resolve; }));
    const { button } = renderButton();

    await userEvent.click(button);

    await waitFor(() => expect(button).toBeDisabled(), SETTLE);
    expect(crmService.transitionRecord).toHaveBeenCalledTimes(1);

    finish(makeRecord());
    await waitFor(() => expect(button).toBeEnabled(), SETTLE);
  });
});
