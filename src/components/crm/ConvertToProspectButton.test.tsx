import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AxiosError } from 'axios';
import type * as CrmServiceModule from '@/services/crmService';
import type { WorkflowRecord } from '@/types/tenant';

vi.mock('@/services/crmService', async (importOriginal) => {
  const actual = await importOriginal<typeof CrmServiceModule>();
  return { ...actual, crmService: { convertRecord: vi.fn() } };
});
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { ConvertToProspectButton } from './ConvertToProspectButton';
import { crmService } from '@/services/crmService';
import { toast } from 'sonner';

const LEAD_ID = 'lead-1';

// This suite shares the machine with ~170 others in parallel jsdom workers, and
// a starved worker can take well over the 1s default to settle a mocked call.
const SETTLE_TIMEOUT_MS = 5_000;
const SETTLE = { timeout: SETTLE_TIMEOUT_MS };

function makeRecord(overrides: Partial<WorkflowRecord> = {}): WorkflowRecord {
  return {
    id: 'prospect-9',
    workflowId: 'prospect',
    currentStateId: '13',
    coreFields: {},
    customFields: {},
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

function renderButton() {
  const onConverted = vi.fn();
  const queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <ConvertToProspectButton recordId={LEAD_ID} onConverted={onConverted} />
    </QueryClientProvider>,
  );
  // Looked up once: the same node stays mounted while the mutation is pending,
  // and the accessible-name query is too costly to re-run on every poll.
  const button = screen.getByRole('button', { name: 'Convert to Prospect' });
  return { onConverted, button };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('ConvertToProspectButton', () => {
  it('converts the lead into a prospect and hands the new record back', async () => {
    const prospect = makeRecord();
    vi.mocked(crmService.convertRecord).mockResolvedValue({ record: prospect, sourceRecordId: LEAD_ID, created: true });
    const { onConverted, button } = renderButton();

    await userEvent.click(button);

    await waitFor(() => expect(onConverted).toHaveBeenCalledWith(prospect), SETTLE);
    expect(crmService.convertRecord).toHaveBeenCalledWith(LEAD_ID, 'prospect', undefined, 'lead');
    expect(toast.success).toHaveBeenCalledWith('Converted to prospect.');
  });

  it('opens the existing prospect, and says so, when the lead was already converted', async () => {
    const prospect = makeRecord();
    vi.mocked(crmService.convertRecord).mockResolvedValue({ record: prospect, sourceRecordId: LEAD_ID, created: false });
    const { onConverted, button } = renderButton();

    await userEvent.click(button);

    await waitFor(() => expect(onConverted).toHaveBeenCalledWith(prospect), SETTLE);
    expect(toast.success).toHaveBeenCalledWith('Already converted — opening the prospect.');
  });

  it('names what it is really opening when the earlier prospect has become a customer', async () => {
    const customer = makeRecord({ id: 'customer-3', workflowId: 'customer' });
    vi.mocked(crmService.convertRecord).mockResolvedValue({ record: customer, sourceRecordId: LEAD_ID, created: false });
    const { onConverted, button } = renderButton();

    await userEvent.click(button);

    await waitFor(() => expect(onConverted).toHaveBeenCalledWith(customer), SETTLE);
    expect(toast.success).toHaveBeenCalledWith('Already converted — opening the customer.');
  });

  it("surfaces the server's message and does not navigate when the conversion fails", async () => {
    const err = new AxiosError('Conflict');
    err.response = {
      status: 400, statusText: 'Bad Request', headers: {}, config: {} as never,
      data: { message: 'Only a Qualified lead can be converted.' },
    };
    vi.mocked(crmService.convertRecord).mockRejectedValue(err);
    const { onConverted, button } = renderButton();

    await userEvent.click(button);

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Only a Qualified lead can be converted.'), SETTLE);
    expect(onConverted).not.toHaveBeenCalled();
    expect(toast.success).not.toHaveBeenCalled();
    await waitFor(() => expect(button).toBeEnabled(), SETTLE);
  });

  it('disables itself while the conversion is in flight, so a double click cannot fire twice', async () => {
    let finish: (value: { record: WorkflowRecord; sourceRecordId: string; created: boolean }) => void = () => {};
    vi.mocked(crmService.convertRecord).mockReturnValue(new Promise((resolve) => { finish = resolve; }));
    const { button } = renderButton();

    await userEvent.click(button);

    await waitFor(() => expect(button).toBeDisabled(), SETTLE);
    expect(crmService.convertRecord).toHaveBeenCalledTimes(1);

    finish({ record: makeRecord(), sourceRecordId: LEAD_ID, created: true });
    await waitFor(() => expect(button).toBeEnabled(), SETTLE);
  });
});
