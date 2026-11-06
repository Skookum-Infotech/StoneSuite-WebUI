import { Link } from "react-router-dom";
import { ArrowRight, BarChart3 } from "lucide-react";
import { findReportModule } from "@/lib/reportsRegistry";
import type { ReportCardInfo } from "@/types/reports";

const COMING_SOON = "Coming soon";
const UNKNOWN_MODULE = "This report group does not exist.";

function ReportCard({ report }: { report: ReportCardInfo }) {
  const body = (
    <>
      <div className="flex items-start justify-between gap-2">
        <h2 className="text-sm font-semibold text-stone-900">{report.title}</h2>
        {report.path ? (
          <ArrowRight className="size-4 shrink-0 text-stone-400" aria-hidden="true" />
        ) : (
          <span className="shrink-0 rounded-full bg-stone-100 px-2 py-0.5 text-label font-medium text-stone-500">
            {COMING_SOON}
          </span>
        )}
      </div>
      <p className="mt-1 text-sm text-stone-500">{report.description}</p>
    </>
  );

  if (!report.path) {
    return (
      <li
        aria-label={`${report.title} (${COMING_SOON.toLowerCase()})`}
        className="rounded-xl border border-dashed border-stone-200 bg-stone-50/50 p-4"
      >
        {body}
      </li>
    );
  }
  return (
    <li>
      <Link
        to={report.path}
        aria-label={`Open ${report.title}`}
        className="block h-full rounded-xl border border-stone-200 bg-white p-4 transition-colors hover:border-stone-300 hover:bg-stone-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-400"
      >
        {body}
      </Link>
    </li>
  );
}

/** One module's report hub: a card per report, built ones first. Driven
 *  entirely by `REPORT_MODULES`, so a new report needs no change here. */
export default function ReportsHubPage({ slug }: { slug: string }) {
  const info = findReportModule(slug);

  if (!info) {
    return <p className="p-6 text-sm text-stone-500">{UNKNOWN_MODULE}</p>;
  }

  const built = info.reports.filter((r) => r.path);
  const planned = info.reports.filter((r) => !r.path);

  return (
    <div className="flex flex-1 flex-col gap-5 p-4 sm:p-6 3xl:p-10 4xl:p-14">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent ring-1 ring-accent-foreground/10">
          <BarChart3 className="size-5 text-accent-foreground" aria-hidden="true" />
        </div>
        <div>
          <h1 className="text-xl font-bold tracking-tight text-stone-900">{info.label} Reports</h1>
          <p className="text-sm text-stone-500">{info.description}</p>
        </div>
      </div>
      <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {[...built, ...planned].map((r) => (
          <ReportCard key={r.id} report={r} />
        ))}
      </ul>
    </div>
  );
}
