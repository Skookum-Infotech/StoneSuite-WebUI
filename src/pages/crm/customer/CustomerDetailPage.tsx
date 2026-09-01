import { useState, useEffect } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { Building2 } from "lucide-react";
import { crmService } from "@/services/crmService";
import { userService } from "@/services/tenantServices";
import { lookupService } from "@/services/lookupService";
import { apiErrorMessage } from "@/api/tenantClient";
import { Spinner, ErrorNote, Badge } from "@/components/tenant/ui";
import { CustomerDeleteButton } from "@/pages/crm/customer/components/CustomerDeleteButton";
import { CrmRecordDetail } from "@/components/crm/CrmRecordDetail";
import { CrmDetailSidebar } from "@/components/crm/CrmDetailSidebar";
import { StatusDropdown } from "@/components/crm/StatusDropdown";
import { CRM_WORKFLOW_ROUTES } from "@/components/crm/crmWorkflowRoutes";
import { ApprovalCard, type ApprovalStatus } from "@/components/crm/ApprovalCard";
import { ApprovalBanner } from "@/components/tenant/ApprovalBanner";
import { RejectRecordDialog } from "@/components/crm/RejectRecordDialog";
import { ModernSection } from "@/components/crm/FormPrimitives";
import {
  AuditContent,
  FilesContent,
  TransactionsContent,
} from "@/components/crm/CrmSubTabsPanel";
import { ActivityLogPanel } from "@/components/crm/ActivityLogPanel";
import { PortalAccessPanel } from "@/pages/crm/customer/components/PortalAccessPanel";
import { PortalAccessStatusCard } from "@/pages/crm/customer/components/PortalAccessStatusCard";
import { useBreadcrumbStore } from "@/store/useBreadcrumbStore";
import { CrmPageHeader } from "@/pages/crm/components/CrmPageHeader";
import { readonlyCls, fieldLabelCls, resolveStatusColor } from "@/components/crm/formUtils";
import { cn } from "@/lib/utils";
import { useUserPermissions } from "@/hooks/useUserPermissions";
import { recordApprovalState, type StatusInfo } from "@/types/tenant";

const TABS = [
  { key: "overview", label: "Overview" },
  { key: "transactions", label: "Transactions" },
  { key: "files", label: "Files" },
  { key: "portal", label: "Portal Access" },
  { key: "audit", label: "Audit" },
  { key: "activity", label: "Activity" },
] as const;

type Tab = (typeof TABS)[number]["key"];

