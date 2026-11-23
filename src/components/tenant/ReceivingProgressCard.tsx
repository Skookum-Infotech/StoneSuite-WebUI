import { AlertTriangle, PackageCheck } from 'lucide-react';
import { SegmentedProgressBar } from '@/components/tenant/SegmentedProgressBar';
import type { ReceivingCardModel } from '@/lib/receivingCardModel';

/** The card a receiving progress bar opens: who it is about, the headline %,
 *  the bars behind it, and (for a whole order) a line-by-line breakdown. Pure
 *  display; lib/receivingCardModel.ts decides what goes in it. */
export function ReceivingProgressCard({ model }: { model: ReceivingCardModel }) {
  return (
    <div className="w-[min(30rem,calc(100vw-3rem))]">
      <div className="flex items-center gap-3 pb-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-orange-100 text-orange-600">
          <PackageCheck className="size-5" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-stone-900">{model.title}</p>
          <p className="truncate text-xs text-stone-500">{model.subtitle}</p>
        </div>
      </div>

      <div className="grid gap-2.5 sm:grid-cols-2">
        <div className="rounded-xl bg-stone-50 p-3.5">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-xs font-medium text-stone-500">Received</p>
            {model.overdue && (
              <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-2 py-0.5 text-2xs font-semibold text-amber-700">
                <AlertTriangle className="size-3" aria-hidden="true" />
                {model.overdue}
              </span>
            )}
          </div>
          <p className="mt-2 text-3xl font-semibold tabular-nums text-stone-900">{model.percent}%</p>
          <div className="mt-1 space-y-0.5">
            {model.caption.map((text) => (
              <p key={text} className="text-2xs text-stone-500">{text}</p>
            ))}
          </div>
        </div>

        <div className="space-y-3 rounded-xl bg-stone-50 p-3.5">
          {model.rows.map((row) => (
            <div key={row.label}>
              <p className="mb-1.5 text-xs font-medium text-stone-500">{row.label}</p>
              <SegmentedProgressBar
                block
                percent={row.percent}
                valueLabel={row.valueLabel}
                ariaLabel={`${row.label} for ${model.title}`}
              />
            </div>
          ))}
        </div>
      </div>

      {model.breakdown.length > 0 && (
        <div className="mt-2.5 rounded-xl border border-stone-200">
          <p className="border-b border-stone-100 px-3.5 py-2 text-2xs font-semibold uppercase tracking-wide text-stone-500">
            Lines
          </p>
          <ul className="max-h-48 divide-y divide-stone-100 overflow-y-auto modal-scrollbar">
            {model.breakdown.map((row) => (
              <li key={row.id} className="flex items-center justify-between gap-3 px-3.5 py-2">
                <div className="min-w-0">
                  <p className="truncate text-xs font-medium text-stone-800">{row.name}</p>
                  <p className="text-2xs tabular-nums text-stone-500">{row.detail}</p>
                </div>
                <SegmentedProgressBar percent={row.percent} ariaLabel={`${row.name} received`} />
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
