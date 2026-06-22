import { Sparkles, Plus } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { LeadTable } from "./components/LeadTable";
import { crmService } from "@/services/crmService";

export default function LeadPage() {
  const navigate = useNavigate();

  const {
    data: records = [],
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["crm-records", "lead"],
    queryFn: () => crmService.listRecords("lead"),
  });

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="p-6 3xl:p-10 4xl:p-14 flex-1 flex flex-col min-h-0">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent ring-1 ring-accent-foreground/10 shrink-0">
              <Sparkles className="size-5 text-accent-foreground" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-stone-900">
                Leads
              </h1>
              <p className="text-sm text-stone-500">
                Track and manage your sales leads pipeline.
              </p>
            </div>
          </div>
          <button
            onClick={() => navigate("/crm/lead/new")}
            className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-brand text-stone-950 py-2 px-4 text-sm font-semibold shadow-sm transition hover:bg-brand-hover active:scale-95 cursor-pointer"
          >
            <Plus className="size-3.5" />
            New Lead
          </button>
        </div>

        <div className="mt-5 border-t border-stone-100 pt-4 flex-1 flex flex-col min-h-0">
          {isError && (
            <p className="text-xs text-red-500 mb-3">
              Failed to load leads. Is the backend running?
            </p>
          )}
          <LeadTable records={records} isLoading={isLoading} />
        </div>
      </div>
    </div>
  );
}
