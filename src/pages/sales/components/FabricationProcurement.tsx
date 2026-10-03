import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { tenantClient, apiErrorMessage } from '@/api/tenantClient';

type ProcurementLine = { number: number; material: string; unit: string; ordered: number; received: number };
type ProcurementOrder = { id: string; number: string; vendor: string; status: string; statusCode: string; expectedDate: string; templateRevision: number; templateState: string; reason: string; lines: ProcurementLine[] };

/** Receipt quantities are purchasing progress, not inspection acceptance or cutting readiness. */
export function FabricationProcurement({ jobId }: { jobId: string }) {
  const orders = useQuery({ queryKey: ['fabrication-procurement', jobId], queryFn: () => tenantClient.get<{ orders: ProcurementOrder[] }>(`/tenant/fabrication-jobs/${encodeURIComponent(jobId)}/shortage-purchase-orders`).then(({ data }) => data.orders) });
  return <section className="space-y-3 rounded-xl border border-stone-200 bg-white p-4 sm:p-5" aria-labelledby="procurement-heading">
    <div className="flex items-start justify-between gap-3"><div><h3 id="procurement-heading" className="text-sm font-semibold">Linked purchases</h3><p className="mt-1 text-xs text-stone-500">Review existing orders before purchasing more material. Posted receipts still require inspection before fabrication.</p></div><button type="button" className="min-h-11 shrink-0 text-xs underline disabled:opacity-50" disabled={orders.isFetching} onClick={() => void orders.refetch()}>Refresh purchases</button></div>
    {orders.isLoading && <p role="status" className="text-sm">Loading linked purchases…</p>}
    {orders.error && <p role="alert" className="text-sm text-destructive">{apiErrorMessage(orders.error, 'Unable to load linked purchases.')}</p>}
    {orders.isSuccess && !orders.data.length && <p className="text-sm text-stone-500">No linked purchase orders are visible with your current access.</p>}
    {orders.data?.map((order) => <article key={order.id} className="space-y-3 rounded-lg border border-stone-200 p-3">
      <div className="flex flex-wrap items-start justify-between gap-2"><div><Link className="min-h-11 inline-flex items-center text-sm font-semibold underline" to={`/purchases/purchase_order/${encodeURIComponent(order.id)}`}>{order.number || 'Draft purchase order'}</Link><p className="text-xs text-stone-600">{order.vendor}</p></div><span className="rounded bg-stone-100 px-2 py-1 text-xs">{order.status}</span></div>
      <p className="text-xs text-stone-600">Template revision {order.templateRevision} · {order.templateState}{order.expectedDate ? ` · Expected ${order.expectedDate}` : ' · Delivery date not set'}</p>
      <p className="text-xs text-stone-600">{order.reason}</p>
      <ul className="space-y-2">{order.lines.map((line) => <li key={line.number} className="rounded bg-stone-50 p-2 text-xs"><p className="font-medium">{line.material}</p><p className="mt-1 tabular-nums">Ordered: {line.ordered} {line.unit} · Received: {line.received} {line.unit}</p>{order.statusCode !== 'VOID' && <p className="mt-1 text-stone-600">{line.received >= line.ordered ? 'Ordered quantity received; check inspection separately.' : `Not yet received: ${Math.max(0, line.ordered - line.received)} ${line.unit}`}</p>}</li>)}</ul>
      {!order.lines.length && <p className="text-xs text-stone-500">No active order lines. Open the purchase order to review changes.</p>}
    </article>)}
  </section>;
}
