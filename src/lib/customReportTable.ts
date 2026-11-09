import { describeDefinition, formatCell } from '@/lib/customReportDefinition';
import type { ReportTable } from '@/lib/reportExport';
import {
  CUSTOM_EXPORT_ROW_LIMIT,
  type CatalogSource,
  type CustomReportDefinition,
  type CustomReportResult,
} from '@/types/customReports';

export const TOTAL_LABEL = 'Total';

/** A result's totals formatted for display. The "Total" label goes in the first
 *  column with no total of its own; undefined when no column has a total. */
export function buildTotalsRow(result: CustomReportResult): string[] | undefined {
  const totals = result.totals.map((cell, i) => (cell === null ? '' : formatCell(cell, result.columns[i].type)));
  if (totals.every((cell) => cell === '')) return undefined;
  const labelAt = totals.indexOf('');
  return totals.map((cell, i) => (i === labelAt ? TOTAL_LABEL : cell));
}

/** Flattens a custom report's result into the shape the PDF and CSV exporters
 *  take. */
export function customReportTable(
  name: string,
  def: CustomReportDefinition,
  source: CatalogSource,
  result: CustomReportResult,
): ReportTable {
  const rows = result.rows.map((row) => row.map((cell, i) => formatCell(cell, result.columns[i].type)));
  const totalsRow = buildTotalsRow(result);
  const note = result.truncated ? ` · Only the first ${CUSTOM_EXPORT_ROW_LIMIT.toLocaleString()} rows are included` : '';
  return {
    title: name,
    subtitle: `${describeDefinition(def, source)}${note}`,
    headers: result.columns.map((c) => c.label),
    rows,
    ...(totalsRow ? { totalsRow } : {}),
  };
}
