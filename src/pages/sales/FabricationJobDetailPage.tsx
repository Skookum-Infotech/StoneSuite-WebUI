import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Wrench, Upload, Pencil, ShoppingCart } from 'lucide-react';
import { fabricationService } from '@/services/fabricationService';
import { apiErrorMessage } from '@/api/tenantClient';
import { Spinner, ErrorNote, Badge } from '@/components/tenant/ui';
import { ModernSection } from '@/components/crm/FormPrimitives';
import { readonlyCls, fieldLabelCls } from '@/components/crm/formUtils';
import { FilesContent } from '@/components/crm/CrmSubTabsPanel';
import { CrmPageHeader } from '@/pages/crm/components/CrmPageHeader';
import { useBreadcrumbStore } from '@/store/useBreadcrumbStore';
import { useUserPermissions } from '@/hooks/useUserPermissions';
import { cn } from '@/lib/utils';
import {
  FJ_STATUS_COLORS, APPROVAL_STATUS_LABELS, APPROVAL_STATUS_COLORS,
  needsApproval, canCancel, canDeleteJob,
} from '@/lib/fabricationForm';
import { FabricationPiecesTable } from './components/FabricationPiecesTable';
import { FabricationSlabsTab } from './components/FabricationSlabsTab';
import { FabricationStepsTab } from './components/FabricationStepsTab';
import { FabricationHoldResumeControl } from './components/FabricationHoldResumeControl';
import { FabricationApprovalButton } from './components/FabricationApprovalButton';
import { CancelFabricationJobDialog } from './components/CancelFabricationJobDialog';
import { DeleteFabricationJobDialog } from './components/DeleteFabricationJobDialog';
import type { FabricationJob } from '@/types/fabrication';

function fmtDate(iso?: string): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

