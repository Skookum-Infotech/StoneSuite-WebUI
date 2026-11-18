import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import { useFabricationAction } from '@/hooks/useFabricationAction';
import { tenantClient } from '@/api/tenantClient';
import { Unlink } from 'lucide-react';
import { cn } from '@/lib/utils';
import { apiErrorMessage } from '@/api/tenantClient';
import { Spinner } from '@/components/tenant/ui';
import { fabricationService } from '@/services/fabricationService';

import { buttonVariants } from '@/components/ui/button';
// The slabs held for a job, each with its allocation status. `slab.status` here is
// the job-allocation status (reserved/consumed/released), not the slab's own
// physical status — see the FabricationSlab type's doc comment. A reserved slab
// can be released; a consumed one cannot.
export function FabricationAllocatedSlabs({ jobId, canRelease, workflowVersion, version }: { jobId: string; canRelease: boolean; workflowVersion?: number; version?: number }) {
  const queryClient = useQueryClient();
  const { data: slabs = [], isLoading, error } = useQuery({
    queryKey: ['fabrication-job-slabs', jobId],
    queryFn: () => fabricationService.getJobSlabs(jobId),
  });

  const legacyRelease = useMutation({
    mutationFn: (slabId: string) => fabricationService.deallocateSlab(jobId, slabId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fabrication-job-slabs', jobId] });
      queryClient.invalidateQueries({ queryKey: ['fabrication-job-materials', jobId] });
      queryClient.invalidateQueries({ queryKey: ['fabrication-job', jobId] });
      queryClient.invalidateQueries({ queryKey: ['inventory-units'] });
    },
  });

  const actionRelease = useFabricationAction({
    version: version ?? 0,
    execute: (meta, input: { slabId: string }) => tenantClient.post(`/tenant/fabrication-jobs/${encodeURIComponent(jobId)}/material-releases`, { ...meta, ...input }),
    onSuccess: () => {
      for (const queryKey of [['fabrication-job-slabs', jobId], ['fabrication-job-materials', jobId], ['fabrication-job', jobId], ['fabrication-wip-options', jobId], ['inventory-units']]) void queryClient.invalidateQueries({ queryKey });
    },
  });
  const release = workflowVersion === 2 ? actionRelease : legacyRelease;
  const conflict = isAxiosError(release.error) && release.error.response?.status === 409;

  if (isLoading) return <div className="flex justify-center py-6"><Spinner label="Loading slabs…" /></div>;
  if (error) return <p className="py-6 text-center type-error">Failed to load slabs.</p>;

  return (
    <div>
      <div className="overflow-x-auto modal-scrollbar rounded-lg border border-stone-200 bg-white">
        <table className="w-full text-left type-cell" aria-label="Slabs allocated to this job">
          <thead className="border-b border-stone-200 bg-stone-50">
            <tr>
              {['Serial', 'Form', 'Area', 'Allocation', 'Grade', 'Finish', ''].map((h, i) => (
                <th key={h || `col-${i}`} className="whitespace-nowrap px-3 py-2.5 type-th">
                  {h || <span className="sr-only">Actions</span>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {slabs.map((slab) => (
              <tr key={slab.id} className="hover:bg-stone-50/50">
                <td className="px-3 py-2.5 type-record-id">{slab.serial}</td>
                <td className="type-cell px-3 py-2.5 capitalize">{slab.form}</td>
                <td className="type-cell px-3 py-2.5 tabular-nums">{slab.area}</td>
                <td className="px-3 py-2.5"><AllocationBadge status={slab.status} /></td>
                <td className="type-cell px-3 py-2.5">{slab.grade || '—'}</td>
                <td className="type-cell px-3 py-2.5">{slab.finish || '—'}</td>
                <td className="px-3 py-2.5 text-right">
                  {canRelease && (workflowVersion !== 2 || version !== undefined) && slab.status === 'reserved' && (
                    <button
                      type="button"
                      onClick={() => workflowVersion === 2 ? actionRelease.run({ slabId: slab.id }) : legacyRelease.mutate(slab.id)}
                      disabled={release.isPending || conflict}
                      aria-label={`Release slab ${slab.serial}`}
                      className={buttonVariants({ variant: 'outline', size: 'sm' })}
                    >
                      <Unlink className="size-3" aria-hidden="true" /> Release
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {slabs.length === 0 && (
              <tr><td colSpan={7} className="type-cell py-8 text-center">No slabs allocated to this job yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
      {conflict && workflowVersion === 2 && <button type="button" className="min-h-11 text-body type-link" onClick={async () => { await Promise.all([queryClient.invalidateQueries({ queryKey: ['fabrication-job', jobId] }), queryClient.invalidateQueries({ queryKey: ['fabrication-job-slabs', jobId] })]); actionRelease.resetForLatest(); }}>Refresh job and review again</button>}
      {release.isError && (
        <p role="alert" className="mt-1.5 type-error">{apiErrorMessage(release.error, 'Failed to release the slab.')}</p>
      )}
    </div>
  );
}

function AllocationBadge({ status }: { status: string }) {
  const color =
    status === 'consumed' ? 'bg-amber-100 text-amber-700' :
    status === 'reserved' ? 'bg-sky-100 text-sky-700' :
    'bg-stone-100 text-ink';
  return <span className={cn('inline-flex items-center rounded px-1.5 py-0.5 capitalize type-pill', color)}>{status}</span>;
}
