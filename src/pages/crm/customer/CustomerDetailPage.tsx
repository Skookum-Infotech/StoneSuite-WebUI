import { useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Building2, Pencil, ChevronLeft } from "lucide-react";
import { crmService } from "@/services/crmService";
import { userService } from "@/services/tenantServices";
import { apiErrorMessage } from "@/api/tenantClient";
import { Spinner, ErrorNote, Badge } from "@/components/tenant/ui";
import { DeleteRecordDialog } from "@/components/crm/DeleteRecordDialog";
import { CrmRecordDetail } from "@/components/crm/CrmRecordDetail";
import { ModernSection } from "@/components/crm/FormPrimitives";
import { CrmSubTabsPanel } from "@/components/crm/CrmSubTabsPanel";
import { CRM_CUSTOMER_SUB_TABS } from "@/lib/crmFields";
import { useBreadcrumbStore } from "@/store/useBreadcrumbStore";
import type { StatusInfo } from "@/types/tenant";

export default function CustomerDetailPage() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: record, isLoading, error } = useQuery({
    queryKey: ["crm-record", id],
    queryFn: () => crmService.getRecord(id, "customer"),
    enabled: Boolean(id),
  });

  const { data: statusData } = useQuery({
    queryKey: ["crm-statuses-workflow", "customer"],
    queryFn: () => crmService.getWorkflowStatuses("customer"),
  });

  const { data: users = [] } = useQuery({ queryKey: ["workspace-users"], queryFn: userService.listUsers });

  const statusMap = new Map<string, StatusInfo>(
    (statusData?.statuses ?? []).map((s) => [s.stateId, s]),
  );

  const setLabel = useBreadcrumbStore((s) => s.setLabel);
  const clearLabel = useBreadcrumbStore((s) => s.clearLabel);
  useEffect(() => {
    if (record?.recordNumber) {
      setLabel(id, record.recordNumber);
      return () => clearLabel(id);
    }
  }, [id, record?.recordNumber, setLabel, clearLabel]);

  if (isLoading)
    return <div className="p-6"><Spinner label="Loading customer…" /></div>;
  if (error || !record)
    return <div className="p-6"><ErrorNote>{apiErrorMessage(error, "Failed to load customer.")}</ErrorNote></div>;

  const statusInfo = statusMap.get(record.currentStateId);
  const cf = record.coreFields;
  const company = String(cf.customer_name ?? "(unnamed)");

  return (
    <div className="flex flex-col flex-1 min-h-0 bg-stone-50">
      {/* Sticky top bar */}
      <div className="shrink-0 bg-white border-b border-stone-100 px-4 py-2.5 flex items-center gap-3">
        <button
          type="button"
          onClick={() => navigate("/crm/customer")}
          className="flex items-center gap-1 text-xs text-stone-400 hover:text-stone-600 transition-colors px-1.5 py-1 rounded-md hover:bg-stone-100 shrink-0"
          aria-label="Back to customers"
        >
          <ChevronLeft className="size-3.5" />
          Customers
        </button>
        <div className="w-px h-4 bg-stone-200 shrink-0" />
        <div className="h-7 w-7 rounded-md bg-emerald-100 flex items-center justify-center shrink-0">
          <Building2 className="h-3.5 w-3.5 text-emerald-600" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-sm font-semibold text-stone-800 leading-tight truncate">{company}</h1>
            {statusInfo && <Badge color={statusInfo.color}>{statusInfo.statusLabel}</Badge>}
          </div>
          <p className="text-2xs text-stone-400">Customer</p>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto modal-scrollbar px-6 py-5 space-y-4">
          <CrmRecordDetail coreFields={cf} showCustomerBalances />

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

          {/* Sub-tabs: Transactions, Audit, Files */}
          <CrmSubTabsPanel tabs={CRM_CUSTOMER_SUB_TABS} recordId={id} workflowKey="customer" />

          <div className="h-4" />
        </div>
      </div>

      {/* ── Right: actions panel ── */}
      <div className="w-60 xl:w-64 shrink-0 border-l border-stone-200 bg-white flex flex-col overflow-y-auto modal-scrollbar">
        <div className="p-4 border-b border-stone-100 space-y-2">
          <button
            type="button"
            onClick={() => navigate(`/crm/customer/${id}/edit`)}
            className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-stone-800 px-4 py-2.5 text-xs font-semibold text-white hover:bg-stone-700 transition-all duration-150 shadow-sm"
          >
            <Pencil className="size-3.5" />
            Edit Customer
          </button>
        </div>

        <div className="p-4 border-b border-stone-100">
          <p className="text-2xs font-semibold uppercase tracking-wider text-stone-400 mb-2.5">Record Actions</p>
          <div className="[&>button]:w-full [&>button]:justify-start [&>button]:rounded-lg [&>button]:text-xs">
            <DeleteRecordDialog
              recordId={id}
              workflowKey="customer"
              label={`Customer — ${company}`}
              onDeleted={() => {
                queryClient.invalidateQueries({ queryKey: ["crm-records", "customer"] });
                navigate("/crm/customer");
              }}
            />
          </div>
        </div>
        <div className="w-px h-4 bg-stone-200 shrink-0" />
        <button
          type="button"
          onClick={() => navigate(`/crm/customer/${id}/edit`)}
          className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-3.5 py-1.5 text-xs font-semibold text-stone-900 hover:bg-brand-hover transition-all shadow-sm shrink-0"
        >
          <Pencil className="size-3" />
          Edit Customer
        </button>
      </div>

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto modal-scrollbar">
        <div className="px-5 py-5 space-y-5">
          <CrmRecordDetail coreFields={cf} showCustomerBalances users={users} />

          {Object.keys(record.customFields).length > 0 && (
            <ModernSection title="Custom Fields">
              <div className="grid grid-cols-1 gap-x-5 gap-y-4 sm:grid-cols-2 lg:grid-cols-4">
                {Object.entries(record.customFields).map(([key, value]) => (
                  <div key={key} className="space-y-1.5">
                    <label className="block text-xs font-medium text-stone-500 leading-none">{key}</label>
                    <div className="w-full bg-gray-100 rounded-sm px-3.5 py-2.5 text-sm text-stone-800 border-2 border-transparent min-h-[2.25rem]">
                      {String(value ?? "") || <span className="text-stone-400">—</span>}
                    </div>
                  </div>
                ))}
              </div>
            </ModernSection>
          )}

          <CrmSubTabsPanel tabs={CRM_CUSTOMER_SUB_TABS} recordId={id} workflowKey="customer" />

          <div className="h-6" />
        </div>
      </div>
    </div>
  );
}
