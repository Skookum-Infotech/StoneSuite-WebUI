import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { Anomaly, AnomalyPage } from '@/types/anomaly';

vi.mock('@/services/anomalyService', () => ({
  anomalyService: { list: vi.fn(), review: vi.fn() },
}));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('./components/AnomalyScanSwitch', () => ({ AnomalyScanSwitch: () => null }));

import AnomaliesPage from './AnomaliesPage';
import { anomalyService } from '@/services/anomalyService';
import { toast } from 'sonner';

function anomaly(overrides: Partial<Anomaly> = {}): Anomaly {
  return {
    id: 'a1',
    ruleKey: 'duplicate_vendor_bill',
    severity: 'warning',
    resource: 'vendor_bill',
    title: 'Possible duplicate vendor bill VBIL-000002',
    detail: 'Same vendor, vendor invoice number and total as VBIL-000001.',
    status: 'open',
    note: '',
    detectedAt: '2026-10-27T09:15:30Z',
    ...overrides,
  };
}

function page(items: Anomaly[], nextCursor = ''): AnomalyPage {
  return { items, nextCursor };
}

function renderPage(): void {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <AnomaliesPage />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('AnomaliesPage', () => {
  it('asks for open findings first and shows them', async () => {
    vi.mocked(anomalyService.list).mockResolvedValue(page([anomaly()]));
    renderPage();
    expect(await screen.findByText('Possible duplicate vendor bill VBIL-000002')).toBeInTheDocument();
    expect(anomalyService.list).toHaveBeenCalledWith({ limit: 25, status: 'open' });
    expect(within(screen.getByRole('list', { name: 'Anomalies' })).getByText('Warning')).toBeInTheDocument();
  });

  it('shows an empty message when nothing is open', async () => {
    vi.mocked(anomalyService.list).mockResolvedValue(page([]));
    renderPage();
    expect(await screen.findByText('Nothing needs your attention.')).toBeInTheDocument();
  });

  it('switching tabs refetches with that status, and All drops the status', async () => {
    vi.mocked(anomalyService.list).mockResolvedValue(page([]));
    renderPage();
    await screen.findByText('Nothing needs your attention.');
    await userEvent.click(screen.getByRole('tab', { name: 'Dismissed' }));
    await waitFor(() => expect(anomalyService.list).toHaveBeenLastCalledWith({ limit: 25, status: 'dismissed' }));
    await userEvent.click(screen.getByRole('tab', { name: 'All' }));
    await waitFor(() => expect(anomalyService.list).toHaveBeenLastCalledWith({ limit: 25 }));
  });

  it('dismisses a finding with the note typed, then confirms with a toast', async () => {
    vi.mocked(anomalyService.list).mockResolvedValue(page([anomaly()]));
    vi.mocked(anomalyService.review).mockResolvedValue(anomaly({ status: 'dismissed' }));
    renderPage();
    await userEvent.type(await screen.findByLabelText('Note (optional)'), 'Expected');
    await userEvent.click(screen.getByRole('button', { name: /^Dismiss:/ }));
    await waitFor(() => expect(anomalyService.review).toHaveBeenCalledWith('a1', 'dismissed', 'Expected'));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Marked as dismissed'));
  });

  it('walks forward and back using the server cursor as given', async () => {
    vi.mocked(anomalyService.list)
      .mockResolvedValueOnce(page([anomaly({ id: 'a1' })], 'CURSOR-2'))
      .mockResolvedValueOnce(page([anomaly({ id: 'a2', title: 'Second page finding' })]))
      .mockResolvedValue(page([anomaly({ id: 'a1' })], 'CURSOR-2'));
    renderPage();
    await userEvent.click(await screen.findByRole('button', { name: 'Next page' }));
    expect(await screen.findByText('Second page finding')).toBeInTheDocument();
    expect(anomalyService.list).toHaveBeenCalledWith({ limit: 25, status: 'open', cursor: 'CURSOR-2' });
    await userEvent.click(screen.getByRole('button', { name: 'Previous page' }));
    await waitFor(() => expect(anomalyService.list).toHaveBeenLastCalledWith({ limit: 25, status: 'open' }));
  });

  it('lists criticals first and narrows by severity chip', async () => {
    vi.mocked(anomalyService.list).mockResolvedValue(
      page([
        anomaly({ id: 'w', title: 'Warn one', severity: 'warning', detectedAt: '2026-10-27T10:00:00Z' }),
        anomaly({ id: 'c', title: 'Crit one', severity: 'critical', detectedAt: '2026-10-20T10:00:00Z' }),
      ]),
    );
    renderPage();
    await screen.findByText('Crit one');
    const titles = screen.getAllByRole('listitem').map((li) => li.textContent ?? '');
    expect(titles.findIndex((t) => t.includes('Crit one'))).toBeLessThan(
      titles.findIndex((t) => t.includes('Warn one')),
    );
    await userEvent.click(screen.getByRole('button', { name: 'Warning' }));
    expect(screen.queryByText('Crit one')).not.toBeInTheDocument();
    expect(screen.getByText('Warn one')).toBeInTheDocument();
  });

  it('reports a load failure', async () => {
    vi.mocked(anomalyService.list).mockRejectedValue(new Error('boom'));
    renderPage();
    expect(await screen.findByRole('alert')).toBeInTheDocument();
  });
});
