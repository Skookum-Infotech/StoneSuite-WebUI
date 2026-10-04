import { useState } from 'react';
import { isAxiosError } from 'axios';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { tenantClient, apiErrorMessage } from '@/api/tenantClient';
import { fieldCls } from '@/components/crm/formUtils';
import { useFabricationAction } from '@/hooks/useFabricationAction';
import { fabricationTemplateService } from '@/services/fabricationTemplateService';
import { inventoryUnitService } from '@/services/inventoryUnitService';

type Placement = { pieceIndex: number; xMm: number; yMm: number; rotated: boolean };
type LayoutInput = { slabId: string; templateId: string; sourceLineId: string; layout: { placements: Placement[]; kerfMm: number; suitabilityConfirmed: boolean; reviewNote: string } };

/** Explicit operator-reviewed placements; the server validates and reserves atomically. */
export function FabricationLayoutAllocation({ jobId, version }: { jobId: string; version: number }) {
  const client = useQueryClient();
  const [lineId, setLineId] = useState('');
  const [slabId, setSlabId] = useState('');
  const [search, setSearch] = useState('');
  const [placements, setPlacements] = useState<Placement[]>([]);
  const [kerfMm, setKerf] = useState(3);
  const [reviewNote, setNote] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [saved, setSaved] = useState(false);
  const templates = useQuery({ queryKey: ['fabrication-templates', jobId], queryFn: () => fabricationTemplateService.list(jobId) });
  const template = templates.data?.find((item) => item.state === 'approved');
  const line = template?.lines.find((item) => item.sourceLineId === lineId);
  const units = useQuery({
    queryKey: ['inventory-units', 'layout', line?.materialId, search],
    enabled: Boolean(line),
    queryFn: () => inventoryUnitService.searchUnits({ search: search || undefined, filters: [{ field: 'item_id', op: 'eq', value: line?.materialId ?? '' }, { field: 'status', op: 'eq', value: 'available' }], limit: 100 }),
  });
  const candidates = units.data?.records.filter((unit) => unit.inspectionStatus === 'accepted') ?? [];
  const slab = candidates.find((unit) => unit.id === slabId);
  const refresh = async () => {
    await Promise.all([['fabrication-job', jobId], ['fabrication-templates', jobId], ['fabrication-job-slabs', jobId], ['fabrication-job-materials', jobId], ['fabrication-wip-options', jobId], ['inventory-units']].map((queryKey) => client.invalidateQueries({ queryKey })));
  };
  const action = useFabricationAction({
    version,
    execute: (meta, input: LayoutInput) => tenantClient.post(`/tenant/fabrication-jobs/${encodeURIComponent(jobId)}/material-allocations`, { ...meta, ...input }),
    onSuccess: () => { setSaved(true); setSlabId(''); setPlacements([]); setConfirmed(false); setNote(''); void refresh(); },
  });
  const conflict = isAxiosError(action.error) && action.error.response?.status === 409;
  const updatePlacement = (index: number, patch: Partial<Placement>) => { setConfirmed(false); setPlacements((items) => items.map((item) => item.pieceIndex === index ? { ...item, ...patch } : item)); };
  return <section className="space-y-4 rounded-xl border border-stone-200 bg-white p-4 sm:p-5" aria-labelledby="layout-heading">
    <div><h3 id="layout-heading" className="text-sm font-semibold">Review layout and reserve material</h3><p className="mt-1 text-xs text-stone-500">Place measured pieces on one slab or reusable remnant. All dimensions are millimetres, measured from the top-left corner. Remaining pieces can use another slab.</p></div>
    {templates.isLoading && <p role="status">Loading approved measurements…</p>}
    {templates.error && <p role="alert">Unable to load template revisions.</p>}
    {templates.isSuccess && !template && <p className="text-sm text-amber-800">Approve a measured template before reserving material.</p>}
    {template && <form className="space-y-4" onSubmit={(event) => { event.preventDefault(); setSaved(false); if (slab && line && confirmed && placements.length) action.run({ slabId, templateId: template.id, sourceLineId: lineId, layout: { placements, kerfMm, suitabilityConfirmed: confirmed, reviewNote } }); }}>
      <fieldset disabled={action.isPending} className="space-y-4">
        <label className="block text-xs font-medium">Approved template line<select className={fieldCls} value={lineId} required onChange={(event) => { setLineId(event.target.value); setSlabId(''); setPlacements([]); setConfirmed(false); }}><option value="">Choose measured work</option>{template.lines.map((item, index) => <option key={item.sourceLineId} value={item.sourceLineId}>Line {index + 1} · {item.scope || item.pieces.map((piece) => piece.name).join(', ')} · {item.pieces.length} pieces</option>)}</select></label>
        {line && <>
          <p className="text-xs text-stone-600">Required finish: {line.finish || 'Confirm during physical review'}</p>
          <label className="block text-xs font-medium">Find slab or remnant<input className={fieldCls} value={search} onChange={(event) => { setSearch(event.target.value); setSlabId(''); setConfirmed(false); }} placeholder="Search serial number" /></label>
          {units.isLoading && <p role="status">Loading material…</p>}
          {units.error && <p role="alert">Unable to load available material.</p>}
          <label className="block text-xs font-medium">Inspected material<select className={fieldCls} required value={slabId} onChange={(event) => { setSlabId(event.target.value); setConfirmed(false); }}><option value="">Choose an accepted slab or remnant</option>{candidates.map((unit) => <option key={unit.id} value={unit.id}>{unit.serial} · {unit.form} · {unit.lengthMm} × {unit.widthMm} × {unit.thicknessMm} mm · {unit.finish || 'Finish unspecified'}</option>)}</select></label>
          {units.isSuccess && !candidates.length && <p className="text-xs text-amber-800">No accepted material in these results. Check receipt inspection or search another serial number.</p>}
          {units.data?.hasMore && <p className="text-xs text-stone-500">Showing the first 100 results. Narrow the serial search to find more material.</p>}
          <div className="space-y-2">{line.pieces.map((piece, index) => {
            const placement = placements.find((item) => item.pieceIndex === index);
            return <div key={index} className="rounded-lg border border-stone-200 p-3 space-y-2">
              <label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" checked={Boolean(placement)} onChange={(event) => { setConfirmed(false); setPlacements((items) => event.target.checked ? [...items, { pieceIndex: index, xMm: 0, yMm: 0, rotated: false }] : items.filter((item) => item.pieceIndex !== index)); }} />{piece.name} · {piece.lengthMm} × {piece.widthMm} × {piece.thicknessMm} mm</label>
              {placement && <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                <label className="text-xs">X position<input aria-label={`${piece.name} X position`} className={fieldCls} type="number" min="0" step="any" required value={placement.xMm} onChange={(event) => updatePlacement(index, { xMm: event.target.valueAsNumber })} /></label>
                <label className="text-xs">Y position<input aria-label={`${piece.name} Y position`} className={fieldCls} type="number" min="0" step="any" required value={placement.yMm} onChange={(event) => updatePlacement(index, { yMm: event.target.valueAsNumber })} /></label>
                <label className="flex min-h-11 items-center gap-2 text-xs"><input type="checkbox" checked={placement.rotated} onChange={(event) => updatePlacement(index, { rotated: event.target.checked })} />Rotate 90°</label>
              </div>}
            </div>;
          })}</div>
          {slab && slab.lengthMm > 0 && slab.widthMm > 0 && <figure className="rounded-lg bg-stone-100 p-3"><svg role="img" aria-label="Proposed slab layout" viewBox={`0 0 ${slab.lengthMm} ${slab.widthMm}`} className="max-h-72 w-full border border-stone-400 bg-white"><title>Proposed layout; placement validation occurs when reserving</title>{placements.map((placement) => { const piece = line.pieces[placement.pieceIndex]; return <rect key={placement.pieceIndex} x={placement.xMm} y={placement.yMm} width={placement.rotated ? piece.widthMm : piece.lengthMm} height={placement.rotated ? piece.lengthMm : piece.widthMm} fill="#99c9c1" fillOpacity="0.65" stroke="#225e54" strokeWidth={Math.max(slab.lengthMm / 500, 1)}><title>{piece.name}</title></rect>; })}</svg><figcaption className="mt-2 text-xs text-stone-600">Rectangular preview only. Review the physical outline, grain and defects; the server checks dimensions, thickness, finish, overlap and kerf on reservation.</figcaption></figure>}
          <label className="block text-xs font-medium">Saw kerf (mm)<input className={fieldCls} type="number" min="0" step="any" required value={kerfMm} onChange={(event) => { setKerf(event.target.valueAsNumber); setConfirmed(false); }} /></label>
          <label className="block text-xs font-medium">Layout review notes<textarea className={fieldCls} required value={reviewNote} onChange={(event) => setNote(event.target.value)} placeholder="Record grain direction, finish, defects and remnant outline checks" rows={3} /></label>
          <label className="flex min-h-11 items-center gap-2 text-xs"><input type="checkbox" required checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} />I have checked that these pieces suit the physical material.</label>
        </>}
        <button type="submit" disabled={!slab || !placements.length || !confirmed || !reviewNote.trim() || conflict} className="min-h-11 rounded-lg bg-brand px-4 text-sm font-semibold disabled:opacity-50">{action.isPending ? 'Reserving material…' : 'Confirm layout and reserve'}</button>
      </fieldset>
      {action.error && <p role="alert" className="text-sm text-destructive">{apiErrorMessage(action.error, 'Unable to reserve material. Your layout has been retained.')}</p>}
      {conflict && <button type="button" className="min-h-11 text-sm underline" onClick={async () => { await refresh(); setConfirmed(false); action.resetForLatest(); }}>Refresh job and review again</button>}
    </form>}
    {saved && <p role="status" className="text-sm text-emerald-800">Layout saved and material reserved.</p>}
  </section>;
}
