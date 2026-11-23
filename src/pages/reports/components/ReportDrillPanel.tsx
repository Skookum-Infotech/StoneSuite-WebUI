import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { X } from "lucide-react";
import { apiErrorMessage } from "@/api/tenantClient";
import { useModalDialog } from "@/hooks/useModalDialog";
import { formatMoney } from "@/lib/formatMoney";
import { formatReportDate } from "@/lib/reportFormat";
import { reportsService } from "@/services/reportsService";
import type { SalesDrillSelector, SalesReportParams } from "@/types/reports";

interface ReportDrillPanelProps {
  /** Name of the row that was opened (customer, item, period). */
  title: string;
  params: SalesReportParams;
  selector: SalesDrillSelector;
  onClose: () => void;
}

const QUERY_KEY = "report-sales-records";
const LOADING_TEXT = "Loading records…";
const EMPTY_TEXT = "No records behind this row.";

// Right-hand panel listing the orders/invoices behind one report row, each
// linking to the record. Mounted fresh per opened row (useModalDialog's focus
// effect fires once per mount), like the app's other dialogs.
export function ReportDrillPanel({ title, params, selector, onClose }: ReportDrillPanelProps) {
  const contentRef = useModalDialog(onClose);
  const q = useQuery({
    queryKey: [QUERY_KEY, params, selector],
    queryFn: () => reportsService.salesRecords(params, selector),
  });

  return createPortal(
    <div className="fixed inset-0 z-50 flex justify-end bg-stone-900/30" onClick={onClose}>
      <aside
        ref={contentRef}
        role="dialog"
        aria-modal="true"
        aria-label={`Records for ${title}`}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        className="flex h-full w-full max-w-md flex-col bg-white shadow-xl outline-none"
      >
        <header className="flex items-start justify-between gap-3 border-b border-stone-200 px-4 py-3">
          <div className="min-w-0">
            <h2 className="truncate text-sm font-semibold text-stone-900">{title}</h2>
            <p className="text-label text-stone-500">Records behind this row</p>
          </div>
          <button
            type="button"
            aria-label="Close records panel"
            onClick={onClose}
            className="rounded-md p-1 text-stone-500 hover:bg-stone-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-400"
          >
            <X className="size-4" aria-hidden="true" />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto p-4">
          {q.isLoading && <p className="text-sm text-stone-500">{LOADING_TEXT}</p>}
          {q.isError && (
            <p role="alert" className="text-sm text-red-600">
              {apiErrorMessage(q.error, "Could not load the records.")}
            </p>
          )}
          {q.data && q.data.records.length === 0 && <p className="text-sm text-stone-500">{EMPTY_TEXT}</p>}
          {q.data && q.data.records.length > 0 && (
            <ul className="divide-y divide-stone-100">
              {q.data.records.map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-3 py-2">
                  <div className="min-w-0">
                    <Link
                      to={`${q.data.path}/${r.id}`}
                      aria-label={`Open ${r.number || "record"}`}
                      className="text-sm font-medium text-stone-900 underline-offset-2 hover:underline"
                    >
                      {r.number || "(no number)"}
                    </Link>
                    <p className="truncate text-label text-stone-500">
                      {r.customer} · {formatReportDate(r.date)} · {r.status}
                    </p>
                  </div>
                  <span className="shrink-0 text-sm tabular-nums text-stone-700">{formatMoney(r.revenue)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </aside>
    </div>,
    document.body,
  );
}
