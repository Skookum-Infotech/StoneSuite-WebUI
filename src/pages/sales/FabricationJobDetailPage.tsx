import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { Wrench } from 'lucide-react';
import { toast } from 'sonner';
import { fabricationService } from '@/services/fabricationService';
import { salesOrderService } from '@/services/salesOrderService';
import { apiErrorMessage } from '@/api/tenantClient';
import { Spinner, ErrorNote, Badge } from '@/components/tenant/ui';
import { FilesContent } from '@/components/crm/CrmSubTabsPanel';
import { CrmPageHeader } from '@/pages/crm/components/CrmPageHeader';
import { useBreadcrumbStore } from '@/store/useBreadcrumbStore';
import { useUserPermissions } from '@/hooks/useUserPermissions';
import { TAB_LIST_CLASS, tabClass } from '@/components/ui/tabStyles';
import { FJ_STATUS_COLORS, canEditPieces } from '@/lib/fabricationForm';
import { FabricationPiecesEditableTab } from './components/FabricationPiecesEditableTab';
import { FabricationPiecesTable } from './components/FabricationPiecesTable';
import { FabricationMaterialsTab } from './components/FabricationMaterialsTab';
import { FabricationTemplatesPanel } from './components/FabricationTemplatesPanel';
import { FabricationStepsTab } from './components/FabricationStepsTab';
import { FabricationJobOverviewTab } from './components/FabricationJobOverviewTab';
import { FabricationJobSidebar } from './components/FabricationJobSidebar';
import { ApprovalBanner } from '@/components/tenant/ApprovalBanner';
import type { FabricationJob } from '@/types/fabrication';

// Poll the primary record so status/approval changes made by another user or
// tab show up without a manual reload — same cadence as NotificationBell's
// unread poll.
const DETAIL_POLL_MS = 60_000;

