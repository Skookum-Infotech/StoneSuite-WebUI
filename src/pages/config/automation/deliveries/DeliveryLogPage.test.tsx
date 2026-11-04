import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AxiosError } from 'axios';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { makeArDunning } from '@/test/automationFixtures';
import type { AutomationDelivery } from '@/types/automationDelivery';

vi.mock('@/services/automationDeliveryService', () => ({ automationDeliveryService: { list: vi.fn() } }));
vi.mock('@/services/automationRuleService', () => ({
  automationRuleService: { list: vi.fn(), setEnabled: vi.fn(), preview: vi.fn() },
}));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import DeliveryLogPage from './DeliveryLogPage';
import { automationDeliveryService } from '@/services/automationDeliveryService';
import { automationRuleService } from '@/services/automationRuleService';
import { toast } from 'sonner';

const PAGE_SIZE = 25;
const TOTAL = 30;

function makeDelivery(i: number, overrides: Partial<AutomationDelivery> = {}): AutomationDelivery {
  return {
    id: `id-${i}`,
    ruleKey: 'ar_dunning',
    resource: 'invoice',
    recordId: `${String(i).padStart(8, '0')}-0000-0000-0000-000000000000`,
    stage: 1,
    anchorDate: '2026-11-01',
    recipientEmail: `cust${i}@example.com`,
    status: 'sent',
    reason: null,
    attempts: 1,
    runAt: '2026-11-03T12:00:00Z',
    sentAt: '2026-11-03T12:01:00Z',
    lastError: null,
    createdAt: '2026-11-02T12:00:00Z',
    ...overrides,
  };
}

const many = (from: number, to: number): AutomationDelivery[] =>
  Array.from({ length: to - from }, (_, i) => makeDelivery(from + i));

function httpError(status: number): AxiosError {
  return new AxiosError('x', String(status), undefined, undefined, {
    status,
    data: { message: 'nope' },
  } as AxiosError['response']);
}

function Probe() {
  const loc = useLocation();
  return <output data-testid="loc">{loc.search}</output>;
}

function renderPage(url = '/config/automation/deliveries'): void {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[url]}>
        <DeliveryLogPage />
        <Probe />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const list = vi.mocked(automationDeliveryService.list);

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(automationRuleService.list).mockResolvedValue([makeArDunning({ cadence: [{ offsetDays: -3 }, { offsetDays: 0 }, { offsetDays: 7 }, { offsetDays: 14 }] })]);
  list.mockResolvedValue({ deliveries: [], nextCursor: '' });
});

describe('DeliveryLogPage paging', () => {
  it('shows 25 rows, Load more appends the remaining 5 then hides', async () => {
    list.mockResolvedValueOnce({ deliveries: many(0, PAGE_SIZE), nextCursor: 'cur1' });
    list.mockResolvedValueOnce({ deliveries: many(PAGE_SIZE, TOTAL), nextCursor: '' });
    renderPage();
    await screen.findByText('cust0@example.com');
    expect(screen.getAllByRole('listitem')).toHaveLength(PAGE_SIZE);
    await userEvent.click(screen.getByRole('button', { name: 'Load more' }));
    await waitFor(() => expect(screen.getAllByRole('listitem')).toHaveLength(TOTAL));
    expect(list).toHaveBeenLastCalledWith({ status: undefined, ruleKey: undefined }, 'cur1');
    expect(screen.queryByRole('button', { name: 'Load more' })).toBeNull();
  });

  it('a 400 on a later page resets to the first page with a toast', async () => {
    list.mockResolvedValueOnce({ deliveries: many(0, PAGE_SIZE), nextCursor: 'stale' });
    list.mockRejectedValueOnce(httpError(400));
    list.mockResolvedValueOnce({ deliveries: many(0, 3), nextCursor: '' });
    renderPage();
    await screen.findByText('cust0@example.com');
    await userEvent.click(screen.getByRole('button', { name: 'Load more' }));
    await waitFor(() => expect(toast.error).toHaveBeenCalled());
    await waitFor(() => expect(screen.getAllByRole('listitem')).toHaveLength(3));
  });
});

