import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Users } from "lucide-react";
import { crmService } from "@/services/crmService";
import { userService } from "@/services/tenantServices";
import { apiErrorMessage } from "@/api/tenantClient";
import { Spinner, ErrorNote, Badge } from "@/components/tenant/ui";
import { DeleteRecordDialog } from "@/components/crm/DeleteRecordDialog";
import { CrmRecordDetail } from "@/components/crm/CrmRecordDetail";
import { CrmDetailSidebar } from "@/components/crm/CrmDetailSidebar";
import { ModernSection } from "@/components/crm/FormPrimitives";
import {
  AuditContent,
  FilesContent,
} from "@/components/crm/CrmSubTabsPanel";
import { useBreadcrumbStore } from "@/store/useBreadcrumbStore";
import { CrmPageHeader } from "@/pages/crm/components/CrmPageHeader";
import { readonlyCls, fieldLabelCls } from "@/components/crm/formUtils";
import { cn } from "@/lib/utils";
import type { StatusInfo } from "@/types/tenant";

const TABS = [
  { key: "overview", label: "Overview" },
  { key: "files", label: "Files" },
  { key: "audit", label: "Audit" },
] as const;

type Tab = (typeof TABS)[number]["key"];

export default function ProspectViewPage() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<Tab>("overview");

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

  return (
    <div className="flex flex-col flex-1 min-h-0 bg-stone-50">
      <CrmPageHeader
        backLabel="Prospects"
        onBack={() => navigate("/crm/prospect")}
        icon={Users}
        iconBg="bg-blue-100"
        iconColor="text-blue-600"
        title={company}
        subtitle="Prospect"
        recordNumber={record.recordNumber}
        statusBadge={statusInfo && <Badge color={statusInfo.color}>{statusInfo.statusLabel}</Badge>}
      />

      {/* Tab bar */}
      <div className="flex shrink-0 border-b border-stone-200 bg-white px-5">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key)}
            className={cn(
              "px-4 py-3 text-sm font-medium border-b-2 -mb-px transition-colors",
              activeTab === tab.key
                ? "border-stone-800 text-stone-900"
                : "border-transparent text-stone-400 hover:text-stone-600 hover:border-stone-300",
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Two-column body — browser scrolls, not an inner div */}
      <div className="flex flex-row gap-6 px-5 py-5">

        {/* Left column — main content */}
        <div className="flex-1 space-y-5 min-w-0">
          {activeTab === "overview" && (
            <>
              <CrmRecordDetail coreFields={cf} users={users} />
              {Object.keys(record.customFields).length > 0 && (
                <ModernSection title="Custom Fields" defaultCollapsed>
                  <div className="grid grid-cols-1 gap-x-5 gap-y-4 sm:grid-cols-2 lg:grid-cols-4">
                    {Object.entries(record.customFields).map(([key, value]) => (
                      <div key={key} className="space-y-1.5">
                        <label className={fieldLabelCls}>{key}</label>
                        <div className={readonlyCls}>
                          {String(value ?? "") || <span className="text-stone-400">—</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                </ModernSection>
              )}
            </>
          )}

          {activeTab === "files" && (
            <FilesContent ref={null} recordId={id} readOnly={true} />
          )}

          {activeTab === "audit" && (
            <AuditContent recordId={id} workflowKey="prospect" />
          )}

          <div className="h-6" />
        </div>

        {/* Right sidebar — sticks below the fixed app header (h-16 = 64px, +8px gap) */}
        <div className="w-72 shrink-0 sticky top-[4.5rem] h-fit self-start">
          <CrmDetailSidebar
            statusInfo={statusInfo}
            ownerUserId={record.ownerUserId}
            users={users}
            createdAt={record.createdAt}
            updatedAt={record.updatedAt}
            onEdit={() => navigate(`/crm/prospect/${id}/edit`)}
            onUploadFile={() => navigate(`/crm/prospect/${id}/edit`, { state: { initialTab: "files" } })}
            deleteSlot={(
              <DeleteRecordDialog
                recordId={id}
                workflowKey="prospect"
                label={`Prospect — ${company}`}
                onDeleted={() => {
                  queryClient.invalidateQueries({ queryKey: ["crm-records", "prospect"] });
                  navigate("/crm/prospect");
                }}
              />
            )}
          />
        </div>
      </div>
    </div>
  );
}
