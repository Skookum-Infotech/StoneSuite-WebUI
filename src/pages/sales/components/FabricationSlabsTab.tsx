import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2, Plus, Unlink } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Spinner } from '@/components/tenant/ui';
import { fieldCls } from '@/components/crm/formUtils';
import { fabricationService } from '@/services/fabricationService';
import { apiErrorMessage } from '@/api/tenantClient';
import type { FabricationJobPiece } from '@/types/fabrication';

// Slabs allocated to this job. Needs installation:read AND inventory_item:read
// server-side — the Detail page only renders this tab when the caller holds
// both grants (see FabricationJobDetailPage). `slab.status` here is actually
// the job-allocation status (reserved/consumed/released), not the slab's own
// physical status — see the Slab type's doc comment.
//
// There is no slab search/list endpoint (only GET by uuid), so allocating a
// slab takes a pasted slab uuid rather than a searchable picker — flagged to
// the user as a backend follow-up, not silently worked around.
export function FabricationSlabsTab({ jobId, pieces, canAllocate }: {
  jobId: string;
  pieces: FabricationJobPiece[];
  canAllocate: boolean;
}) {
  const queryClient = useQueryClient();
  const [slabUuid, setSlabUuid] = useState('');
  const [pieceUuid, setPieceUuid] = useState('');

  const { data: slabs = [], isLoading, error } = useQuery({
    queryKey: ['fabrication-job-slabs', jobId],
    queryFn: () => fabricationService.getJobSlabs(jobId),
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['fabrication-job-slabs', jobId] });
    queryClient.invalidateQueries({ queryKey: ['fabrication-job', jobId] });
  };

  const allocate = useMutation({
    mutationFn: () => fabricationService.allocateSlab(jobId, slabUuid.trim(), pieceUuid || undefined),
    onSuccess: () => {
      setSlabUuid('');
      setPieceUuid('');
      invalidate();
    },
  });

  const deallocate = useMutation({
    mutationFn: (slabId: string) => fabricationService.deallocateSlab(jobId, slabId),
    onSuccess: invalidate,
  });

  if (isLoading) return <div className="py-8 flex justify-center"><Spinner label="Loading slabs…" /></div>;
  if (error) return <p className="py-8 text-center text-xs text-destructive/70">Failed to load slabs.</p>;

  return (
    <div className="space-y-3">
      {canAllocate && (
        <div className="rounded-lg border border-stone-200 bg-white p-3">
          <p className="mb-2 text-2xs font-semibold uppercase tracking-wide text-stone-400">Allocate a Slab</p>
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="text"
              value={slabUuid}
              onChange={(e) => setSlabUuid(e.target.value)}
              placeholder="Slab UUID (from the inventory slab record)"
              className={cn(fieldCls, 'h-8 flex-1 min-w-[220px]')}
              aria-label="Slab UUID"
            />
            {pieces.length > 0 && (
              <select
                value={pieceUuid}
                onChange={(e) => setPieceUuid(e.target.value)}
                className={cn(fieldCls, 'h-8 w-44')}
                aria-label="Piece to allocate to"
              >
                <option value="">— Whole job —</option>
                {pieces.map((p) => (
                  <option key={p.id} value={p.id}>{p.pieceName || `Piece ${p.pieceNumber}`}</option>
                ))}
              </select>
            )}
            <button
              type="button"
              onClick={() => allocate.mutate()}
              disabled={!slabUuid.trim() || allocate.isPending}
              className="inline-flex items-center gap-1.5 rounded-md bg-brand px-3 py-1.5 text-xs font-semibold text-stone-900 hover:bg-brand-hover disabled:opacity-50 transition-colors"
            >
              {allocate.isPending ? <Loader2 className="size-3 animate-spin" /> : <Plus className="size-3" />}
              Allocate
            </button>
          </div>
          {allocate.isError && (
            <p className="mt-1.5 text-2xs text-destructive">{apiErrorMessage(allocate.error, 'Failed to allocate slab.')}</p>
          )}
        </div>
      )}

      <div className="overflow-x-auto modal-scrollbar rounded-lg border border-stone-200 bg-white">
        <table className="w-full text-left text-xs">
          <thead className="bg-stone-50 border-b border-stone-200">
            <tr>
              {['Serial', 'Form', 'Area', 'Allocation', 'Grade', 'Finish', ''].map((h) => (
                <th key={h} className="px-3 py-2.5 text-2xs font-semibold uppercase tracking-wide text-stone-500 whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {slabs.map((slab) => (
              <tr key={slab.id} className="hover:bg-stone-50/50">
                <td className="px-3 py-2.5 font-mono text-2xs text-stone-700">{slab.serial}</td>
                <td className="px-3 py-2.5 text-stone-500 capitalize">{slab.form}</td>
                <td className="px-3 py-2.5 tabular-nums text-stone-600">{slab.area}</td>
                <td className="px-3 py-2.5">
                  <AllocationBadge status={slab.status} />
                </td>
                <td className="px-3 py-2.5 text-stone-500">{slab.grade || '—'}</td>
                <td className="px-3 py-2.5 text-stone-500">{slab.finish || '—'}</td>
                <td className="px-3 py-2.5 text-right">
                  {canAllocate && slab.status === 'reserved' && (
                    <button
                      type="button"
                      onClick={() => deallocate.mutate(slab.id)}
                      disabled={deallocate.isPending}
                      aria-label={`Release slab ${slab.serial}`}
                      className="inline-flex items-center gap-1 rounded-md border border-stone-200 bg-white px-2 py-1 text-2xs font-medium text-stone-600 hover:bg-stone-50 disabled:opacity-50 transition-colors"
                    >
                      <Unlink className="size-3" /> Release
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
