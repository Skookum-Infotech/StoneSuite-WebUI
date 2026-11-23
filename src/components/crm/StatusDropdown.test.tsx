import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ComponentProps } from 'react';
import type { StatusInfo, Workflow } from '@/types/tenant';

vi.mock('@/services/crmService', () => ({
  crmService: { getWorkflowStatuses: vi.fn(), getAvailableTransitions: vi.fn() },
}));

import { StatusDropdown } from './StatusDropdown';
import { crmService } from '@/services/crmService';

const RECORD_ID = 'lead-1';
const NEW_ID = '12';
const QUALIFIED_ID = '1';

// This suite shares the machine with ~170 others in parallel jsdom workers, and
// a starved worker can take well over the 1s default to settle a mocked query.
// Waits use cheap text queries (findByText); the expensive accessible-name
// queries (getByRole) only run synchronously, once the DOM has settled.
const SETTLE_TIMEOUT_MS = 5_000;
const SETTLE = { timeout: SETTLE_TIMEOUT_MS };

function status(overrides: Partial<StatusInfo>): StatusInfo {
  return {
    stateId: '0', stateKey: 'XXXX', statusLabel: '', workflowKey: 'lead', workflowName: 'Lead',
    isInitial: false, isTerminal: false, sortOrder: 0, color: '',
    ...overrides,
  };
}

const NEW = status({ stateId: NEW_ID, stateKey: 'LNEW', statusLabel: 'New', isInitial: true });
const QUALIFIED = status({ stateId: QUALIFIED_ID, stateKey: 'LQUA', statusLabel: 'Lead Qualified', isTerminal: true });
const UNQUALIFIED = status({ stateId: '2', stateKey: 'LUNQ', statusLabel: 'Lead Unqualified', isTerminal: true });

function mockLead(transitions: StatusInfo[]) {
  vi.mocked(crmService.getWorkflowStatuses).mockResolvedValue({
    workflow: { key: 'lead' } as Workflow,
    statuses: [NEW, QUALIFIED, UNQUALIFIED],
  });
  vi.mocked(crmService.getAvailableTransitions).mockResolvedValue(transitions);
}

type Props = Partial<ComponentProps<typeof StatusDropdown>>;

function renderDropdown(props: Props = {}) {
  const onChange = vi.fn();
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const ui = (p: Props) => (
    <QueryClientProvider client={queryClient}>
      <StatusDropdown workflowKey="lead" recordId={RECORD_ID} value={NEW_ID} onChange={onChange} {...p} />
    </QueryClientProvider>
  );
  const { rerender } = render(ui(props));
  return { onChange, rerenderWith: (p: Props) => rerender(ui({ ...props, ...p })) };
}

/** Waits until the status catalog has loaded and the trigger shows `label`. */
const triggerShowing = async (label: string) => {
  await screen.findByText(label, {}, SETTLE);
  return screen.getByRole('button', { name: label });
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('StatusDropdown', () => {
  it('offers only the moves the server lists, and reports the chosen one', async () => {
    mockLead([QUALIFIED, UNQUALIFIED]);
    const { onChange } = renderDropdown();
    const user = userEvent.setup();

    await user.click(await triggerShowing('New'));
    await screen.findByText('Lead Qualified', {}, SETTLE);

    expect(screen.getByRole('option', { name: 'Lead Qualified' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Lead Unqualified' })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'New' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('option', { name: 'Lead Qualified' }));
    expect(onChange).toHaveBeenCalledWith(QUALIFIED_ID, 'Lead Qualified');
  });

  it('renders a static, non-interactive status once a record has no moves left', async () => {
    mockLead([]);
    renderDropdown({ value: QUALIFIED_ID });

    const trigger = await triggerShowing('Lead Qualified');

    await waitFor(() => expect(trigger).toBeDisabled(), SETTLE);
    expect(trigger).toHaveAttribute('title', 'No further status changes.');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('cannot know a lazy dropdown is final until it is opened, so it fetches nothing up front', async () => {
    mockLead([]);
    renderDropdown({ value: QUALIFIED_ID, lazy: true });
    const user = userEvent.setup();

    const trigger = await triggerShowing('Lead Qualified');
    expect(crmService.getAvailableTransitions).not.toHaveBeenCalled();
    expect(trigger).toBeEnabled();

    await user.click(trigger);

    expect(await screen.findByText('No further status changes.', {}, SETTLE)).toBeInTheDocument();
  });

  it('refetches the moves when the record moves to a new status', async () => {
    mockLead([QUALIFIED, UNQUALIFIED]);
    const { rerenderWith } = renderDropdown();
    await waitFor(() => expect(crmService.getAvailableTransitions).toHaveBeenCalledTimes(1), SETTLE);

    vi.mocked(crmService.getAvailableTransitions).mockResolvedValue([]);
    rerenderWith({ value: QUALIFIED_ID });

    // Same record, new status: a stale list for the old status must not be reused.
    await waitFor(() => expect(crmService.getAvailableTransitions).toHaveBeenCalledTimes(2), SETTLE);
    await waitFor(
      () => expect(screen.getByText('Lead Qualified').closest('button')).toBeDisabled(),
      SETTLE,
    );
  });

  it('keeps the approval gate: only the always-allowed exit stays selectable while gated', async () => {
    mockLead([QUALIFIED, UNQUALIFIED]);
    const { onChange } = renderDropdown({ gated: true });
    const user = userEvent.setup();

    await user.click(await triggerShowing('New'));
    await screen.findByText('Lead Qualified', {}, SETTLE);

    const qualified = screen.getByRole('option', { name: 'Lead Qualified' });
    expect(qualified).toHaveAttribute('aria-disabled', 'true');
    expect(screen.getByRole('option', { name: 'Lead Unqualified' })).toHaveAttribute('aria-disabled', 'false');

    await user.click(qualified);
    expect(onChange).not.toHaveBeenCalled();
  });
});
