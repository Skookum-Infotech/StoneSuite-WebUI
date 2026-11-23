import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { SlidersHorizontal } from "lucide-react";
import { apiErrorMessage } from "@/api/tenantClient";
import { useUserPermissions } from "@/hooks/useUserPermissions";
import { customReportsService } from "@/services/customReportsService";
import type { CustomReportInterpretation } from "@/types/customReports";
import { CustomReportList } from "./custom/components/CustomReportList";
import { CustomReportPromptBox } from "./custom/components/CustomReportPromptBox";

const BUILDER_NEW_PATH = "/reports/custom/new";
const LOAD_ERROR_FALLBACK = "Could not load your reports.";

/** Custom Reports home: describe a report in plain English, or open / start one
 *  in the builder. */
export default function CustomReportsPage() {
  const navigate = useNavigate();
  const { hasPermission } = useUserPermissions();
  const list = useQuery({ queryKey: ["custom-reports"], queryFn: customReportsService.list });
  const catalog = useQuery({ queryKey: ["custom-report-catalog"], queryFn: customReportsService.catalog });
  const sourceLabels = useMemo(
    () => Object.fromEntries((catalog.data ?? []).map((s) => [s.key, s.label])),
    [catalog.data],
  );

  function openInterpreted(interpretation: CustomReportInterpretation) {
    navigate(BUILDER_NEW_PATH, { state: { interpretation } });
  }

  return (
    <div className="flex flex-1 flex-col gap-5 p-4 sm:p-6 3xl:p-10 4xl:p-14">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent ring-1 ring-accent-foreground/10">
          <SlidersHorizontal className="size-5 text-accent-foreground" aria-hidden="true" />
        </div>
        <div>
          <h1 className="text-xl font-bold tracking-tight text-stone-900">Custom Reports</h1>
          <p className="text-sm text-stone-500">Build and save your own reports.</p>
        </div>
      </div>
      <CustomReportPromptBox onInterpreted={openInterpreted} />
      {list.error && (
        <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {apiErrorMessage(list.error, LOAD_ERROR_FALLBACK)}
        </p>
      )}
      {list.isLoading && (
        <p role="status" className="py-6 text-center text-sm text-stone-500">
          Loading reports…
        </p>
      )}
      {list.data && (
        <CustomReportList
          reports={list.data}
          sourceLabels={sourceLabels}
          canCreate={hasPermission("custom_report", "create")}
          onOpen={(id) => navigate(`/reports/custom/${id}`)}
          onNew={() => navigate(BUILDER_NEW_PATH)}
        />
      )}
    </div>
  );
}
