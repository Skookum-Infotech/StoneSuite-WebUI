import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Unlink } from 'lucide-react';
import { cn } from '@/lib/utils';
import { apiErrorMessage } from '@/api/tenantClient';
import { Spinner } from '@/components/tenant/ui';
import { fabricationService } from '@/services/fabricationService';

// The slabs held for a job, each with its allocation status. `slab.status` here is
// the job-allocation status (reserved/consumed/released), not the slab's own
// physical status — see the FabricationSlab type's doc comment. A reserved slab
// can be released; a consumed one cannot.
export function FabricationAllocatedSlabs({ jobId, canRelease }: { jobId: string; canRelease: boolean }) {
  const queryClient = useQueryClient();
  const { data: slabs = [], isLoading, error } = useQuery({
    queryKey: ['fabrication-job-slabs', jobId],
    queryFn: () => fabricationService.getJobSlabs(jobId),
  });

  const release = useMutation({
    mutationFn: (slabId: string) => fabricationService.deallocateSlab(jobId, slabId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fabrication-job-slabs', jobId] });
      queryClient.invalidateQueries({ queryKey: ['fabrication-job-materials', jobId] });
      queryClient.invalidateQueries({ queryKey: ['fabrication-job', jobId] });
      queryClient.invalidateQueries({ queryKey: ['inventory-units'] });
    },
  });

  if (isLoading) return <div className="flex justify-center py-6"><Spinner label="Loading slabs…" /></div>;
  if (error) return <p className="py-6 text-center text-xs text-destructive/70">Failed to load slabs.</p>;

  return (
    <div>
      <div className="overflow-x-auto modal-scrollbar rounded-lg border border-stone-200 bg-white">
        <table className="w-full text-left text-xs" aria-label="Slabs allocated to this job">
          <thead className="border-b border-stone-200 bg-stone-50">
            <tr>
              {['Serial', 'Form', 'Area', 'Allocation', 'Grade', 'Finish', ''].map((h, i) => (
                <th key={h || `col-${i}`} className="whitespace-nowrap px-3 py-2.5 text-2xs font-semibold uppercase tracking-wide text-stone-500">
                  {h || <span className="sr-only">Actions</span>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {slabs.map((slab) => (
              <tr key={slab.id} className="hover:bg-stone-50/50">
                <td className="px-3 py-2.5 font-mono text-2xs text-stone-700">{slab.serial}</td>
                <td className="px-3 py-2.5 capitalize text-stone-500">{slab.form}</td>
                <td className="px-3 py-2.5 tabular-nums text-stone-600">{slab.area}</td>
                <td className="px-3 py-2.5"><AllocationBadge status={slab.status} /></td>
                <td className="px-3 py-2.5 text-stone-500">{slab.grade || '—'}</td>
                <td className="px-3 py-2.5 text-stone-500">{slab.finish || '—'}</td>
                <td className="px-3 py-2.5 text-right">
                  {canRelease && slab.status === 'reserved' && (
                    <button
                      type="button"
                      onClick={() => release.mutate(slab.id)}
                      disabled={release.isPending}
                      aria-label={`Release slab ${slab.serial}`}
                      className="inline-flex items-center gap-1 rounded-md border border-stone-200 bg-white px-2 py-1 text-2xs font-medium text-stone-600 hover:bg-stone-50 disabled:opacity-50 transition-colors"
                    >
                      <Unlink className="size-3" aria-hidden="true" /> Release
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {slabs.length === 0 && (
              <tr><td colSpan={7} className="py-8 text-center text-stone-400">No slabs allocated to this job yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
      {release.isError && (
        <p role="alert" className="mt-1.5 text-2xs text-destructive">{apiErrorMessage(release.error, 'Failed to release the slab.')}</p>
      )}
    </div>
  );
}

function AllocationBadge({ status }: { status: string }) {
  const color =
    status === 'consumed' ? 'bg-amber-100 text-amber-700' :
    status === 'reserved' ? 'bg-sky-100 text-sky-700' :
    'bg-stone-100 text-stone-600';
  return <span className={cn('inline-flex items-center rounded px-1.5 py-0.5 text-2xs font-semibold capitalize', color)}>{status}</span>;
}
