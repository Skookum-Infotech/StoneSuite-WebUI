import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('@/services/documentExtractionService', () => ({ documentExtractionService: { list: vi.fn() } }));

import { PendingDocumentsChip } from './PendingDocumentsChip';
import { documentExtractionService } from '@/services/documentExtractionService';
import type { DocumentExtraction } from '@/types/documentExtraction';

const ex = (id: string, fileName: string, docType = 'sales_order') => ({ id, fileName, docType, status: 'ready' }) as DocumentExtraction;

function renderChip() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <PendingDocumentsChip docType="sales_order" />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => vi.clearAllMocks());

describe('PendingDocumentsChip', () => {
  it('renders nothing when there are no ready extractions', async () => {
    vi.mocked(documentExtractionService.list).mockResolvedValue([]);
    const { container } = renderChip();
    await vi.waitFor(() => expect(documentExtractionService.list).toHaveBeenCalledWith('ready'));
    expect(container).toBeEmptyDOMElement();
  });

  it('shows the count and lists resume links', async () => {
    vi.mocked(documentExtractionService.list).mockResolvedValue([ex('a', 'PO-1.pdf'), ex('b', 'PO-2.pdf'), ex('c', 'bill.pdf', 'vendor_bill')]);
    renderChip();
    const chip = await screen.findByRole('button', { name: 'Pending documents, 2' });
    expect(chip).toHaveTextContent('Pending documents (2)');
    await userEvent.click(chip);
    expect(screen.getByRole('link', { name: /PO-1.pdf/ })).toHaveAttribute('href', '/sales/sales_order/new?fromDocument=a');
    expect(screen.getByRole('link', { name: /PO-2.pdf/ })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /bill\.pdf/ })).not.toBeInTheDocument();
  });
});
