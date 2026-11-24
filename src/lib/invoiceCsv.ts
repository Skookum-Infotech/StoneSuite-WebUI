import { fmtCsvDate } from '@/lib/csvExport';
import type { InvoiceSummary } from '@/types/invoice';

/** Column headers of the invoice list's CSV, in order. */
export const INVOICE_CSV_HEADERS = ['Invoice #', 'Customer', 'Status', 'Invoice Date', 'Amount', 'Balance Due'];

/** One invoice as a CSV row matching INVOICE_CSV_HEADERS. */
export function invoiceCsvRow(inv: InvoiceSummary): string[] {
  return [
    inv.invoiceNumber ?? '',
    inv.customer?.name ?? '',
    inv.status ?? '',
    fmtCsvDate(inv.invoiceDate),
    String(inv.grandTotal ?? 0),
    String(inv.balanceDue ?? 0),
  ];
}
