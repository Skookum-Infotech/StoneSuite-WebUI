import { useState } from 'react';
import { Link } from 'react-router-dom';
import { isAxiosError } from 'axios';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { tenantClient, apiErrorMessage } from '@/api/tenantClient';
import { fieldCls } from '@/components/crm/formUtils';
import { useFabricationAction } from '@/hooks/useFabricationAction';
import { fabricationTemplateService } from '@/services/fabricationTemplateService';
import { VendorPicker } from '@/pages/purchases/purchase-order/components/VendorPicker';
import type { VendorRef } from '@/pages/purchases/purchase-order/components/VendorPicker';
import type { FabricationMaterial } from '@/types/fabrication';

type PurchaseAvailability = { enabled: boolean; blockers: { code: string; message: string }[] };

type RequirementRow = { lineId: string; quantity: string; price: string; slabs: string };
const emptyRow = (): RequirementRow => ({ lineId: '', quantity: '', price: '', slabs: '' });

type PurchaseInput = { templateId: string; vendorId: string; reason: string; requirements: { sourceLineId: string; quantity: number; unitPrice: number; expectedSlabs?: number }[] };

export function FabricationShortagePurchase({ jobId, version, materials, canReadPurchase }: { jobId: string; version: number; materials: FabricationMaterial[]; canReadPurchase: boolean }) {
  const client = useQueryClient();
  const [vendor, setVendor] = useState<VendorRef | null>(null);
  const [rows, setRows] = useState<RequirementRow[]>([emptyRow()]);
  const updateRow = (index: number, change: Partial<RequirementRow>) => setRows((current) => current.map((row, i) => i === index ? { ...row, ...change } : row));
  const [reason, setReason] = useState('');
  const [createdId, setCreatedId] = useState('');
  const templates = useQuery({ queryKey: ['fabrication-templates', jobId], queryFn: () => fabricationTemplateService.list(jobId) });
  const availability = useQuery({ queryKey: ['fabrication-procurement-action', jobId, version], queryFn: async () => (await tenantClient.get<{ action: PurchaseAvailability }>(`/tenant/fabrication-jobs/${encodeURIComponent(jobId)}/procurement-action`)).data.action });
  const template = templates.data?.find((item) => item.state === 'approved');
  const validRows = rows.length > 0 && new Set(rows.map((row) => row.lineId)).size === rows.length && rows.every((row) => template?.lines.some((line) => line.sourceLineId === row.lineId) && Number.isFinite(Number(row.quantity)) && Number(row.quantity) > 0 && Number.isFinite(Number(row.price)) && Number(row.price) > 0 && (!row.slabs || (Number.isInteger(Number(row.slabs)) && Number(row.slabs) >= 1 && Number(row.slabs) <= 10000)));
  const action = useFabricationAction({
    version,
    execute: (meta, input: PurchaseInput) => tenantClient.post<{ result: { relatedId: string } }>(`/tenant/fabrication-jobs/${encodeURIComponent(jobId)}/shortage-purchase-orders`, { ...meta, ...input }),
    onSuccess: ({ data }) => {
      setCreatedId(data.result.relatedId); setRows([emptyRow()]); setReason('');
      for (const queryKey of [['fabrication-job', jobId], ['fabrication-procurement', jobId], ['fabrication-procurement-action', jobId], ['purchase-orders']]) void client.invalidateQueries({ queryKey });
    },
  });
  const conflict = isAxiosError(action.error) && action.error.response?.status === 409;
  return <section className="space-y-4 rounded-xl border border-stone-200 bg-white p-4 sm:p-5" aria-labelledby="shortage-heading">
    <div><h3 id="shortage-heading" className="text-sm font-semibold">Purchase missing material</h3><p className="mt-1 text-xs text-stone-500">Create a draft purchase order linked to this job and its approved measurements. Check existing orders first. Review pricing, delivery details and approval on the purchase order before ordering.</p></div>
    {availability.isLoading && <p role="status">Checking purchase availability…</p>}
    {availability.error && <p role="alert">Unable to check purchase availability. <button type="button" className="underline" onClick={() => void availability.refetch()}>Try again</button></p>}
    {availability.data?.blockers.map((blocker) => <p key={blocker.code} className="text-sm text-amber-800">{blocker.message}</p>)}
    {templates.isLoading && <p role="status">Loading approved requirements…</p>}
    {templates.error && <p role="alert">Unable to load measured requirements.</p>}
    {templates.isSuccess && !template && <p className="text-sm text-amber-800">Approve the template before purchasing missing material.</p>}
    {template && <form className="space-y-3" onSubmit={(event) => {
      event.preventDefault();
      if (availability.data?.enabled && vendor && validRows && reason.trim()) action.run({ templateId: template.id, vendorId: vendor.id, reason, requirements: rows.map((row) => ({ sourceLineId: row.lineId, quantity: Number(row.quantity), unitPrice: Number(row.price), ...(row.slabs ? { expectedSlabs: Number(row.slabs) } : {}) })) });
    }}>
      <fieldset disabled={action.isPending || !availability.data?.enabled} className="space-y-3">
        <div className="space-y-1"><p className="text-xs font-medium">Supplier</p><VendorPicker value={vendor} onChange={setVendor} required /></div>
        {rows.map((row, index) => {
          const line = template.lines.find((item) => item.sourceLineId === row.lineId);
          const material = materials.find((item) => item.itemId === line?.materialId);
          return <fieldset key={index} className="space-y-3 rounded-lg border border-stone-200 p-3">
            <legend className="px-1 text-xs font-semibold">Purchase line {index + 1}</legend>
        <label className="block text-xs font-medium">Measured requirement<select className={fieldCls} required value={row.lineId} onChange={(event) => { updateRow(index, { ...emptyRow(), lineId: event.target.value }); }}><option value="">Choose work needing material</option>{template.lines.map((item, lineIndex) => <option disabled={rows.some((other, otherIndex) => otherIndex !== index && other.lineId === item.sourceLineId)} key={item.sourceLineId} value={item.sourceLineId}>Line {lineIndex + 1} · {materials.find((material) => material.itemId === item.materialId)?.name || item.scope || item.pieces.map((piece) => piece.name).join(', ')}</option>)}</select></label>
        {line && <details className="rounded-md bg-stone-50 p-3 text-xs text-stone-600"><summary className="min-h-6 cursor-pointer font-medium">{line.pieces.length} measured pieces · Finish: {line.finish || 'Confirm with supplier'}</summary><p className="my-2">These finished-piece requirements will be copied to the purchase order. Confirm slab sizes, layout suitability and cutting allowances before ordering.</p><ul className="space-y-1">{line.pieces.map((piece, pieceIndex) => <li key={pieceIndex}>{piece.name}: {piece.lengthMm} × {piece.widthMm} × {piece.thicknessMm} mm (length × width × thickness)</li>)}</ul></details>}
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="text-xs font-medium">Quantity ({material?.unitCode || 'catalog units'})<input className={fieldCls} type="number" min="0.000001" step="any" required value={row.quantity} onChange={(event) => updateRow(index, { quantity: event.target.value })} /></label>
          <label className="text-xs font-medium">Quoted unit price<input className={fieldCls} type="number" min="0.000001" step="any" required value={row.price} onChange={(event) => updateRow(index, { price: event.target.value })} /></label>
          <label className="text-xs font-medium">Expected slabs (optional)<input className={fieldCls} type="number" min="1" max="10000" step="1" value={row.slabs} onChange={(event) => updateRow(index, { slabs: event.target.value })} /></label>
        </div>
            {rows.length > 1 && <button type="button" className="min-h-11 text-sm underline" onClick={() => setRows((current) => current.filter((_, i) => i !== index))}>Remove purchase line {index + 1}</button>}
          </fieldset>;
        })}
        <button type="button" disabled={rows.length >= template.lines.length} className="min-h-11 text-sm font-medium underline disabled:opacity-50" onClick={() => setRows((current) => [...current, emptyRow()])}>Add measured requirement</button>
        <label className="block text-xs font-medium">Why is more material needed?<textarea className={fieldCls} required value={reason} onChange={(event) => setReason(event.target.value)} placeholder="For example: no available remnant fits the island dimensions" rows={2} /></label>
        <button type="submit" disabled={!vendor || !validRows || !reason.trim() || conflict} className="min-h-11 rounded-lg bg-brand px-4 text-sm font-semibold disabled:opacity-50">{action.isPending ? 'Creating draft…' : 'Create linked draft purchase order'}</button>
      </fieldset>
      {action.error && <p role="alert" className="text-sm text-destructive">{apiErrorMessage(action.error, 'Unable to create the purchase order. Your entries have been retained.')}</p>}
      {conflict && <button type="button" className="min-h-11 text-sm underline" onClick={async () => { await Promise.all([templates.refetch(), availability.refetch(), client.invalidateQueries({ queryKey: ['fabrication-job', jobId] })]); action.resetForLatest(); }}>Refresh job and review again</button>}
    </form>}
    {createdId && <p role="status" className="text-sm text-emerald-800">Draft purchase order created. {canReadPurchase && <Link className="underline" to={`/purchases/purchase_order/${encodeURIComponent(createdId)}`}>Review purchase order</Link>}</p>}
  </section>;
}
