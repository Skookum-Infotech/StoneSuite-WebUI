import { isAxiosError } from 'axios';
import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { tenantClient, apiErrorMessage } from '@/api/tenantClient';
import { inventoryBinService } from '@/services/inventoryBinService';
import { useFabricationAction } from '@/hooks/useFabricationAction';
import { fieldCls } from '@/components/crm/formUtils';
import type { AvailableAction } from '@/types/fabricationActions';

type WipOption = { slabId: string; serial: string; warehouseId: string; action: AvailableAction };

export function FabricationWipTransfers({ jobId, version }: { jobId: string; version: number }) {
  const client = useQueryClient();
  const [slabId, setSlabId] = useState('');
  const [binId, setBinId] = useState('');
  const [note, setNote] = useState('');
  const [saved, setSaved] = useState(false);
  const base = `/tenant/fabrication-jobs/${encodeURIComponent(jobId)}`;
  const options = useQuery({ queryKey: ['fabrication-wip-options', jobId], queryFn: () => tenantClient.get<{ options: WipOption[] }>(`${base}/wip-options`).then(({ data }) => data.options) });
  const bins = useQuery({ queryKey: ['inventory-wip-bins'], queryFn: () => inventoryBinService.listBins().then((items) => items.filter((bin) => bin.isWip && bin.isActive)) });
  const selected = options.data?.find((option) => option.slabId === slabId);
  const action = useFabricationAction({
    version,
    execute: (meta, input: { slabId: string; binId: string; note: string }) => tenantClient.post(`${base}/wip-transfers`, { ...meta, ...input }),
    onSuccess: () => {
      setSaved(true); setSlabId(''); setBinId(''); setNote('');
      for (const queryKey of [['fabrication-job', jobId], ['fabrication-wip-options', jobId], ['fabrication-job-slabs', jobId], ['inventory-units'], ['inventory-bins-tree']]) void client.invalidateQueries({ queryKey });
    },
  });
  return <section className="rounded-xl border border-stone-200 bg-white p-4 sm:p-5 space-y-4" aria-labelledby="wip-heading">
    <div><h3 id="wip-heading" className="text-sm font-semibold text-stone-900">Move material to the workshop</h3><p className="mt-1 text-xs text-stone-500">Move an inspected, allocated slab into a shared WIP area or a saw’s work area. Moving material does not consume stock.</p></div>
    {(options.isLoading || bins.isLoading) && <p role="status" className="text-sm">Loading work areas…</p>}
    {(options.error || bins.error) && <p role="alert" className="text-sm text-destructive">Unable to load material or work areas.</p>}
    {options.data?.length === 0 && <p className="text-sm text-stone-500">No material is available to move with your current permissions.</p>}
    {options.data && options.data.length > 0 && <form className="space-y-3" onSubmit={(event) => { event.preventDefault(); setSaved(false); if (selected?.action.enabled && binId) action.run({ slabId, binId, note }); }}>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="space-y-1 text-xs font-medium">Allocated slab<select aria-label="Allocated slab" className={fieldCls} value={slabId} onChange={(event) => { setSlabId(event.target.value); setBinId(''); }} required disabled={action.isPending}><option value="">Choose a slab</option>{options.data.map((option) => <option key={option.slabId} value={option.slabId}>{option.serial}</option>)}</select></label>
        <label className="space-y-1 text-xs font-medium">Destination WIP bin<select aria-label="Destination WIP bin" className={fieldCls} value={binId} onChange={(event) => setBinId(event.target.value)} required disabled={action.isPending}><option value="">Choose a work area</option>{bins.data?.filter((bin) => bin.warehouseId === selected?.warehouseId).map((bin) => <option key={bin.id} value={bin.id}>{bin.warehouseName} · {bin.path} · {bin.machineLabel || 'Shared WIP'}</option>)}</select></label>
      </div>
      {bins.data?.length === 0 && <p className="text-xs text-stone-500">Create an active WIP bin in inventory before moving material.</p>}
      {selected?.action.blockers?.map((blocker) => <p key={blocker.code} className="text-xs text-amber-800">{blocker.message}</p>)}
      <label className="block space-y-1 text-xs font-medium">Movement note (optional)<textarea className={fieldCls} value={note} onChange={(event) => setNote(event.target.value)} disabled={action.isPending} rows={2} /></label>
      {action.error && <p role="alert" className="text-sm text-destructive">{apiErrorMessage(action.error, 'Unable to move material. Your selections have been retained.')}</p>}
      {isAxiosError(action.error) && action.error.response?.status === 409 && <button type="button" className="min-h-11 text-sm underline" onClick={async () => { await Promise.all([options.refetch(), client.invalidateQueries({ queryKey: ['fabrication-job', jobId] })]); action.resetForLatest(); }}>Refresh job and review again</button>}
      <button type="submit" disabled={!selected?.action.enabled || !binId || action.isPending} className="min-h-11 rounded-lg bg-brand px-4 text-sm font-semibold text-stone-950 disabled:opacity-50">{action.isPending ? 'Moving material…' : selected?.action.label || 'Move to WIP'}</button>
    </form>}
    {saved && <p role="status" className="text-sm text-emerald-800">Material moved to WIP.</p>}
  </section>;
}
