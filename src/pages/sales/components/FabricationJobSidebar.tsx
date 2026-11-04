import { useNavigate } from 'react-router-dom';
import { useQueryClient, useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { fabricationService } from '@/services/fabricationService';
import { Badge } from '@/components/tenant/ui';
import { CustomerLink } from '@/components/crm/CustomerLink';
import { DangerZoneCard } from '@/components/tenant/DangerZoneCard';
import {
  FJ_STATUS_CODES, APPROVAL_STATUS_LABELS, APPROVAL_STATUS_COLORS, canCancel, canDeleteJob,
} from '@/lib/fabricationForm';
import { statusToastLabel } from '@/lib/statusToast';
import type { FabricationJob } from '@/types/fabrication';
import { SalesDetailSidebar } from './SalesDetailSidebar';
import { FabricationHoldResumeControl } from './FabricationHoldResumeControl';
import { FabricationStatusControl } from './FabricationStatusControl';
import { CancelFabricationJobDialog } from './CancelFabricationJobDialog';
import { DeleteFabricationJobDialog } from './DeleteFabricationJobDialog';
import { FabricationQuickActionsCard } from './FabricationQuickActionsCard';
import { useFabricationJobPdfExport } from './useFabricationJobPdfExport';
import { fmtDate } from './fabricationJobFormat';

interface Props {
  id: string;
  job: FabricationJob;
  salesOrderNumber?: string;
  canEdit: boolean;
  canDelete: boolean;
  onChanged: (updated: FabricationJob) => void;
}

/** Right-hand "Job Details" sidebar of the fabrication job detail page. */
export function FabricationJobSidebar({ id, job, salesOrderNumber, canEdit, canDelete, onChanged }: Props) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { exportingPdf, exportPdfError, handleExportPdf } = useFabricationJobPdfExport(job, salesOrderNumber);

  // Inline status change from the sidebar's Status row — mirrors the Edit
  // page's transition mutation. Forward-path moves only: Hold/Resume/Cancel
  // stay on their own dedicated controls (FabricationHoldResumeControl,
  // CancelFabricationJobDialog), unaffected by this.
  const transition = useMutation({
    mutationFn: (toStatusCode: string) => fabricationService.transition(id, toStatusCode),
    onSuccess: (updated) => {
      onChanged(updated);
      // Label the actual resulting status, not the one requested -- a move
      // onto an unconfigured approval gate auto-skips server-side (see
      // fabrication/store_transition.go), so the two can differ.
      toast.success(`Moved to ${statusToastLabel(FJ_STATUS_CODES, updated.statusCode)}.`);
    },
  });

  return (
    <SalesDetailSidebar label="Job Details">
      <FabricationQuickActionsCard
        jobId={id}
        canEdit={canEdit}
        exporting={exportingPdf}
        error={exportPdfError}
        onExport={handleExportPdf}
      />

      {canEdit && (
        <div className="rounded-xl border border-stone-200 bg-white shadow-sm p-4 space-y-3 mb-4">
          <p className="text-xs font-semibold text-stone-500">Status Actions</p>
          <FabricationHoldResumeControl job={job} onChanged={onChanged} />
        </div>
      )}

      <div className="rounded-xl border border-stone-200 bg-white shadow-sm p-4 space-y-3 mb-4">
        <p className="text-xs font-semibold text-stone-500">Status</p>
        <div className="flex justify-between items-center py-2 border-b border-stone-100 text-xs">
          <span className="text-stone-500">Status</span>
          <FabricationStatusControl
            job={job}
            onChange={(code) => transition.mutate(code)}
            disabled={transition.isPending}
            variant="pill"
          />
        </div>
        {job.approvalStatus !== 'none' && (
          <div className="flex justify-between items-center py-2 border-b border-stone-100 text-xs">
            <span className="text-stone-500">Approval</span>
            <Badge color={APPROVAL_STATUS_COLORS[job.approvalStatus]}>{APPROVAL_STATUS_LABELS[job.approvalStatus]}</Badge>
          </div>
        )}
        <div className="flex justify-between items-center py-2 border-b border-stone-100 text-xs">
          <span className="text-stone-500">Customer</span>
          <CustomerLink id={job.customer.id} name={job.customer.name} className="text-stone-700 truncate max-w-[140px] hover:text-accent-foreground hover:underline" />
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
          <p className="text-xs font-semibold text-stone-500">Cancel</p>
          <CancelFabricationJobDialog job={job} onCancelled={onChanged} />
        </div>
      )}

      {canDelete && canDeleteJob(job.statusCode) && (
        <DangerZoneCard>
          <DeleteFabricationJobDialog
            jobId={id}
            label={`Fabrication Job ${job.jobNumber}`}
            onDeleted={() => {
              queryClient.invalidateQueries({ queryKey: ['fabrication-jobs'] });
              navigate('/sales/installation');
            }}
          />
        </DangerZoneCard>
      )}
    </SalesDetailSidebar>
  );
}
