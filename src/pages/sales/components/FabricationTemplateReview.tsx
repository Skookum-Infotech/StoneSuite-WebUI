import { ClipboardCheck, Ruler, ShieldCheck, UserCheck } from 'lucide-react';
import type { TemplateRevision } from '@/types/fabricationTemplates';

const stateLabels: Record<TemplateRevision['state'], string> = {
  submitted: 'Awaiting review', approved: 'Approved', rejected: 'Changes requested', superseded: 'Previous revision',
};

/** Read-only evidence for a specific template revision; decisions use separate actions. */
export function FabricationTemplateReview({ revision }: { revision: TemplateRevision }) {
  return (
    <section aria-label={`Template revision ${revision.revision}`} className="overflow-hidden rounded-xl border border-stone-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-stone-100 p-5">
        <div className="flex items-center gap-3">
          <span className="rounded-xl bg-stone-100 p-3 text-ink"><Ruler className="size-5" aria-hidden="true" /></span>
          <div><p className="type-overline">Site measurements</p><h3 className="mt-1 type-dialog-title">Revision {revision.revision}</h3></div>
        </div>
        <span className="rounded-full bg-stone-100 px-3 py-1 text-ink type-pill">{stateLabels[revision.state]}</span>
      </div>
      <div className="grid gap-3 border-b border-stone-100 bg-stone-50 p-5 sm:grid-cols-2">
        <div className="flex items-start gap-2 text-sm text-ink"><ShieldCheck className="mt-0.5 size-4 shrink-0" aria-hidden="true" /><span>Internal review required</span></div>
        {revision.change.customerRequired && <div className="flex items-start gap-2 text-sm text-ink"><UserCheck className="mt-0.5 size-4 shrink-0" aria-hidden="true" /><span>Customer approval required</span></div>}
        <p className="sm:col-span-2 type-helper">Compared with sales order version {revision.salesOrderVersion}. Approval applies only to this revision.</p>
      </div>
      <div className="divide-y divide-stone-100">
        {revision.lines.map((line, index) => {
          const baseline = revision.baseline.find((before) => before.sourceLineId === line.sourceLineId);
          const changed = revision.change.changedLines.includes(line.sourceLineId);
          return <div key={line.sourceLineId} className="space-y-3 p-5">
            <div className="flex flex-wrap items-center justify-between gap-2"><h4 className="font-semibold text-ink-strong">{line.scope || `Material requirement ${index + 1}`}</h4>{changed && <span className="rounded-md bg-amber-50 px-2 py-1 text-amber-800 type-pill">Order change</span>}</div>
            <dl className="grid grid-cols-2 gap-3 rounded-lg bg-stone-50 p-3 text-sm">
              <div><dt className="text-xs text-ink-muted">Required quantity</dt><dd className="mt-1 font-medium">{line.quantity}{baseline && baseline.quantity !== line.quantity && <span className="ml-2 text-xs text-ink-muted">Previously {baseline.quantity}</span>}</dd></div>
              <div><dt className="text-xs text-ink-muted">Unit price</dt><dd className="mt-1 font-medium">{line.unitPrice.toFixed(2)}{baseline && baseline.unitPrice !== line.unitPrice && <span className="ml-2 text-xs text-ink-muted">Previously {baseline.unitPrice.toFixed(2)}</span>}</dd></div>
              <div className="col-span-2"><dt className="text-xs text-ink-muted">Required finish</dt><dd className="mt-1 font-medium">{line.finish || 'Confirm during layout review'}{baseline && baseline.finish !== line.finish && <span className="ml-2 text-xs text-ink-muted">Previously {baseline.finish || 'unspecified'}</span>}</dd></div>
            </dl>
            <ul className="space-y-2">{line.pieces.map((piece, pieceIndex) => <li key={`${piece.name}-${pieceIndex}`} className="flex flex-col justify-between gap-1 rounded-lg border border-stone-100 px-3 py-3 text-sm sm:flex-row"><span className="font-medium text-ink-strong">{piece.name}</span><span className="tabular-nums text-ink-muted">{piece.lengthMm} × {piece.widthMm} × {piece.thicknessMm} mm</span></li>)}</ul>
          </div>;
        })}
      </div>
      <div className="flex items-center gap-2 border-t border-stone-100 px-5 py-3 text-xs text-ink-muted"><ClipboardCheck className="size-4" aria-hidden="true" />Submitted measurements are retained as an immutable record.</div>
    </section>
  );
}
