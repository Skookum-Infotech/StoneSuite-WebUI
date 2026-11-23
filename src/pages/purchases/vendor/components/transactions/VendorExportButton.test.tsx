import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AxiosError } from 'axios';
import type * as CsvExport from '@/lib/csvExport';

vi.mock('@/services/vendorTransactionsService', () => ({
  vendorTransactionsService: { exportCsv: vi.fn() },
}));
vi.mock('@/lib/csvExport', async (importOriginal) => ({
  ...(await importOriginal<typeof CsvExport>()),
  downloadCsvBlob: vi.fn(),
}));

import { VendorExportButton } from './VendorExportButton';
import { vendorTransactionsService } from '@/services/vendorTransactionsService';
import { downloadCsvBlob } from '@/lib/csvExport';
import { EMPTY_FILTERS } from '@/lib/vendorTransactions';
import type { VendorTransactionFilters } from '@/types/vendorTransactions';

const exportCsv = vi.mocked(vendorTransactionsService.exportCsv);
const download = vi.mocked(downloadCsvBlob);

const FILENAME = /^vendor-transactions-\d{4}-\d{2}-\d{2}\.csv$/;

function renderButton(filters: VendorTransactionFilters = EMPTY_FILTERS) {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <VendorExportButton vendorId="v-1" filters={filters} />
    </QueryClientProvider>,
  );
}

function apiError(status: number, message: string): AxiosError {
  return new AxiosError(message, String(status), undefined, undefined, {
    status, data: { message }, statusText: '', headers: {}, config: {} as never,
  });
}

describe('VendorExportButton', () => {
  beforeEach(() => {
    exportCsv.mockReset();
    download.mockReset();
  });

  it('downloads the server CSV under a dated filename', async () => {
    const csv = new Blob(['Number,Amount\r\nBILL-1,10']);
    exportCsv.mockResolvedValue(csv);
    renderButton();
    await userEvent.setup().click(screen.getByRole('button', { name: 'Export CSV of all transactions' }));
    await waitFor(() => expect(download).toHaveBeenCalledTimes(1));
    expect(download).toHaveBeenCalledWith(expect.stringMatching(FILENAME), csv);
    expect(exportCsv).toHaveBeenCalledWith('v-1', EMPTY_FILTERS);
  });

  it('says when it will export only what the filters match', async () => {
    const filters = { ...EMPTY_FILTERS, type: 'vendor_bill', open: true };
    exportCsv.mockResolvedValue(new Blob(['x']));
    renderButton(filters);
    const button = screen.getByRole('button', { name: 'Export CSV of filtered transactions' });
    expect(button).toHaveTextContent(/^Export CSV$/);
    await userEvent.setup().click(button);
    await waitFor(() => expect(exportCsv).toHaveBeenCalledWith('v-1', filters));
  });

  it('is disabled while the export runs, so it cannot be fired twice', async () => {
    exportCsv.mockReturnValue(new Promise(() => {}));
    renderButton();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Export CSV of all transactions' }));
    const busy = await screen.findByRole('button', { name: 'Export CSV of all transactions' });
    expect(busy).toBeDisabled();
    expect(busy).toHaveTextContent('Exporting…');
    await user.click(busy);
    expect(exportCsv).toHaveBeenCalledTimes(1);
  });

  it.each([
    [413, 'Too many transactions to export. Narrow the filters and try again.'],
    [429, 'Too many exports. Please wait a moment and try again.'],
  ])("shows the server's message for a %i and downloads nothing", async (status, message) => {
    exportCsv.mockRejectedValue(apiError(status, message));
    renderButton();
    await userEvent.setup().click(screen.getByRole('button', { name: 'Export CSV of all transactions' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(`Failed to export CSV: ${message}`);
    expect(download).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Export CSV of all transactions' })).toBeEnabled();
  });

  it('can be retried after a failure', async () => {
    exportCsv.mockRejectedValueOnce(new Error('network'));
    renderButton();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Export CSV of all transactions' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('network');

    exportCsv.mockResolvedValue(new Blob(['x']));
    await user.click(screen.getByRole('button', { name: 'Export CSV of all transactions' }));
    await waitFor(() => expect(download).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.queryByRole('alert')).toBeNull());
  });
});
