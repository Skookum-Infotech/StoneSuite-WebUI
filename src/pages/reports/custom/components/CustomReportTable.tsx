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
      <table aria-label="Custom report results" className="w-full text-sm">
        <thead className="bg-stone-50 text-label text-stone-500">
          <tr>
            {result.columns.map((c, i) => (
              <th key={c.key} scope="col" className={cn("px-3 py-2 font-medium", align(i))}>
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-stone-100">
          {result.rows.map((row, r) => (
            <tr key={r}>
              {row.map((cell, i) => (
                <td key={result.columns[i].key} className={cn("px-3 py-2 text-stone-700", align(i))}>
                  {formatCell(cell, result.columns[i].type)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
        {totals && (
          <tfoot className="border-t border-stone-200 bg-stone-50 font-semibold text-stone-900">
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
