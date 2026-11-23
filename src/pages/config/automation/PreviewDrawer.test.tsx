import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { makeArDunning } from '@/test/automationFixtures';

vi.mock('@/services/automationRuleService', () => ({
  automationRuleService: { preview: vi.fn() },
}));

import { PreviewDrawer } from './PreviewDrawer';
import { automationRuleService } from '@/services/automationRuleService';

function renderDrawer(): void {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <PreviewDrawer rule={makeArDunning()} onClose={vi.fn()} />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('PreviewDrawer', () => {
  it('shows counts, recipients with invoice links, and the footer', async () => {
    vi.mocked(automationRuleService.preview).mockResolvedValue({
      counts: { planned: 2, existing: 1, no_email: 3, stale: 0 },
      recipients: [
        {
          email: 'a@example.com',
          items: [
            { invoiceUuid: 'uuid-1', number: 'INV-000123', email: 'a@example.com', stage: 0, anchor: '', runAt: '', status: 'planned', reason: '' },
          ],
        },
      ],
    });
    renderDrawer();
    expect(await screen.findByText('a@example.com')).toBeInTheDocument();
    expect(screen.getByText('Planned')).toBeInTheDocument();
    expect(screen.getByText('Already handled')).toBeInTheDocument();
    expect(screen.getByText('Skipped: No email address on file')).toBeInTheDocument();
    expect(screen.queryByText(/Too old to send/)).toBeNull();
    expect(screen.getByRole('link', { name: 'INV-000123' })).toHaveAttribute('href', '/sales/invoice/uuid-1');
    expect(screen.getByText('Preview only. Nothing was sent.')).toBeInTheDocument();
    expect(automationRuleService.preview).toHaveBeenCalledWith('ar_dunning');
  });

  it('says so when nothing would be sent', async () => {
    vi.mocked(automationRuleService.preview).mockResolvedValue({ counts: { planned: 0 }, recipients: [] });
    renderDrawer();
    expect(await screen.findByText('No reminders would be sent right now.')).toBeInTheDocument();
  });

  it('shows the API error', async () => {
    vi.mocked(automationRuleService.preview).mockRejectedValue(new Error('nope'));
    renderDrawer();
    expect(await screen.findByRole('alert')).toBeInTheDocument();
  });
});