export default function FabricationJobDetailPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { hasPermission, isLoading: permissionsLoading } = useUserPermissions();
  const canEdit = permissionsLoading || hasPermission('installation', 'update');
  const canDelete = permissionsLoading || hasPermission('installation', 'delete');
  // Materials tab needs BOTH grants — installation:read and inventory_item:read.
  const canReadSlabs = permissionsLoading || (hasPermission('installation', 'read') && hasPermission('inventory_item', 'read'));
  const canAllocateSlabs = hasPermission('installation', 'update') && hasPermission('inventory_item', 'update');

  const TABS = [
    { key: 'overview', label: 'Overview' },
    { key: 'pieces', label: 'Pieces' },
    { key: 'templates', label: 'Template & approvals' },
    ...(canReadSlabs ? [{ key: 'materials', label: 'Materials' }] as const : []),
    { key: 'checklist', label: 'Checklist' },
    { key: 'files', label: 'Files' },
  ] as const;
  type Tab = (typeof TABS)[number]['key'];

  const [activeTab, setActiveTab] = useState<Tab>('overview');

  const { data: job, isLoading, error } = useQuery({
    queryKey: ['fabrication-job', id],
    queryFn: () => fabricationService.getJob(id),
    enabled: Boolean(id),
    refetchInterval: DETAIL_POLL_MS,
  });

  const setLabel = useBreadcrumbStore((s) => s.setLabel);
  const clearLabel = useBreadcrumbStore((s) => s.clearLabel);
  useEffect(() => {
    if (job?.jobNumber) {
      setLabel(id, job.jobNumber);
      return () => clearLabel(id);
    }
  }, [id, job?.jobNumber, setLabel, clearLabel]);

  function applyUpdatedJob(updated: FabricationJob) {
    queryClient.setQueryData(['fabrication-job', id], updated);
    queryClient.invalidateQueries({ queryKey: ['fabrication-jobs'] });
  }

  const approve = useMutation({
    mutationFn: () => fabricationService.approve(id),
    onSuccess: (updated) => {
      applyUpdatedJob(updated);
      toast.success('Approved.');
    },
  });

  // The originating sales order's line items, for the pieces editor's
  // "linked line" dropdown — only fetched once the job (and its sales order
  // id) has loaded.
  const { data: sourceOrderDetail } = useQuery({
    queryKey: ['sales-order', job?.salesOrderId],
    queryFn: () => salesOrderService.getOrder(job!.salesOrderId),
    enabled: Boolean(job?.salesOrderId),
  });
  const sourceOrderItems = (sourceOrderDetail?.items ?? []).map((line) => ({
    id: line.id,
    label: `#${line.lineNumber} ${line.itemName || line.description || ''}`.trim(),
  }));

  if (isLoading) return <div className="p-6"><Spinner label="Loading fabrication job…" /></div>;
  // A 404 here means "not found or not yours" (IDOR guard) — always rendered
  // as a not-found message, never a permissions message, so the UI can't leak
  // whether a record exists to a caller outside its scope.
  if (!job)
    return <div className="p-6"><ErrorNote>{apiErrorMessage(error, 'Fabrication job not found.')}</ErrorNote></div>;

  const color = FJ_STATUS_COLORS[job.status] ?? '#a8a29e';

  return (
    <div className="flex flex-col flex-1 min-h-0 bg-stone-50">
      <CrmPageHeader
        backLabel="Installation / Fabrication"
        onBack={() => navigate('/sales/installation')}
        icon={Wrench}
        title={job.jobNumber || 'Fabrication Job'}
        subtitle={job.customer.name}
        recordNumber={job.jobNumber}
        statusBadge={<Badge color={color}>{job.status}</Badge>}
      />

      {job.gated && (
        <>
          <ApprovalBanner
            approverNames={job.approvers.filter((a) => !a.approved).map((a) => a.name)}
            canApprove={job.canApprove}
            isOverride={job.isOverride}
            requiredApprovals={job.requiredApprovals}
            approvedCount={job.approvedCount}
            callerAlreadyApproved={job.callerAlreadyApproved}
            onApprove={() => approve.mutate()}
            approving={approve.isPending}
          />
          {approve.isError && (
            <p role="alert" className="px-5 py-1.5 text-2xs text-destructive 3xl:px-12 4xl:px-16">
              {apiErrorMessage(approve.error, 'Failed to approve fabrication job.')}
            </p>
          )}
        </>
      )}

      <div className="flex shrink-0 overflow-x-auto overflow-y-hidden border-b border-stone-200 bg-white px-5 3xl:px-12 4xl:px-16 modal-scrollbar py-2.5">
        <div role="tablist" className={TAB_LIST_CLASS}>
          {TABS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={tabClass(activeTab === tab.key)}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-6 px-4 py-4 sm:px-5 sm:py-5 3xl:px-12 3xl:py-8 3xl:gap-10 4xl:px-16 4xl:py-10 4xl:gap-14">
        <div className="flex-1 space-y-3 min-w-0">
          {activeTab === 'templates' && <FabricationTemplatesPanel jobId={id} />}
          {activeTab === 'overview' && <FabricationJobOverviewTab job={job} />}

          {activeTab === 'pieces' && (
            canEdit && canEditPieces(job.statusCode)
              ? <FabricationPiecesEditableTab jobId={id} pieces={job.pieces ?? []} sourceOrderItems={sourceOrderItems} />
              : <FabricationPiecesTable pieces={job.pieces ?? []} />
          )}
          {activeTab === 'materials' && canReadSlabs && (
            <FabricationMaterialsTab workflowVersion={job.workflowVersion} version={job.version} jobId={id} pieces={job.pieces ?? []} canAllocate={canAllocateSlabs} />
          )}
          {activeTab === 'checklist' && (
            <FabricationStepsTab jobId={id} steps={job.steps ?? []} canEdit={canEdit} />
          )}
          {activeTab === 'files' && <FilesContent ref={null} recordId={id} readOnly={false} />}

          <div className="h-6" />
        </div>

        <FabricationJobSidebar
          id={id}
          job={job}
          salesOrderNumber={sourceOrderDetail?.salesOrderNumber}
          canEdit={canEdit}
          canDelete={canDelete}
          onChanged={applyUpdatedJob}
        />
      </div>
    </div>
  );
}
