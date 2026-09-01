import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Wrench, AlertCircle, Loader2, Save } from 'lucide-react';
import { toast } from 'sonner';
import { fabricationService } from '@/services/fabricationService';
import { salesOrderService } from '@/services/salesOrderService';
import { lookupService } from '@/services/lookupService';
import { apiErrorMessage } from '@/api/tenantClient';
import { FormActionBar } from '@/components/crm/FormPrimitives';
import { CrmPageHeader } from '@/pages/crm/components/CrmPageHeader';
import { Spinner, ErrorNote } from '@/components/tenant/ui';
import { useBreadcrumbStore } from '@/store/useBreadcrumbStore';
import { useUserPermissions } from '@/hooks/useUserPermissions';
import { FabricationJobFormBody } from './components/FabricationJobFormBody';
import { FabricationStatusControl } from './components/FabricationStatusControl';
import { FabricationHoldResumeControl } from './components/FabricationHoldResumeControl';
import { fromJob, toJobFields, canEditPieces, PAGE_TABS, type PageTab, FJ_STATUS_CODES } from '@/lib/fabricationForm';
import { statusToastLabel } from '@/lib/statusToast';
import type { FabricationJob } from '@/types/fabrication';

export default function EditFabricationJobPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { hasPermission } = useUserPermissions();

  const [activeTab, setActiveTab] = useState<PageTab>(PAGE_TABS[0].key);
  const [localData, setLocalData] = useState<Record<string, unknown> | null>(null);

  const { data: job, isLoading, error: loadError } = useQuery({
    queryKey: ['fabrication-job', id],
    queryFn: () => fabricationService.getJob(id),
    enabled: Boolean(id),
  });

  const { data: lookups } = useQuery({
    queryKey: ['crm-lookups'],
    queryFn: lookupService.getCrmLookups,
    staleTime: 10 * 60 * 1000,
  });

  // The originating sales order's line items, for the pieces editor's
  // "linked line" dropdown — same source the Add page reads from.
  const { data: sourceOrderDetail } = useQuery({
    queryKey: ['sales-order', job?.salesOrderId],
    queryFn: () => salesOrderService.getOrder(job!.salesOrderId),
    enabled: Boolean(job?.salesOrderId),
  });
  const sourceOrderItems = (sourceOrderDetail?.items ?? []).map((line) => ({
    id: line.id,
    label: `#${line.lineNumber} ${line.itemName || line.description || ''}`.trim(),
  }));

  const setLabel = useBreadcrumbStore((s) => s.setLabel);
  const clearLabel = useBreadcrumbStore((s) => s.clearLabel);
  useEffect(() => {
    if (job?.jobNumber) {
      setLabel(id, job.jobNumber);
      return () => clearLabel(id);
    }
  }, [id, job?.jobNumber, setLabel, clearLabel]);

  const mapped = useMemo(() => (job ? fromJob(job) : null), [job]);
  const data = localData ?? mapped ?? {};

  const set = useCallback(
    (key: string, value: unknown) => setLocalData((prev) => ({ ...(prev ?? mapped ?? {}), [key]: value })),
    [mapped],
  );

  function applyUpdatedJob(updated: FabricationJob) {
    queryClient.setQueryData(['fabrication-job', id], updated);
    queryClient.invalidateQueries({ queryKey: ['fabrication-jobs'] });
  }

  const transition = useMutation({
    mutationFn: (toStatusCode: string) => fabricationService.transition(id, toStatusCode),
    onSuccess: (updated, toStatusCode) => {
      applyUpdatedJob(updated);
      toast.success(`Moved to ${statusToastLabel(FJ_STATUS_CODES, toStatusCode)}.`);
    },
  });

  const save = useMutation({
    mutationFn: () => fabricationService.updateJob(id, toJobFields(data)),
    onSuccess: (updated) => {
      applyUpdatedJob(updated);
      navigate('/sales/installation');
    },
  });

  if (isLoading) return <div className="p-6"><Spinner label="Loading fabrication job…" /></div>;
  if (loadError || !job)
    return <div className="p-6"><ErrorNote>{apiErrorMessage(loadError, 'Failed to load fabrication job.')}</ErrorNote></div>;

  const saveError = save.error ?? transition.error;
  const canUpdate = hasPermission('installation', 'update');
  const canAllocateSlabs = canUpdate && hasPermission('inventory_item', 'update');
  const canReadSlabs = hasPermission('installation', 'read') && hasPermission('inventory_item', 'read');
  const piecesEditableNow = canUpdate && canEditPieces(job.statusCode);

  return (
    <div className="flex flex-col flex-1 min-h-0 bg-stone-50">
      <form
        onSubmit={(e) => { e.preventDefault(); save.mutate(); }}
        className="flex flex-col flex-1 min-h-0"
      >
        <CrmPageHeader
          backLabel="Installation / Fabrication"
          onBack={() => navigate('/sales/installation')}
          icon={Wrench}
          title={job.jobNumber || 'Fabrication Job'}
          subtitle={job.customer.name}
          actions={(
            <button type="submit" disabled={save.isPending}
              className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-3.5 py-1.5 text-xs font-semibold text-stone-900 hover:bg-brand-hover disabled:opacity-50 transition-all shadow-sm">
              {save.isPending ? <Loader2 className="size-3 animate-spin" /> : <Save className="size-3" />}
              {save.isPending ? 'Saving…' : 'Save Changes'}
            </button>
          )}
        />

        {saveError && (
          <div className="shrink-0 flex items-start gap-3 border-b border-red-200 bg-red-50 px-5 py-2.5">
            <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-red-100">
              <AlertCircle className="size-3 text-red-600" />
            </span>
            <p className="text-xs text-red-700">
              <span className="font-bold">Error: </span>
              {apiErrorMessage(saveError, 'Failed to save fabrication job.')}
            </p>
          </div>
        )}

        <FabricationJobFormBody
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          jobId={id}
          job={job}
          data={data}
          set={set}
          sourceOrder={null}
          pieces={[]}
          sourceOrderItems={sourceOrderItems}
          lookups={lookups}
          canAllocateSlabs={canReadSlabs && canAllocateSlabs}
          canEditSteps={canUpdate}
          piecesEditableNow={piecesEditableNow}
          statusControl={canUpdate ? (
            <FabricationStatusControl
              job={job}
              onChange={(code) => transition.mutate(code)}
              disabled={transition.isPending}
            />
          ) : undefined}
          holdResumeControl={canUpdate ? (
            <FabricationHoldResumeControl job={job} disabled={transition.isPending} onChanged={applyUpdatedJob} />
          ) : undefined}
        />

        <FormActionBar
          onCancel={() => navigate('/sales/installation')}
          isPending={save.isPending}
        />
      </form>
    </div>
  );
}
