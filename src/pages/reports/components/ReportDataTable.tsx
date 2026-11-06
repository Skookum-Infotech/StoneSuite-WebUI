import { cn } from "@/lib/utils";

export interface ReportColumn<Row> {
  key: string;
  label: string;
  align?: "left" | "right";
  render: (row: Row) => string;
}

interface ReportDataTableProps<Row> {
  caption: string;
  columns: ReportColumn<Row>[];
  rows: Row[];
  getRowKey: (row: Row) => string;
  /** Opens the drill-down for a row; omit for a read-only table. */
  onRowClick?: (row: Row) => void;
}

const EMPTY_TEXT = "No records in this period.";

export function ReportDataTable<Row>({ caption, columns, rows, getRowKey, onRowClick }: ReportDataTableProps<Row>) {
  if (rows.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-stone-200 py-10 text-center text-sm text-stone-500">
        {EMPTY_TEXT}
      </p>
    );
  }
  return (
    <div className="overflow-x-auto rounded-xl border border-stone-200 bg-white">
      <table className="w-full text-sm">
        <caption className="sr-only">{caption}</caption>
        <thead className="bg-stone-50 text-label text-stone-500">
          <tr>
            {columns.map((c) => (
              <th
                key={c.key}
                scope="col"
                className={cn("px-3 py-2 font-medium", c.align === "right" ? "text-right" : "text-left")}
              >
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-stone-100">
          {rows.map((row) => (
            <tr
              key={getRowKey(row)}
              className={cn(onRowClick && "cursor-pointer hover:bg-stone-50 focus-within:bg-stone-50")}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
            >
              {columns.map((c, i) => {
                const text = c.render(row);
                return (
                  <td
                    key={c.key}
                    className={cn("px-3 py-2 text-stone-700", c.align === "right" ? "text-right tabular-nums" : "text-left")}
                  >
                    {i === 0 && onRowClick ? (
                      <button
                        type="button"
                        aria-label={`Show records for ${text}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          onRowClick(row);
                        }}
                        className="text-left font-medium text-stone-900 underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-400"
                      >
                        {text}
                      </button>
                    ) : (
                      text
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
