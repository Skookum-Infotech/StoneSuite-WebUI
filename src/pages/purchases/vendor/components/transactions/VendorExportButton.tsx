import { useMutation } from '@tanstack/react-query';
import { Download, Loader2 } from 'lucide-react';
import { apiErrorMessage } from '@/api/tenantClient';
import { buildCsvFilename, downloadCsvBlob } from '@/lib/csvExport';
import { isFiltered } from '@/lib/vendorTransactions';
import { vendorTransactionsService } from '@/services/vendorTransactionsService';
import type { VendorTransactionFilters } from '@/types/vendorTransactions';

// buildCsvFilename pluralises its label: "vendor-transaction" → vendor-transactions-<date>.csv.
const FILENAME_LABEL = 'vendor-transaction';

/**
 * Downloads every transaction matching the current filters (all pages, not just
 * the one on screen) as the server-built CSV. A refused export (too many rows,
 * too many exports) shows the server's own message.
 */
export function VendorExportButton({
  vendorId, filters,
}: {
  vendorId: string;
  filters: VendorTransactionFilters;
}) {
  const filtered = isFiltered(filters);
  const exportCsv = useMutation({
    mutationFn: () => vendorTransactionsService.exportCsv(vendorId, filters),
    onSuccess: (csv) => downloadCsvBlob(buildCsvFilename(FILENAME_LABEL), csv),
  });

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={() => exportCsv.mutate()}
        disabled={exportCsv.isPending}
        aria-label={filtered ? 'Export CSV of filtered transactions' : 'Export CSV of all transactions'}
        className="flex items-center gap-1.5 rounded-lg border border-stone-200 bg-white px-2.5 h-8 text-xs font-medium text-stone-600 hover:bg-stone-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {exportCsv.isPending ? <Loader2 className="size-3.5 animate-spin" /> : <Download className="size-3.5" />}
        {exportCsv.isPending ? 'Exporting…' : 'Export CSV'}
      </button>
      {exportCsv.isError && (
        <p role="alert" className="text-xs text-red-500">
          Failed to export CSV: {apiErrorMessage(exportCsv.error)}
        </p>
      )}
    </div>
  );
}
