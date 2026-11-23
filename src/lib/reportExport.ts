import { buildCsvText, downloadCsv } from '@/lib/csvExport';

/** A report flattened to plain strings — the one shape both exports consume,
 *  so the CSV and the PDF can never disagree with each other. */
export interface ReportTable {
  /** Report title, e.g. "Sales by Customer". Also names the files. */
  title: string;
  /** One-line description of the window/basis, shown under the PDF title. */
  subtitle: string;
  headers: string[];
  rows: string[][];
  /** Optional totals row, appended to both exports. */
  totalsRow?: string[];
}

/** "sales-by-customer-2026-11-06" — a date-stamped, filesystem-safe base name. */
export function buildReportFilename(title: string, now: Date = new Date()): string {
  const safe = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return `${safe}-${now.toISOString().slice(0, 10)}`;
}

/** CSV text for a report: header row, data rows, then the totals row if any. */
export function buildReportCsv(table: ReportTable): string {
  const rows = table.totalsRow ? [...table.rows, table.totalsRow] : table.rows;
  return buildCsvText(table.headers, rows);
}

export function exportReportCsv(table: ReportTable): void {
  downloadCsv(`${buildReportFilename(table.title)}.csv`, buildReportCsv(table));
}

/** Lazy-loads the PDF exporter so jsPDF stays out of the main bundle. */
export async function exportReportPdf(table: ReportTable): Promise<void> {
  const { exportReportTablePdf } = await import('@/lib/reportsPdfExport');
  await exportReportTablePdf(table, buildReportFilename(table.title));
}
