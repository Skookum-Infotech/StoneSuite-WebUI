import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ShieldCheck, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { inventoryUnitService } from '@/services/inventoryUnitService';
import { apiErrorMessage } from '@/api/tenantClient';
import type { InventoryUnit } from '@/types/inventory';

export function UnitInspectionPanel({ unit, canInspect }: { unit: InventoryUnit; canInspect: boolean }) {
  const [reason, setReason] = useState('');
  const client = useQueryClient();
  const inspection = useMutation({
    mutationFn: (decision: 'accepted' | 'rejected') => inventoryUnitService.inspect(unit.id, { decision, reason }),
    onSuccess: (_, decision) => {
      toast.success(decision === 'accepted' ? 'Slab accepted after inspection.' : 'Entire slab rejected. It is unavailable for fabrication.');
      for (const key of ['inventory-unit', 'inventory-units', 'inventory-unit-history', 'fabrication-materials']) void client.invalidateQueries({ queryKey: [key] });
    },
  });
  if (!unit.inspectionStatus || unit.inspectionStatus === 'legacy') return null;
  const rejected = unit.inspectionStatus === 'rejected';
  const accepted = unit.inspectionStatus === 'accepted';
  return <section aria-label="Receipt inspection" className="mx-4 my-4 rounded-xl border border-stone-200 bg-white p-5 sm:mx-5">
    <div className="flex items-start gap-3">{accepted ? <ShieldCheck className="size-5 shrink-0 text-emerald-700" aria-hidden="true" /> : <AlertTriangle className="size-5 shrink-0 text-amber-700" aria-hidden="true" />}<div><h2 className="font-semibold text-stone-900">{accepted ? 'Inspection passed' : rejected ? 'Slab rejected' : 'Receipt inspection required'}</h2><p className="mt-1 text-sm text-stone-600">{accepted ? 'This slab can be allocated to production.' : rejected ? 'Keep this slab out of production and arrange a supplier replacement or refund. Moving bins does not clear the rejection.' : 'Check the entire slab before allocating or cutting it.'}</p></div></div>
    {!accepted && !rejected && canInspect && <div className="mt-4 space-y-3"><label className="block text-sm font-medium text-stone-700">Inspection findings<textarea value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Describe damage or other findings. Required when rejecting." className="mt-1 block min-h-20 w-full rounded-lg border border-stone-200 p-3 text-sm" /></label><div className="flex flex-wrap gap-2"><button type="button" aria-label="Accept slab after inspection" disabled={inspection.isPending} onClick={() => inspection.mutate('accepted')} className="min-h-11 rounded-lg bg-stone-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">Accept slab</button><button type="button" aria-label="Reject entire slab" disabled={inspection.isPending || !reason.trim()} onClick={() => inspection.mutate('rejected')} className="min-h-11 rounded-lg border border-red-200 px-4 py-2 text-sm font-semibold text-red-700 disabled:opacity-50">Reject entire slab</button></div></div>}
    {inspection.isError && <p role="alert" className="mt-3 text-sm text-red-700">{apiErrorMessage(inspection.error, 'Inspection could not be recorded.')}</p>}
  </section>;
}
