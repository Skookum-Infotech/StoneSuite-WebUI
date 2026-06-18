import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Building2 } from "lucide-react";
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
  TransactionsContent,
} from "@/components/crm/CrmSubTabsPanel";
import { useBreadcrumbStore } from "@/store/useBreadcrumbStore";
import { CrmPageHeader } from "@/pages/crm/components/CrmPageHeader";
import { readonlyCls, fieldLabelCls, resolveStatusColor } from "@/components/crm/formUtils";
import { cn } from "@/lib/utils";
import type { StatusInfo } from "@/types/tenant";

const TABS = [
  { key: "overview", label: "Overview" },
  { key: "transactions", label: "Transactions" },
  { key: "files", label: "Files" },
  { key: "audit", label: "Audit" },
] as const;

type Tab = (typeof TABS)[number]["key"];

export default function CustomerDetailPage() {
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
    queryFn: () => crmService.getRecord(id, "customer"),
    enabled: Boolean(id),
  });

  const { data: statusData } = useQuery({
    queryKey: ["crm-statuses-workflow", "customer"],
    queryFn: () => crmService.getWorkflowStatuses("customer"),
  });

  const { data: users = [] } = useQuery({
    queryKey: ["workspace-users"],
    queryFn: userService.listUsers,
  });

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
        <Spinner label="Loading customer…" />
      </div>
    );
  if (error || !record)
    return (
      <div className="p-6">
        <ErrorNote>
          {apiErrorMessage(error, "Failed to load customer.")}
        </ErrorNote>
      </div>
    );

  const statusInfo = statusMap.get(record.currentStateId);
  const cf = record.coreFields;
  const company = String(cf.customer_name ?? "(unnamed)");

  return (
    <div className="flex flex-col flex-1 min-h-0 bg-stone-50">
      <CrmPageHeader
        backLabel="Customers"
        onBack={() => navigate("/crm/customer")}
        icon={Building2}
        iconBg="bg-emerald-100"
        iconColor="text-emerald-600"
        title={company}
        subtitle="Customer"
        recordNumber={record.recordNumber}
        statusBadge={statusInfo && <Badge color={resolveStatusColor(statusInfo.stateKey, statusInfo.color)}>{statusInfo.statusLabel}</Badge>}
      />

      {/* Tab bar */}
      <div className="flex shrink-0 border-b border-stone-200 bg-white px-5">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key)}
            className={cn(
              "px-4 py-3 text-sm font-semibold border-b-2 -mb-px transition-colors duration-150",
              activeTab === tab.key
                ? "border-brand text-stone-950"
                : "border-transparent text-stone-500 hover:text-stone-700 hover:border-stone-200",
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
              <CrmRecordDetail coreFields={cf} showCustomerBalances users={users} />
              {Object.keys(record.customFields).length > 0 && (
                <ModernSection title="Custom Fields" defaultCollapsed>
                  <div className="grid grid-cols-1 gap-x-5 gap-y-4 sm:grid-cols-2 lg:grid-cols-4">
                    {Object.entries(record.customFields).map(([key, value]) => (
                      <div key={key} className="space-y-1.5">
                        <label className={fieldLabelCls}>{key}</label>
                        <div className={readonlyCls}>
                          {String(value ?? "") || (
                            <span className="text-stone-400">—</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </ModernSection>
              )}
            </>
          )}

          {activeTab === "transactions" && <TransactionsContent />}

          {activeTab === "files" && (
            <FilesContent ref={null} recordId={id} readOnly={true} />
          )}

          {activeTab === "audit" && (
            <AuditContent recordId={id} workflowKey="customer" />
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
            onEdit={() => navigate(`/crm/customer/${id}/edit`)}
            onUploadFile={() => navigate(`/crm/customer/${id}/edit`, { state: { initialTab: "files" } })}
            deleteSlot={(
              <DeleteRecordDialog
                recordId={id}
                workflowKey="customer"
                label={`Customer — ${company}`}
                onDeleted={() => {
                  queryClient.invalidateQueries({ queryKey: ["crm-records", "customer"] });
                  navigate("/crm/customer");
                }}
              />
            )}
          />
        </div>
      </div>
    </div>
  );
}
