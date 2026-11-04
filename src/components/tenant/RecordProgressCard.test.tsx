import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RecordProgressCard } from './RecordProgressCard';

vi.mock('@/lib/recordProgressConfig', async () => {
  const { PO_STATUS_CODES } = await import('@/lib/purchaseOrderForm');
  return {
    RECORD_PROGRESS_CONFIG: new Proxy(
      {},
      {
        get: () => ({
          title: 'Purchase order progress',
          catalog: PO_STATUS_CODES,
          fetchAudit: () =>
            Promise.resolve([
              { action: 'create', actorName: 'Akhila', at: '2026-10-29T09:00:00Z', newValue: { status_code: 'DRFT' } },
            ]),
        }),
      },
    ),
  };
});

function renderCard(statusCode: string, statusLabel: string) {
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <RecordProgressCard module="purchaseOrder" recordId="po-1" statusCode={statusCode} statusLabel={statusLabel} />
    </QueryClientProvider>,
  );
}

describe('RecordProgressCard', () => {
  it('lists every step, marks the current one, and shows the step count', () => {
    renderCard('SENT', 'Sent to Vendor');
    expect(screen.getByRole('list', { name: 'Purchase order progress' })).toBeInTheDocument();
    expect(screen.getAllByRole('listitem')).toHaveLength(7);
    expect(screen.getByText('Sent').closest('li')).toHaveAttribute('aria-current', 'step');
    expect(screen.getByText('Step 4 of 7')).toBeInTheDocument();
  });

  it('shows the date a step was reached once the audit trail loads', async () => {
    renderCard('SENT', 'Sent to Vendor');
    const draft = (await screen.findByText('Draft')).closest('li');
    await vi.waitFor(() => expect(draft).toHaveAttribute('title', expect.stringContaining('Akhila')));
  });

  it.each([['CANC', 'Cancelled'], ['VOID', 'Void']])('shows a strip instead of steps for %s', (code, label) => {
    renderCard(code, label);
    expect(screen.queryByRole('list')).not.toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent(`${label}. No further steps apply.`);
  });
});
