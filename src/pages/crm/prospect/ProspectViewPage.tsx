import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { Users } from "lucide-react";
import { crmService, CRM_RECORD_TYPE_CODES } from "@/services/crmService";
import { crmAdminService } from "@/services/crmAdminService";
import { userService } from "@/services/tenantServices";
import { lookupService } from "@/services/lookupService";
import { apiErrorMessage } from "@/api/tenantClient";
import { Spinner, ErrorNote, Badge } from "@/components/tenant/ui";
import { DeleteRecordDialog } from "@/components/crm/DeleteRecordDialog";
import { CrmRecordDetail } from "@/components/crm/CrmRecordDetail";
import { CrmDetailSidebar } from "@/components/crm/CrmDetailSidebar";
import { ApprovalCard, type ApprovalStatus } from "@/components/crm/ApprovalCard";
import { ApprovalBanner } from "@/components/crm/ApprovalBanner";
import { ModernSection } from "@/components/crm/FormPrimitives";
import {
  AuditContent,
  FilesContent,
} from "@/components/crm/CrmSubTabsPanel";
import { useBreadcrumbStore } from "@/store/useBreadcrumbStore";
import { CrmPageHeader } from "@/pages/crm/components/CrmPageHeader";
import { readonlyCls, fieldLabelCls, resolveStatusColor } from "@/components/crm/formUtils";
import { cn } from "@/lib/utils";
import { useUserPermissions } from "@/hooks/useUserPermissions";
import { recordApprovalState, type StatusInfo } from "@/types/tenant";

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
  const { hasPermission, isLoading: permissionsLoading } = useUserPermissions();
  const canEdit = permissionsLoading || hasPermission("prospect", "update");

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
    staleTime: 10 * 60 * 1000,
  });

  const { data: users = [] } = useQuery({ queryKey: ['workspace-users'], queryFn: userService.listUsers });

  const { data: crmApprovers = [] } = useQuery({
    queryKey: ["crm-approvers"],
    queryFn: crmAdminService.listApprovers,
    staleTime: 60 * 1000,
  });

  const { data: lookups } = useQuery({
    queryKey: ["crm-lookups"],
    queryFn: lookupService.getCrmLookups,
    staleTime: 10 * 60 * 1000,
  });

  const approve = useMutation({
    mutationFn: () => crmService.approveRecord(id, "prospect"),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["crm-record", id] }),
  });

  const [exportingPdf, setExportingPdf] = useState(false);
  const [exportPdfError, setExportPdfError] = useState<string>();

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

  const currentRecord = record;
  const statusInfo = statusMap.get(record.currentStateId);
  const cf = record.coreFields;
  const company = String(cf.customer_name ?? "(unnamed)");

  // approvalStatus is authoritative from the record itself — the server
  // already accounts for both wildcard and status-specific approvers.
  // approverIds below is only the wildcard chain, used for display alongside
  // any status-specific approvers configured for the record's current status.
  const recordApproval = recordApprovalState(record);
  const approvalStatus: ApprovalStatus = recordApproval === "none" ? "not_required" : recordApproval;
  const canApprove = Boolean(record.canApprove);
  const approverIds = statusData?.workflow.approverUserIds ?? [];
  const wildcardNames = approverIds.map((uid) => users.find((u) => u.id === uid)?.fullName || users.find((u) => u.id === uid)?.email || "Unknown user");
  const statusApproverNames = crmApprovers
    .filter((a) => a.recordTypeCode === CRM_RECORD_TYPE_CODES.prospect && a.crmStatusCode !== "" && a.crmStatusCode === statusInfo?.stateKey)
    .map((a) => a.approverName);
  const approverNames = [...wildcardNames, ...statusApproverNames];

  async function handleExportPdf() {
    setExportPdfError(undefined);
    setExportingPdf(true);
    try {
      const { exportCrmRecordToPdf } = await import("@/lib/crmPdfExport");
      await exportCrmRecordToPdf({
        recordType: "prospect",
        title: company,
        recordNumber: currentRecord.recordNumber,
        statusLabel: statusInfo?.statusLabel,
        ownerName: users.find((u) => u.id === currentRecord.ownerUserId)?.fullName,
        createdAt: currentRecord.createdAt,
        updatedAt: currentRecord.updatedAt,
        coreFields: cf,
        customFields: currentRecord.customFields,
        lookups,
      });
    } catch (err) {
      setExportPdfError(apiErrorMessage(err, "Failed to export PDF."));
    } finally {
      setExportingPdf(false);
    }
  }

  return (
    <div className="flex flex-col flex-1 min-h-0 bg-stone-50">
      <CrmPageHeader
        backLabel="Prospects"
        onBack={() => navigate("/crm/prospect")}
        icon={Users}
        iconBg="bg-workflow-prospect-bg"
        iconColor="text-workflow-prospect-text"
        title={company}
        subtitle="Prospect"
        recordNumber={record.recordNumber}
        statusBadge={statusInfo && <Badge color={resolveStatusColor(statusInfo.stateKey, statusInfo.color)}>{statusInfo.statusLabel}</Badge>}
      />

      {approvalStatus === "pending" && (
        <ApprovalBanner
          approverNames={approverNames}
          canApprove={canApprove}
          onApprove={() => approve.mutate()}
          approving={approve.isPending}
        />
      )}

      {/* Tab bar */}
      <div className="flex shrink-0 border-b border-stone-200 bg-white px-5 3xl:px-12 4xl:px-16">
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

      {/* Two-column body — stacks on mobile, side-by-side on lg+ */}
      <div className="flex flex-col lg:flex-row gap-6 px-4 py-4 sm:px-5 sm:py-5 3xl:px-12 3xl:py-8 3xl:gap-10 4xl:px-16 4xl:py-10 4xl:gap-14">

        {/* Left column — main content */}
        <div className="flex-1 space-y-3 min-w-0">
          {activeTab === "overview" && (
            <>
              <CrmRecordDetail coreFields={cf} users={users} />
              {Object.keys(record.customFields).length > 0 && (
                <ModernSection title="Custom Fields" index={0} defaultCollapsed>
                  <div className="grid grid-cols-1 gap-x-5 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
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
            <FilesContent ref={null} recordId={id} readOnly={false} />
          )}

          {activeTab === "audit" && (
            <AuditContent recordId={id} workflowKey="prospect" />
          )}

          <div className="h-6" />
        </div>

        {/* Right sidebar — full width on mobile, sticky 288px panel on lg+ */}
        <div className="lg:w-72 lg:shrink-0 lg:sticky lg:top-[4.5rem] lg:h-fit lg:self-start">
          <CrmDetailSidebar
            statusInfo={statusInfo}
            ownerUserId={record.ownerUserId}
            users={users}
            createdAt={record.createdAt}
            updatedAt={record.updatedAt}
            onEdit={canEdit ? () => navigate(`/crm/prospect/${id}/edit`) : undefined}
            onUploadFile={() => navigate(`/crm/prospect/${id}/edit`, { state: { initialTab: "files" } })}
            onExportPdf={handleExportPdf}
            exportingPdf={exportingPdf}
            exportPdfError={exportPdfError}
            approvalSlot={(
              <>
                <ApprovalCard approverNames={approverNames} status={approvalStatus} />
                {approve.error && (
                  <div className="mb-4">
                    <ErrorNote>{apiErrorMessage(approve.error, "Failed to approve record.")}</ErrorNote>
                  </div>
                )}
              </>
            )}
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
