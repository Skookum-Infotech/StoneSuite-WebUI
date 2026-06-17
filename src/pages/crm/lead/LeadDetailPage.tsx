import { useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Sparkles, Pencil } from "lucide-react";
import { crmService } from "@/services/crmService";
import { userService } from "@/services/tenantServices";
import { apiErrorMessage } from "@/api/tenantClient";
import { Spinner, ErrorNote, Badge } from "@/components/tenant/ui";
import { DeleteRecordDialog } from "@/components/crm/DeleteRecordDialog";
import { CrmRecordDetail } from "@/components/crm/CrmRecordDetail";
import { ModernSection } from "@/components/crm/FormPrimitives";
import { CrmSubTabsPanel } from "@/components/crm/CrmSubTabsPanel";
import { CRM_LEAD_PROSPECT_SUB_TABS } from "@/lib/crmFields";
import { useBreadcrumbStore } from "@/store/useBreadcrumbStore";
import { CrmPageHeader } from "@/pages/crm/components/CrmPageHeader";
import type { StatusInfo } from "@/types/tenant";

export default function LeadDetailPage() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const {
    data: record,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["crm-record", id],
    queryFn: () => crmService.getRecord(id, "lead"),
    enabled: Boolean(id),
  });

  const { data: statusData } = useQuery({
    queryKey: ["crm-statuses-workflow", "lead"],
    queryFn: () => crmService.getWorkflowStatuses("lead"),
  });

  const { data: users = [] } = useQuery({ queryKey: ['workspace-users'], queryFn: userService.listUsers });

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
    return (
      <div className="p-6">
        <Spinner label="Loading lead…" />
      </div>
    );
  if (error || !record)
    return (
      <div className="p-6">
        <ErrorNote>{apiErrorMessage(error, "Failed to load lead.")}</ErrorNote>
      </div>
    );

  const statusInfo = statusMap.get(record.currentStateId);
  const cf = record.coreFields;
  const nameParts = [cf.customer_authorized_person_fname, cf.customer_authorized_person_lname].filter(Boolean).join(' ');
  const company = String((cf.customer_name ?? nameParts) || '(unnamed)');

  return (
    <div className="flex flex-col flex-1 min-h-0 bg-stone-50">
      <CrmPageHeader
        backLabel="Leads"
        onBack={() => navigate("/crm/lead")}
        icon={Sparkles}
        iconBg="bg-purple-100"
        iconColor="text-purple-600"
        title={company}
        subtitle="Lead"
        recordNumber={record.recordNumber}
        statusBadge={statusInfo && <Badge color={statusInfo.color}>{statusInfo.statusLabel}</Badge>}
        deleteSlot={(
          <DeleteRecordDialog
            recordId={id}
            workflowKey="lead"
            label={`Lead — ${company}`}
            onDeleted={() => {
              queryClient.invalidateQueries({ queryKey: ["crm-records", "lead"] });
              navigate("/crm/lead");
            }}
          />
        )}
        actions={(
          <button
            type="button"
            onClick={() => navigate(`/crm/lead/${id}/edit`)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-3.5 py-1.5 text-xs font-semibold text-stone-900 hover:bg-brand-hover transition-all shadow-sm"
          >
            <Pencil className="size-3" />
            Edit Lead
          </button>
        )}
      />

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto modal-scrollbar">
        <div className="px-5 py-5 space-y-5">
          <CrmRecordDetail coreFields={cf} users={users} />

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

          <CrmSubTabsPanel tabs={CRM_LEAD_PROSPECT_SUB_TABS} recordId={id} workflowKey="lead" />

          <div className="h-6" />
        </div>
      </div>
    </div>
  );
}
