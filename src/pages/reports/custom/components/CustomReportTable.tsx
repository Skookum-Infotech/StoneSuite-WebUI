import { formatCell } from "@/lib/customReportDefinition";
import { buildTotalsRow } from "@/lib/customReportTable";
import { cn } from "@/lib/utils";
import type { CustomReportResult } from "@/types/customReports";

interface CustomReportTableProps {
  result: CustomReportResult;
}

const NUMERIC_TYPES = ["number", "money"];

/** The result rows with a totals row underneath; numbers align right. */
export function CustomReportTable({ result }: CustomReportTableProps) {
  const totals = buildTotalsRow(result);
  const align = (i: number) => (NUMERIC_TYPES.includes(result.columns[i].type) ? "text-right tabular-nums" : "text-left");
  return (
    <div className="overflow-x-auto rounded-xl border border-stone-200 bg-white">
      <table aria-label="Custom report results" className="w-full type-cell">
        <thead className="bg-stone-50 text-label text-ink-muted">
          <tr>
            {result.columns.map((c, i) => (
              <th key={c.key} scope="col" className={cn("px-3 py-2 type-th", align(i))}>
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-stone-100">
          {result.rows.map((row, r) => (
            <tr key={r}>
              {row.map((cell, i) => (
                <td key={result.columns[i].key} className={cn("px-3 py-2 text-ink", align(i))}>
                  {formatCell(cell, result.columns[i].type)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
        {totals && (
          <tfoot className="border-t border-stone-200 bg-stone-50 font-semibold text-ink-strong">
            <tr>
              {totals.map((cell, i) => (
                <td key={result.columns[i].key} className={cn("px-3 py-2", align(i))}>
                  {cell}
                </td>
              ))}
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
}