export default function CustomerDetailPage() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const initialTab = (location.state as { initialTab?: Tab } | null)?.initialTab ?? "overview";
  const [activeTab, setActiveTab] = useState<Tab>(initialTab);
  const { hasPermission, isLoading: permissionsLoading } = useUserPermissions();
  const canEdit = permissionsLoading || hasPermission("customer", "update");
  const canViewPortalAccess = permissionsLoading || hasPermission("portal_access", "read");
  const visibleTabs = TABS.filter((tab) => tab.key !== "portal" || canViewPortalAccess);

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
    staleTime: 10 * 60 * 1000,
  });

  const { data: users = [] } = useQuery({
    queryKey: ["workspace-users"],
    queryFn: userService.listUsers,
  });

  const { data: lookups } = useQuery({
    queryKey: ["crm-lookups"],
    queryFn: lookupService.getCrmLookups,
    staleTime: 10 * 60 * 1000,
  });

  const approve = useMutation({
    mutationFn: () => crmService.approveRecord(id, "customer"),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["crm-record", id] }),
  });

  // Inline status change from the sidebar's Status row — mirrors the Edit
  // page's transition mutation.
  const transition = useMutation({
    mutationFn: (toStateId: string) => crmService.transitionRecord(id, toStateId, "customer"),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ["crm-record", id] });
      queryClient.invalidateQueries({ queryKey: ["crm-records", "customer"] });
      const newType = updated.workflowId?.toLowerCase();
      if (newType && newType !== "customer" && CRM_WORKFLOW_ROUTES[newType]) {
        queryClient.invalidateQueries({ queryKey: ["crm-records", newType] });
        navigate(`${CRM_WORKFLOW_ROUTES[newType]}/${updated.id}`);
      }
    },
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

  const currentRecord = record;
  const statusInfo = statusMap.get(record.currentStateId);
  const cf = record.coreFields;
  const company = String(cf.customer_name ?? "(unnamed)");
  // The portal login is minted for the customer record's own contact email
  // (required at creation) — one customer, one login. The display name mirrors
  // the backend's ContactInfoForInvite: authorized contact, else the company.
  const portalContactEmail = String(cf.customer_contact_email ?? "").trim();
  const portalContactName =
    [cf.customer_authorized_person_fname, cf.customer_authorized_person_lname]
      .map((v) => String(v ?? "").trim())
      .filter(Boolean)
      .join(" ") || company;

  // The approval overlay is authoritative from the server — see
  // crmService.getRecord / types/tenant.ts's CrmApproval. `gated` (pending or
  // rejected) drives the banner; `approvalStatus` drives the sidebar card,
  // portal-eligibility gate, and list-style badges via the plain
  // approval_status core field.
  const approval = record.approval;
  const recordApproval = recordApprovalState(record);
  const approvalStatus: ApprovalStatus = recordApproval === "none" ? "not_required" : recordApproval;
  // Mirrors the backend's CustomerEligible gate on portal access grants:
  // customer_is_approved is only ever true for 'approved' or 'not_required'
  // (a record with no configured approver auto-approves on entry) — both
  // 'pending' and 'rejected' must block granting a new portal login.
  const customerApproved = approvalStatus === "approved" || approvalStatus === "not_required";
  const approverNames = (approval?.approvers ?? []).map((a) => a.name);

  async function handleExportPdf() {
    setExportPdfError(undefined);
    setExportingPdf(true);
    try {
      const { exportCrmRecordToPdf } = await import("@/lib/crmPdfExport");
      await exportCrmRecordToPdf({
        recordType: "customer",
        title: company,
        recordNumber: currentRecord.recordNumber,
        statusLabel: statusInfo?.statusLabel,
        ownerName: users.find((u) => u.id === currentRecord.ownerUserId)?.fullName,
        createdAt: currentRecord.createdAt,
        updatedAt: currentRecord.updatedAt,
        coreFields: cf,
        customFields: currentRecord.customFields,
        lookups,
        showCustomerBalances: true,
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

      {approval?.gated && (
        <ApprovalBanner
          status={approval.status === "rejected" ? "rejected" : "pending"}
          approverNames={approverNames}
          canApprove={approval.canApprove}
          isOverride={approval.isOverride}
          requiredApprovals={approval.requiredApprovals}
          approvedCount={approval.approvedCount}
          callerAlreadyApproved={approval.callerAlreadyApproved}
          onApprove={() => approve.mutate()}
          approving={approve.isPending}
          rejection={{ byName: approval.rejectedByName, reason: approval.rejectionReason }}
          actions={approval.canReject && (
            <RejectRecordDialog
              recordId={id}
              workflowKey="customer"
              onRejected={() => queryClient.invalidateQueries({ queryKey: ["crm-record", id] })}
            />
          )}
        />
      )}

      {/* Tab bar — scrolls horizontally on small screens rather than
          overflowing the page (6 tabs don't fit a phone width). */}
      <div className="flex shrink-0 overflow-x-auto modal-scrollbar border-b border-stone-200 bg-white px-3 sm:px-5 3xl:px-12 4xl:px-16">
        {visibleTabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key)}
            className={cn(
              "shrink-0 whitespace-nowrap px-3 py-3 text-sm font-semibold border-b-2 -mb-px transition-colors duration-150 sm:px-4",
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
              <CrmRecordDetail coreFields={cf} showCustomerBalances users={users} />
              {Object.keys(record.customFields).length > 0 && (
                <ModernSection title="Custom Fields" index={0} defaultCollapsed>
                  <div className="grid grid-cols-1 gap-x-5 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
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

          {activeTab === "portal" && canViewPortalAccess && (
            <PortalAccessPanel
              customerUuid={id}
              customerApproved={customerApproved}
              contactEmail={portalContactEmail}
              contactName={portalContactName}
            />
          )}

          {activeTab === "files" && (
            <FilesContent ref={null} recordId={id} readOnly={false} />
          )}

          {activeTab === "audit" && (
            <AuditContent recordId={id} workflowKey="customer" />
          )}

          {activeTab === "activity" && (
            <ActivityLogPanel recordId={id} workflowKey="customer" />
          )}

          <div className="h-6" />
        </div>

        {/* Right sidebar — full width on mobile, sticky 288px panel on lg+ */}
        <div className="lg:w-72 lg:shrink-0 lg:sticky lg:top-[4.5rem] lg:h-fit lg:self-start">
          <CrmDetailSidebar
            statusInfo={statusInfo}
            statusControl={statusInfo && (
              <StatusDropdown
                workflowKey="customer"
                mode="transitions"
                recordId={id}
                value={record.currentStateId}
                onChange={(toStateId) => transition.mutate(toStateId)}
                disabled={transition.isPending}
                variant="pill"
                gated={approval?.gated}
              />
            )}
            ownerUserId={record.ownerUserId}
            users={users}
            createdAt={record.createdAt}
            updatedAt={record.updatedAt}
            onEdit={canEdit ? () => navigate(`/crm/customer/${id}/edit`) : undefined}
            onUploadFile={() => navigate(`/crm/customer/${id}/edit`, { state: { initialTab: "files" } })}
            onExportPdf={handleExportPdf}
            exportingPdf={exportingPdf}
            exportPdfError={exportPdfError}
            approvalSlot={(
              <>
                <ApprovalCard
                  approvers={approval?.approvers ?? []}
                  status={approvalStatus}
                  rejectedByName={approval?.rejectedByName}
                  rejectionReason={approval?.rejectionReason}
                />
                {approve.error && (
                  <div className="mb-4">
                    <ErrorNote>{apiErrorMessage(approve.error, "Failed to approve record.")}</ErrorNote>
                  </div>
                )}
              </>
            )}
            portalAccessSlot={canViewPortalAccess && (
              <PortalAccessStatusCard customerUuid={id} onManage={() => setActiveTab("portal")} />
            )}
            deleteSlot={(
              <CustomerDeleteButton
                recordId={id}
                company={company}
                onManagePortal={() => setActiveTab("portal")}
                onDeleted={() => {
                  queryClient.invalidateQueries({ queryKey: ["crm-records", "customer"] });
                  // Drop this customer's now-orphaned rows from the tenant-wide
                  // portal-user roster (the server already filters them out).
                  queryClient.invalidateQueries({ queryKey: ["portal-users", "tenant"] });
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
