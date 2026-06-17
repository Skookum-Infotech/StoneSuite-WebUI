import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Users, Pencil, ArrowLeft } from "lucide-react";
import { crmService } from "@/services/crmService";
import { userService } from "@/services/tenantServices";
import { apiErrorMessage } from "@/api/tenantClient";
import { Spinner, ErrorNote, Badge } from "@/components/tenant/ui";
import { DeleteRecordDialog } from "@/components/crm/DeleteRecordDialog";
import { CrmRecordDetail } from "@/components/crm/CrmRecordDetail";
import { ModernSection } from "@/components/crm/FormPrimitives";
import { CrmSubTabsPanel } from "@/components/crm/CrmSubTabsPanel";
import { CRM_LEAD_PROSPECT_SUB_TABS } from "@/lib/crmFields";
import type { StatusInfo } from "@/types/tenant";

export default function ProspectViewPage() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const {
    data: record,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["crm-record", id],
    queryFn: () => crmService.getRecord(id, "prospect"),
    enabled: Boolean(id),
  });

  const { data: statusData } = useQuery({
    queryKey: ["crm-statuses-workflow", "prospect"],
    queryFn: () => crmService.getWorkflowStatuses("prospect"),
  });

  const { data: users = [] } = useQuery({ queryKey: ['workspace-users'], queryFn: userService.listUsers });

  const statusMap = new Map<string, StatusInfo>(
    (statusData?.statuses ?? []).map((s) => [s.stateId, s]),
  );

  if (isLoading)
    return (
      <div className="p-6">
        <Spinner label="Loading prospect…" />
      </div>
    );
  if (error || !record)
    return (
      <div className="p-6">
        <ErrorNote>{apiErrorMessage(error, "Failed to load prospect.")}</ErrorNote>
      </div>
    );

  const statusInfo = statusMap.get(record.currentStateId);
  const cf = record.coreFields;
  const company = String(cf.customer_name ?? "(unnamed)");
  const owner = users.find((u) => u.id === record.ownerUserId);

  return (
    <div className="flex flex-1 min-h-0 bg-stone-50">
      {/* ── Left: scrollable content ── */}
      <div className="flex flex-col flex-1 min-h-0 min-w-0">
        {/* Page title */}
        <div className="shrink-0 bg-white border-b border-stone-100 px-6 py-3.5 flex items-center gap-3">

          <button
            type="button"
            onClick={() => navigate("/prospects")}
            className="text-2xs text-stone-400 hover:text-stone-600 transition-colors"
          >
            <ArrowLeft className="size-5" />
          </button>

          <div className="h-8 w-8 rounded-lg bg-blue-100 flex items-center justify-center shrink-0">
            <Users className="h-4 w-4 text-blue-600" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-sm font-semibold text-stone-800 leading-tight truncate">
                {company}
              </h1>
              {record.recordNumber && (
                <span className="rounded border border-stone-200 bg-stone-50 px-1.5 py-0.5 font-mono text-2xs text-stone-400">
                  {record.recordNumber}
                </span>
              )}
              {statusInfo && (
                <Badge color={statusInfo.color}>{statusInfo.statusLabel}</Badge>
              )}
            </div>
            <p className="text-2xs text-stone-400 mt-0.5">
              Created {new Date(record.createdAt).toLocaleDateString()} ·
              Updated {new Date(record.updatedAt).toLocaleDateString()}
            </p>
          </div>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto modal-scrollbar px-6 py-5 space-y-4">
          <CrmRecordDetail coreFields={cf} />

          {Object.keys(record.customFields).length > 0 && (
            <ModernSection title="Custom Fields">
              <div className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
                {Object.entries(record.customFields).map(([key, value]) => (
                  <div key={key} className="flex flex-col gap-0.5">
                    <span className="text-2xs font-medium uppercase tracking-wide text-stone-400 leading-none">
                      {key}
                    </span>
                    <span className="text-sm font-medium text-stone-800 leading-snug break-words">
                      {String(value ?? "") || <span className="text-stone-300 font-normal text-xs">—</span>}
                    </span>
                  </div>
                ))}
              </div>
            </ModernSection>
          )}

          {/* Sub-tabs: Audit, Files */}
          <CrmSubTabsPanel tabs={CRM_LEAD_PROSPECT_SUB_TABS} recordId={id} workflowKey="prospect" />

          <div className="h-4" />
        </div>
      </div>

      {/* ── Right: actions + history panel ── */}
      <div className="w-60 xl:w-64 shrink-0 border-l border-stone-200 bg-white flex flex-col overflow-y-auto modal-scrollbar">
        {/* Primary actions */}
        <div className="p-4 border-b border-stone-100 space-y-2">
          <button
            type="button"
            onClick={() => navigate(`/prospects/${id}/edit`)}
            className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-stone-800 px-4 py-2.5 text-xs font-semibold text-white hover:bg-stone-700 transition-all duration-150 shadow-sm"
          >
            <Pencil className="size-3.5" />
            Edit Prospect
          </button>
        </div>

        {/* Record actions */}
        <div className="p-4 border-b border-stone-100">
          <p className="text-2xs font-semibold uppercase tracking-wider text-stone-400 mb-2.5">
            Record Actions
          </p>
          <div className="space-y-1.5">
            <div className="[&>button]:w-full [&>button]:justify-start [&>button]:rounded-lg [&>button]:text-xs">
              <DeleteRecordDialog
                recordId={id}
                workflowKey="prospect"
                label={`Prospect — ${company}`}
                onDeleted={() => {
                  queryClient.invalidateQueries({
                    queryKey: ["crm-records", "prospect"],
                  });
                  navigate("/prospects");
                }}
              />
            </div>
          </div>
        </div>

        {/* Status & Owner */}
        <div className="px-4 py-3 border-b border-stone-100 space-y-3">
          {statusInfo && (
            <div>
              <p className="text-2xs font-semibold uppercase tracking-wider text-stone-400 mb-2">
                Current Status
              </p>
              <div className="flex items-center gap-2">
                <span
                  className="h-2 w-2 rounded-full shrink-0"
                  style={{ backgroundColor: statusInfo.color || "#a8a29e" }}
                />
                <span className="text-xs font-medium text-stone-700">
                  {statusInfo.statusLabel}
                </span>
              </div>
            </div>
          )}
          <div>
            <p className="text-2xs font-semibold uppercase tracking-wider text-stone-400 mb-2">Owner</p>
            <p className="text-xs font-medium text-stone-700">
              {owner ? (owner.fullName || owner.email) : <span className="text-stone-300 italic">Unassigned</span>}
            </p>
          </div>
        </div>

        {/* Activity feed */}
        <div className="p-4 flex-1">
          <p className="text-2xs text-stone-400 italic">History coming soon.</p>
        </div>
      </div>
    </div>
  );
}