export default function FabricationJobDetailPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { hasPermission, isLoading: permissionsLoading } = useUserPermissions();
  const canEdit = permissionsLoading || hasPermission('installation', 'update');
  const canDelete = permissionsLoading || hasPermission('installation', 'delete');
  // Slabs tab needs BOTH grants — installation:read and inventory_item:read.
  const canReadSlabs = permissionsLoading || (hasPermission('installation', 'read') && hasPermission('inventory_item', 'read'));
  const canAllocateSlabs = hasPermission('installation', 'update') && hasPermission('inventory_item', 'update');

  const TABS = [
    { key: 'overview', label: 'Overview' },
    { key: 'pieces', label: 'Pieces' },
    ...(canReadSlabs ? [{ key: 'slabs', label: 'Slabs' }] as const : []),
    { key: 'checklist', label: 'Checklist' },
    { key: 'files', label: 'Files' },
  ] as const;
  type Tab = (typeof TABS)[number]['key'];

  const [activeTab, setActiveTab] = useState<Tab>('overview');

  const { data: job, isLoading, error } = useQuery({
    queryKey: ['fabrication-job', id],
    queryFn: () => fabricationService.getJob(id),
    enabled: Boolean(id),
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

  if (isLoading) return <div className="p-6"><Spinner label="Loading fabrication job…" /></div>;
  // A 404 here means "not found or not yours" (IDOR guard) — always rendered
  // as a not-found message, never a permissions message, so the UI can't leak
  // whether a record exists to a caller outside its scope.
  if (error || !job)
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

      <div className="flex shrink-0 overflow-x-auto overflow-y-hidden border-b border-stone-200 bg-white px-5 3xl:px-12 4xl:px-16 modal-scrollbar">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key)}
            className={cn(
              'px-4 py-3 text-sm font-semibold border-b-2 -mb-px transition-colors duration-150 whitespace-nowrap shrink-0',
              activeTab === tab.key
                ? 'border-brand text-stone-950'
                : 'border-transparent text-stone-500 hover:text-stone-700 hover:border-stone-200',
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="flex flex-col lg:flex-row gap-6 px-4 py-4 sm:px-5 sm:py-5 3xl:px-12 3xl:py-8 3xl:gap-10 4xl:px-16 4xl:py-10 4xl:gap-14">
        <div className="flex-1 space-y-3 min-w-0">
          {activeTab === 'overview' && (
            <>
              <ModernSection title="Sales Order" index={0}>
                <Link
                  to={`/sales/sales_order/${job.salesOrderId}`}
                  className="inline-flex items-center gap-1.5 rounded-[10px] border border-stone-300 bg-stone-50 px-3.5 py-2.5 text-xs font-semibold text-accent-foreground hover:bg-stone-100 transition-colors"
                >
                  <ShoppingCart className="size-3.5" />
                  View Sales Order
                </Link>
              </ModernSection>
              <ModernSection title="Job Site" index={1}>
                <div className="grid grid-cols-1 gap-x-5 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
                  <ReadonlyField label="Site Contact" value={job.site.customerName} />
                  <ReadonlyField label="Address" value={[job.site.addrLine1, job.site.addrLine2].filter(Boolean).join(', ')} />
                  <ReadonlyField label="City" value={job.site.city} />
                  <ReadonlyField label="Zip" value={job.site.zip} />
                  <ReadonlyField label="Phone" value={job.site.phone} />
                </div>
              </ModernSection>
              <ModernSection title="Schedule" index={2}>
                <div className="grid grid-cols-1 gap-x-5 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
                  <ReadonlyField label="Template Date" value={job.templateDate ? fmtDate(job.templateDate) : undefined} />
                  <ReadonlyField label="Fabrication Start" value={job.fabricationStart ? fmtDate(job.fabricationStart) : undefined} />
                  <ReadonlyField label="Promised Install Date" value={job.promisedInstallDate ? fmtDate(job.promisedInstallDate) : undefined} />
                  <ReadonlyField label="Actual Install Date" value={job.actualInstallDate ? fmtDate(job.actualInstallDate) : undefined} />
                </div>
              </ModernSection>
              {job.notes && (
                <ModernSection title="Notes" index={3}>
                  <p className="text-xs text-stone-600 whitespace-pre-wrap">{job.notes}</p>
                </ModernSection>
              )}
            </>
          )}

          {activeTab === 'pieces' && <FabricationPiecesTable pieces={job.pieces ?? []} />}
          {activeTab === 'slabs' && canReadSlabs && (
            <FabricationSlabsTab jobId={id} pieces={job.pieces ?? []} canAllocate={canAllocateSlabs} />
          )}
          {activeTab === 'checklist' && (
            <FabricationStepsTab jobId={id} steps={job.steps ?? []} canEdit={canEdit} />
          )}
          {activeTab === 'files' && <FilesContent ref={null} recordId={id} readOnly={false} />}

          <div className="h-6" />
        </div>

        <div className="lg:w-72 lg:shrink-0 lg:sticky lg:top-[4.5rem] lg:h-fit lg:self-start">
          <div className="rounded-xl border border-stone-200 bg-white shadow-sm p-4 space-y-3 mb-4">
            <p className="text-xs font-semibold text-stone-400">Quick Actions</p>
            <div className="space-y-0.5">
              <button
                type="button"
                onClick={() => navigate(`/sales/installation/${id}/edit`, { state: { initialTab: 'files' } })}
                className="flex items-center gap-2.5 hover:bg-stone-50 rounded-lg px-3 py-2 cursor-pointer text-xs text-stone-700 w-full transition-colors text-left"
              >
                <Upload className="size-4 text-stone-400 shrink-0" />
                Upload file
              </button>
              {canEdit && (
                <button
                  type="button"
                  onClick={() => navigate(`/sales/installation/${id}/edit`)}
                  className="flex items-center gap-2.5 hover:bg-stone-50 rounded-lg px-3 py-2 cursor-pointer text-xs text-stone-700 w-full transition-colors text-left"
                >
                  <Pencil className="size-4 text-stone-400 shrink-0" />
                  Edit fabrication job
                </button>
              )}
            </div>
          </div>

          {canEdit && (
            <div className="rounded-xl border border-stone-200 bg-white shadow-sm p-4 space-y-3 mb-4">
              <p className="text-xs font-semibold text-stone-400">Status Actions</p>
              <FabricationHoldResumeControl job={job} onChanged={applyUpdatedJob} />
              {needsApproval(job) && <FabricationApprovalButton jobId={id} onApproved={applyUpdatedJob} />}
            </div>
          )}

          <div className="rounded-xl border border-stone-200 bg-white shadow-sm p-4 space-y-3 mb-4">
            <p className="text-xs font-semibold text-stone-400">Status</p>
            <div className="flex justify-between items-center py-2 border-b border-stone-100 text-xs">
              <span className="text-stone-500">Status</span>
              <Badge color={color}>{job.status}</Badge>
            </div>
            {job.approvalStatus !== 'none' && (
              <div className="flex justify-between items-center py-2 border-b border-stone-100 text-xs">
                <span className="text-stone-500">Approval</span>
                <Badge color={APPROVAL_STATUS_COLORS[job.approvalStatus]}>{APPROVAL_STATUS_LABELS[job.approvalStatus]}</Badge>
              </div>
            )}
            <div className="flex justify-between items-center py-2 border-b border-stone-100 text-xs">
              <span className="text-stone-500">Customer</span>
              <span className="text-stone-700 truncate max-w-[140px]">{job.customer.name}</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-stone-100 text-xs">
              <span className="text-stone-500">Created</span>
              <span className="text-stone-700">{fmtDate(job.createdAt)}</span>
            </div>
            <div className="flex justify-between items-center py-2 text-xs">
              <span className="text-stone-500">Updated</span>
              <span className="text-stone-700">{fmtDate(job.updatedAt)}</span>
            </div>
          </div>

          {canEdit && canCancel(job.statusCode) && (
            <div className="rounded-xl border border-stone-200 bg-white shadow-sm p-4 space-y-3 mb-4">
              <p className="text-xs font-semibold text-stone-400">Cancel</p>
              <CancelFabricationJobDialog job={job} onCancelled={applyUpdatedJob} />
            </div>
          )}

          {canDelete && canDeleteJob(job.statusCode) && (
            <div className="rounded-xl border border-stone-200 bg-white shadow-sm p-4 space-y-3 mb-4">
              <p className="text-xs font-semibold text-red-400">Danger Zone</p>
              <DeleteFabricationJobDialog
                jobId={id}
                label={`Fabrication Job ${job.jobNumber}`}
                onDeleted={() => {
                  queryClient.invalidateQueries({ queryKey: ['fabrication-jobs'] });
                  navigate('/sales/installation');
                }}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ReadonlyField({ label, value, full }: { label: string; value?: string; full?: boolean }) {
  return (
    <div className={cn('space-y-1', full && 'col-span-full')}>
      <label className={fieldLabelCls}>{label}</label>
      <div className={readonlyCls}>{value || <span className="text-stone-400">—</span>}</div>
    </div>
  );
}
