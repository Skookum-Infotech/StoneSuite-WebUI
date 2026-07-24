const CSV_ESCAPE_PATTERN = /[",\r\n]/;

/** Escapes a single value for CSV — quotes it (doubling embedded quotes) only when needed. */
export function csvEscapeValue(value: unknown): string {
  const str = value === null || value === undefined ? "" : String(value);
  return CSV_ESCAPE_PATTERN.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
}

/** Formats an ISO timestamp as a plain date for spreadsheet columns. */
export function fmtCsvDate(iso: string | undefined): string {
  if (!iso) return "";
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return "";
  return parsed.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

/** Builds CSV text (with header row) from a header list and pre-formatted rows. */
export function buildCsvText(headers: string[], rows: string[][]): string {
  return [headers, ...rows].map((row) => row.map(csvEscapeValue).join(",")).join("\r\n");
}

/** Builds a date-stamped filename for a CSV export, e.g. "sales-orders-2026-07-10.csv". */
export function buildCsvFilename(label: string): string {
  const safeLabel = label.toLowerCase().replace(/[^a-z0-9-_]+/gi, "-");
  const date = new Date().toISOString().slice(0, 10);
  return `${safeLabel}s-${date}.csv`;
}

/** Triggers a browser download of the given CSV text under the given filename. */
export function downloadCsv(filename: string, csvContent: string): void {
  const blob = new Blob(["﻿", csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export interface CsvSearchPage<T> {
  records: T[];
  hasMore: boolean;
  nextCursor: string;
}

/** Pages through every record a `fetchPage` callback returns (same filters/sort
 *  as the on-screen query, just a larger page size), builds CSV text from it,
 *  and triggers the download — the shared "download everything matching the
 *  current filters" flow used by every list-page table's CSV button. */
export async function exportPagedCsv<T>(
  fetchPage: (cursor: string | undefined) => Promise<CsvSearchPage<T>>,
  headers: string[],
  toRow: (record: T) => string[],
  filenameLabel: string,
): Promise<void> {
  const allRecords: T[] = [];
  let cursor: string | undefined;
  do {
    const page = await fetchPage(cursor);
    allRecords.push(...page.records);
    cursor = page.hasMore ? page.nextCursor : undefined;
  } while (cursor);

  downloadCsv(buildCsvFilename(filenameLabel), buildCsvText(headers, allRecords.map(toRow)));
}