describe('DeliveryLogPage filters', () => {
  it('?status=failed requests only failed and the select shows Failed', async () => {
    renderPage('/config/automation/deliveries?status=failed');
    await waitFor(() => expect(list).toHaveBeenCalledWith({ status: 'failed', ruleKey: undefined }, undefined));
    expect(screen.getByRole('combobox', { name: 'Status' })).toHaveValue('failed');
  });

  it('changing a filter writes it to the URL and refetches from the start', async () => {
    renderPage();
    await screen.findByText('No automated emails yet.');
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Rule' }), 'ar_dunning');
    expect(screen.getByTestId('loc')).toHaveTextContent('?ruleKey=ar_dunning');
    await waitFor(() => expect(list).toHaveBeenLastCalledWith({ status: undefined, ruleKey: 'ar_dunning' }, undefined));
  });

  it('filtered empty state offers Clear filters', async () => {
    renderPage('/config/automation/deliveries?status=dead');
    await screen.findByText('Nothing matches these filters.');
    await userEvent.click(screen.getByRole('button', { name: 'Clear filters' }));
    expect(screen.getByTestId('loc')).toHaveTextContent('');
    expect(await screen.findByText('No automated emails yet.')).toBeInTheDocument();
  });

  it('ignores an unknown status in the URL', async () => {
    renderPage('/config/automation/deliveries?status=bogus');
    await waitFor(() => expect(list).toHaveBeenCalledWith({ status: undefined, ruleKey: undefined }, undefined));
  });
});

describe('DeliveryLogPage rows', () => {
  it('renders rule name, stage, reason copy, and falls back to a linked short id', async () => {
    list.mockResolvedValueOnce({
      deliveries: [makeDelivery(7, { status: 'skipped', reason: 'kill_switch', sentAt: null })],
      nextCursor: '',
    });
    renderPage();
    expect(await screen.findByText('Paused by workspace switch')).toBeInTheDocument();
    expect(within(screen.getByRole('list', { name: 'Automated emails' })).getByText('Invoice payment reminders')).toBeInTheDocument();
    expect(screen.getByText('Reminder 2 of 4')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '00000007' })).toHaveAttribute(
      'href',
      '/sales/invoice/00000007-0000-0000-0000-000000000000',
    );
  });

  it('uses recordNumber when present and plain text for an unknown resource', async () => {
    list.mockResolvedValueOnce({
      deliveries: [
        makeDelivery(1, { recordNumber: 'INV-1001' }),
        makeDelivery(2, { resource: 'mystery', recordNumber: 'X-9' }),
      ],
      nextCursor: '',
    });
    renderPage();
    expect(await screen.findByRole('link', { name: 'INV-1001' })).toBeInTheDocument();
    expect(screen.getByText('X-9')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'X-9' })).toBeNull();
  });

  it('failed rows expand to show lastError', async () => {
    list.mockResolvedValueOnce({
      deliveries: [makeDelivery(1, { status: 'failed', lastError: 'smtp 550 mailbox unavailable', sentAt: null })],
      nextCursor: '',
    });
    renderPage();
    const toggle = await screen.findByRole('button', { name: /Show error/ });
    expect(screen.queryByText('smtp 550 mailbox unavailable')).toBeNull();
    await userEvent.click(toggle);
    expect(screen.getByText('smtp 550 mailbox unavailable')).toBeInTheDocument();
  });
});

describe('DeliveryLogPage states', () => {
  it('shows an error with Retry', async () => {
    list.mockRejectedValueOnce(httpError(500));
    renderPage();
    await userEvent.click(await screen.findByRole('button', { name: 'Retry loading automated emails' }));
    expect(await screen.findByText('No automated emails yet.')).toBeInTheDocument();
  });

  it('renders Access Denied on a 403', async () => {
    list.mockRejectedValueOnce(httpError(403));
    renderPage();
    expect(await screen.findByText('Access Denied')).toBeInTheDocument();
  });
});
