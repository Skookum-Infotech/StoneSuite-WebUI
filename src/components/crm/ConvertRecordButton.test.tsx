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

import { ConvertRecordButton } from './ConvertRecordButton';
import { crmService } from '@/services/crmService';
import { toast } from 'sonner';

// This suite shares the machine with ~170 others in parallel jsdom workers, and
// a starved worker can take well over the 1s default to settle a mocked call.
const SETTLE_TIMEOUT_MS = 5_000;
const SETTLE = { timeout: SETTLE_TIMEOUT_MS };

// The two conversions the button performs: what it is called, what it converts
// into, what it says, and the server's refusal for a source that is not ready.
interface Hop {
  sourceKey: 'lead' | 'prospect';
  sourceId: string;
  label: string;
  target: 'prospect' | 'customer';
  done: string;
  failed: string;
  refusal: string;
}

const LEAD_HOP: Hop = {
  sourceKey: 'lead',
  sourceId: 'lead-1',
  label: 'Convert to Prospect',
  target: 'prospect',
  done: 'Converted to prospect.',
  failed: 'Failed to convert lead.',
  refusal: 'Only a Qualified lead can be converted.',
};
const PROSPECT_HOP: Hop = {
  sourceKey: 'prospect',
  sourceId: 'prospect-1',
  label: 'Convert to Customer',
  target: 'customer',
  done: 'Converted to customer.',
  failed: 'Failed to convert prospect.',
  refusal: 'Only a prospect in Pending Conversion can be converted.',
};

function makeRecord(overrides: Partial<WorkflowRecord> = {}): WorkflowRecord {
  return {
    id: 'record-9',
    workflowId: 'prospect',
    currentStateId: '13',
    coreFields: {},
    customFields: {},
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

function renderButton(hop: Hop) {
  const onConverted = vi.fn();
  const queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <ConvertRecordButton recordId={hop.sourceId} sourceKey={hop.sourceKey} onConverted={onConverted} />
    </QueryClientProvider>,
  );
  // Looked up once: the same node stays mounted while the mutation is pending,
  // and the accessible-name query is too costly to re-run on every poll.
  const button = screen.getByRole('button', { name: hop.label });
  return { onConverted, button };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe.each([LEAD_HOP, PROSPECT_HOP])('ConvertRecordButton on a $sourceKey', (hop) => {
  it(`converts it into a ${hop.target} and hands the new record back`, async () => {
    const created = makeRecord({ workflowId: hop.target });
    vi.mocked(crmService.convertRecord).mockResolvedValue({ record: created, sourceRecordId: hop.sourceId, created: true });
    const { onConverted, button } = renderButton(hop);

    await userEvent.click(button);

    await waitFor(() => expect(onConverted).toHaveBeenCalledWith(created), SETTLE);
    expect(crmService.convertRecord).toHaveBeenCalledWith(hop.sourceId, hop.target, undefined, hop.sourceKey);
    expect(toast.success).toHaveBeenCalledWith(hop.done);
  });

  it(`opens the existing ${hop.target}, and says so, when it was already converted`, async () => {
    const existing = makeRecord({ workflowId: hop.target });
    vi.mocked(crmService.convertRecord).mockResolvedValue({ record: existing, sourceRecordId: hop.sourceId, created: false });
    const { onConverted, button } = renderButton(hop);

    await userEvent.click(button);

    await waitFor(() => expect(onConverted).toHaveBeenCalledWith(existing), SETTLE);
    expect(toast.success).toHaveBeenCalledWith(`Already converted — opening the ${hop.target}.`);
  });

  it("surfaces the server's message and does not navigate when the conversion fails", async () => {
    const err = new AxiosError('Conflict');
    err.response = {
      status: 400, statusText: 'Bad Request', headers: {}, config: {} as never,
      data: { message: hop.refusal },
    };
    vi.mocked(crmService.convertRecord).mockRejectedValue(err);
    const { onConverted, button } = renderButton(hop);

    await userEvent.click(button);

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(hop.refusal), SETTLE);
    expect(onConverted).not.toHaveBeenCalled();
    expect(toast.success).not.toHaveBeenCalled();
    await waitFor(() => expect(button).toBeEnabled(), SETTLE);
  });

  it('falls back to its own message when the failure carries none', async () => {
    vi.mocked(crmService.convertRecord).mockRejectedValue('network down');
    const { button } = renderButton(hop);

    await userEvent.click(button);

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(hop.failed), SETTLE);
  });

  it('disables itself while the conversion is in flight, so a double click cannot fire twice', async () => {
    let finish: (value: { record: WorkflowRecord; sourceRecordId: string; created: boolean }) => void = () => {};
    vi.mocked(crmService.convertRecord).mockReturnValue(new Promise((resolve) => { finish = resolve; }));
    const { button } = renderButton(hop);

    await userEvent.click(button);

    await waitFor(() => expect(button).toBeDisabled(), SETTLE);
    expect(crmService.convertRecord).toHaveBeenCalledTimes(1);

    finish({ record: makeRecord(), sourceRecordId: hop.sourceId, created: true });
    await waitFor(() => expect(button).toBeEnabled(), SETTLE);
  });
});

describe('ConvertRecordButton replay naming', () => {
  it('names what it is really opening when the earlier prospect has become a customer', async () => {
    const customer = makeRecord({ id: 'customer-3', workflowId: 'customer' });
    vi.mocked(crmService.convertRecord).mockResolvedValue({ record: customer, sourceRecordId: LEAD_HOP.sourceId, created: false });
    const { onConverted, button } = renderButton(LEAD_HOP);

    await userEvent.click(button);

    await waitFor(() => expect(onConverted).toHaveBeenCalledWith(customer), SETTLE);
    expect(toast.success).toHaveBeenCalledWith('Already converted — opening the customer.');
  });
});
