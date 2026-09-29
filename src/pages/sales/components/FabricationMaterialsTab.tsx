import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Spinner } from '@/components/tenant/ui';
import { useUserPermissions } from '@/hooks/useUserPermissions';
import { fabricationService } from '@/services/fabricationService';
import { asShortage } from '@/lib/fabricationMaterials';
import { openRequisitionForShortages } from '@/lib/requisitionPrefill';
import type { FabricationJobPiece, FabricationMaterial } from '@/types/fabrication';
import { AllocateSlabsDialog } from './AllocateSlabsDialog';
import { FabricationAllocatedSlabs } from './FabricationAllocatedSlabs';
import { FabricationMaterialCard } from './FabricationMaterialCard';

// Where the stone for a job is worked out and held. Each slab material on the
// job's sales order shows what the blueprint needs against what is allocated, and
// slabs are picked from stock here. A job cannot move to Cutting until every
// material is covered — cutting is the step that takes the stone out of stock.
//
// Needs installation:read AND inventory_item:read server-side; the Detail page
// only renders this tab when the caller holds both grants.
export function FabricationMaterialsTab({ jobId, pieces, canAllocate }: {
  jobId: string;
  pieces: FabricationJobPiece[];
  canAllocate: boolean;
}) {
  const { hasPermission } = useUserPermissions();
  // Picking from stock lists slabs, which is its own grant; restocking starts a
  // requisition, which is another.
  const canPick = canAllocate && hasPermission('inventory_unit', 'read');
  const canRestock = hasPermission('requisition', 'create');
  const [picking, setPicking] = useState<FabricationMaterial | null>(null);

  const { data: materials = [], isLoading, error } = useQuery({
    queryKey: ['fabrication-job-materials', jobId],
    queryFn: () => fabricationService.getJobMaterials(jobId),
  });

  if (isLoading) return <div className="flex justify-center py-8"><Spinner label="Loading materials…" /></div>;
  if (error) return <p className="py-8 text-center text-xs text-destructive/70">Failed to load materials.</p>;

  const uncovered = materials.filter((m) => m.shortfall > 0).length;

  return (
    <div className="space-y-4">
      {materials.length === 0 ? (
        <p className="rounded-lg border border-stone-200 bg-white p-4 text-xs text-stone-500">
          This job&apos;s sales order has no slab material lines, so there is nothing to allocate against. Add a slab
          item from your inventory to the order to work out the stone this job needs.
        </p>
      ) : (
        <>
          <p className="text-xs text-stone-500" aria-live="polite">
            {uncovered === 0
              ? 'Every material is covered — this job has the stone it needs to be cut.'
              : `${uncovered} ${uncovered === 1 ? 'material needs' : 'materials need'} more slab allocated before this job can move to Cutting.`}
          </p>
          <div className="space-y-3">
            {materials.map((m) => {
              const shortage = asShortage(m);
              return (
                <FabricationMaterialCard
                  key={m.itemId}
                  material={m}
                  onAllocate={canPick ? () => setPicking(m) : undefined}
                  onRestock={canRestock && shortage ? () => openRequisitionForShortages([shortage]) : undefined}
                />
              );
            })}
          </div>
        </>
      )}

      <div>
        <h4 className="mb-2 text-xs font-semibold text-stone-500">Allocated slabs</h4>
        <FabricationAllocatedSlabs jobId={jobId} canRelease={canAllocate} />
      </div>

      {picking && (
        <AllocateSlabsDialog jobId={jobId} material={picking} pieces={pieces} onClose={() => setPicking(null)} />
      )}
    </div>
  );
}
