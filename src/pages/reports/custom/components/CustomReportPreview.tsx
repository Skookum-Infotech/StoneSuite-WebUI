import { useMemo } from "react";
import type { UseQueryResult } from "@tanstack/react-query";
import { apiErrorMessage } from "@/api/tenantClient";
import { CUSTOM_PREVIEW_ROW_LIMIT, type CustomReportDefinition, type CustomReportResult } from "@/types/customReports";
import { ReportTopBarChart } from "../../components/ReportTopBarChart";
import type { ChartDatum } from "../../components/reportChartTheme";
import { CustomReportTable } from "./CustomReportTable";

interface CustomReportPreviewProps {
  definition: CustomReportDefinition;
  query: UseQueryResult<CustomReportResult>;
  /** False while the report cannot run yet (no column, no total). */
  runnable: boolean;
}

const RUN_ERROR_FALLBACK = "Could not run the report.";

function chartData(result: CustomReportResult): ChartDatum[] {
  return result.rows.map((row) => ({ label: String(row[0] ?? ""), revenue: Number(row[1] ?? 0), margin: 0 }));
}

/** The right column of the builder: a bar chart (when asked for), the result
 *  table with its totals row, and the notes that explain what is being shown. */
export function CustomReportPreview({ definition, query, runnable }: CustomReportPreviewProps) {
  const result = query.data;
  const data = useMemo(() => (result ? chartData(result) : []), [result]);

  if (!runnable) {
    const hint = definition.groupBy ? "Add a total to see the report." : "Pick at least one column to see the report.";
    return <p className="rounded-xl border border-dashed border-stone-200 py-10 text-center text-sm text-stone-500">{hint}</p>;
  }
  if (query.error) {
    return (
      <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
        {apiErrorMessage(query.error, RUN_ERROR_FALLBACK)}
      </p>
    );
  }
  if (!result) {
    return (
      <p role="status" className="py-10 text-center text-sm text-stone-500">
        Running report…
      </p>
    );
  }

  const first = result.columns[1];
  const rowCount = result.rows.length;
  return (
    <div className="flex flex-col gap-3" aria-busy={query.isFetching}>
      {/* Stays mounted while results refresh, so a screen reader hears each update. */}
      <p role="status" className="sr-only">
        {`Report updated: ${rowCount === 1 ? "1 row" : `${rowCount} rows`}.`}
      </p>
      {definition.chart === "bar" && first && data.length > 0 && (
        <ReportTopBarChart
          data={data}
          label={`${first.label} by ${result.columns[0].label}`}
          names={{ primary: first.label }}
          valueFormat={first.type === "money" ? "money" : "number"}
        />
      )}
      {result.rows.length === 0 ? (
        <p className="rounded-xl border border-dashed border-stone-200 py-10 text-center text-sm text-stone-500">
          No rows match this report.
        </p>
      ) : (
        <CustomReportTable result={result} />
      )}
      {result.truncated && (
        <p className="text-xs text-stone-500">
          Showing the first {CUSTOM_PREVIEW_ROW_LIMIT} rows. Add a filter or a top N to narrow the report; the totals row still covers every
          matching row.
        </p>
      )}
    </div>
  );
}
