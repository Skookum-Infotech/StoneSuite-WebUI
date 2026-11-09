import { Link, useLocation, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { apiErrorMessage } from "@/api/tenantClient";
import { customReportsService } from "@/services/customReportsService";
import type { CustomReportInterpretation } from "@/types/customReports";
import { initBuilder } from "./builderInit";
import { CustomReportEditor } from "./CustomReportEditor";

const LOAD_ERROR_FALLBACK = "Could not open the report.";

const NO_ACCESS_TEXT = "You no longer have access to the data this report is built on, so it cannot be opened.";
const NO_SOURCES_TEXT = "No report sources are available for your role. Ask an administrator to give you a Reports permission.";

function Message({ children, tone = "info" }: { children: string; tone?: "info" | "error" }) {
  return (
    <div className="flex flex-1 flex-col gap-3 p-4 sm:p-6">
      <Link to="/reports/custom" aria-label="Back to custom reports" className="text-label text-stone-500 hover:text-stone-800">
        Custom Reports
      </Link>
      <p
        role={tone === "error" ? "alert" : "status"}
        className="rounded-xl border border-stone-200 bg-white px-4 py-6 text-center text-sm text-stone-600"
      >
        {children}
      </p>
    </div>
  );
}

/** /reports/custom/new and /reports/custom/:id — loads what the builder needs
 *  (the caller's catalog and, for a saved report, the report), then hands over
 *  to the editor. A new report may arrive with the assistant's interpretation
 *  in the navigation state. */
export default function CustomReportBuilderPage() {
  const { id } = useParams();
  const location = useLocation();
  const interpretation = (location.state as { interpretation?: CustomReportInterpretation } | null)?.interpretation;

  const catalogQ = useQuery({ queryKey: ["custom-report-catalog"], queryFn: customReportsService.catalog });
  const reportQ = useQuery({
    queryKey: ["custom-report", id],
    queryFn: () => customReportsService.get(id as string),
    enabled: Boolean(id),
  });

  const error = catalogQ.error ?? reportQ.error;
  if (error) return <Message tone="error">{apiErrorMessage(error, LOAD_ERROR_FALLBACK)}</Message>;
  if (catalogQ.isLoading || (id && reportQ.isLoading) || !catalogQ.data) return <Message>Opening report…</Message>;

  const init = initBuilder(catalogQ.data, reportQ.data, interpretation);
  if (init.kind === "no-access") return <Message>{NO_ACCESS_TEXT}</Message>;
  if (init.kind === "no-sources") return <Message>{NO_SOURCES_TEXT}</Message>;
  // Keyed on the saved version so the editor starts fresh after a save.
  return <CustomReportEditor key={`${id ?? "new"}:${reportQ.data?.updatedAt ?? ""}`} init={init} catalog={catalogQ.data} report={reportQ.data} />;
}
