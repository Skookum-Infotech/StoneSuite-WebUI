import type { ReactNode } from "react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Download, FileText } from "lucide-react";
import { toast } from "sonner";
import { apiErrorMessage } from "@/api/tenantClient";
import { exportReportCsv, exportReportPdf, type ReportTable } from "@/lib/reportExport";

interface ReportPageShellProps {
  title: string;
  description: string;
  /** Hub the "back" link returns to, e.g. `/reports/sales`. */
  backTo: string;
  /** The loaded report flattened for export; null while loading or on error. */
  exportTable: ReportTable | null;
  children: ReactNode;
}

const EXPORT_BUTTON =
  "inline-flex h-8 items-center gap-1.5 rounded-lg border border-stone-200 bg-white px-3 text-xs font-medium text-stone-700 transition-colors hover:bg-stone-50 disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-400";

/** Common frame for every report page: title, back link, Export PDF / Download
 *  CSV, then the page's filters, KPIs, chart and table as children. */
export function ReportPageShell({ title, description, backTo, exportTable, children }: ReportPageShellProps) {
  const [exporting, setExporting] = useState(false);

  async function handlePdf() {
    if (!exportTable) return;
    setExporting(true);
    try {
      await exportReportPdf(exportTable);
    } catch (err) {
      toast.error(apiErrorMessage(err, "Could not export the PDF."));
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="flex flex-1 flex-col gap-4 p-4 sm:p-6 3xl:p-10 4xl:p-14">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link
            to={backTo}
            aria-label="Back to reports"
            className="inline-flex items-center gap-1 text-label text-stone-500 hover:text-stone-800"
          >
            <ArrowLeft className="size-3.5" aria-hidden="true" />
            Reports
          </Link>
          <h1 className="mt-1 text-xl font-bold tracking-tight text-stone-900">{title}</h1>
          <p className="text-sm text-stone-500">{description}</p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            aria-label={`Export ${title} as PDF`}
            disabled={!exportTable || exporting}
            onClick={handlePdf}
            className={EXPORT_BUTTON}
          >
            <FileText className="size-3.5" aria-hidden="true" />
            Export PDF
          </button>
          <button
            type="button"
            aria-label={`Download ${title} as CSV`}
            disabled={!exportTable}
            onClick={() => exportTable && exportReportCsv(exportTable)}
            className={EXPORT_BUTTON}
          >
            <Download className="size-3.5" aria-hidden="true" />
            Download CSV
          </button>
        </div>
      </div>
      {children}
    </div>
  );
}
