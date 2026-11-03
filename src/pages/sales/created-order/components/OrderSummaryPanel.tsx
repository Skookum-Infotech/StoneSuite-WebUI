import { CheckCircle2, CircleAlert, Loader2, Send } from 'lucide-react';
import { formatDisplayDate } from '@/lib/dateUtils';
import type { CreatedOrderFormState } from '@/lib/createdOrderForm';
import { cn } from '@/lib/utils';

export interface SummaryStatus {
  /** Required items still missing or invalid — what the status line counts. */
  errorCount: number;
  isSubmitting: boolean;
}

/** The submit button's wording: "Submit order" when placing, "Save changes"
 *  when changing one. */
export interface SummaryLabels {
  submit: string;
  submitting: string;
}

interface OrderSummaryPanelProps {
  form: CreatedOrderFormState;
  status: SummaryStatus;
  /** `card`: the sticky side panel on wide screens. `bar`: the bottom bar on
   *  narrow ones, which only carries the status and the buttons. */
  layout: 'card' | 'bar';
  labels: SummaryLabels;
  onCancel: () => void;
}

function SubmitButton({ isSubmitting, labels }: { isSubmitting: boolean; labels: SummaryLabels }) {
  return (
    <button
      type="submit"
      disabled={isSubmitting}
      className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-brand px-4 text-sm font-semibold text-stone-950 shadow-sm outline-none transition-all hover:bg-brand-hover focus-visible:ring-2 focus-visible:ring-brand/50 active:scale-95 disabled:opacity-60"
    >
      {isSubmitting ? (
        <Loader2 className="size-4 animate-spin" aria-hidden="true" />
      ) : (
        <Send className="size-4" aria-hidden="true" />
      )}
      {isSubmitting ? labels.submitting : labels.submit}
    </button>
  );
}

function CancelButton({ onCancel, disabled }: { onCancel: () => void; disabled: boolean }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onCancel}
      className="inline-flex h-10 items-center justify-center rounded-lg border border-stone-200 bg-white px-4 text-sm font-medium text-stone-600 outline-none transition-colors hover:bg-stone-50 focus-visible:ring-2 focus-visible:ring-brand/40 disabled:opacity-50"
    >
      Cancel
    </button>
  );
}

function StatusLine({ errorCount }: { errorCount: number }) {
  const ready = errorCount === 0;
  const Icon = ready ? CheckCircle2 : CircleAlert;
  return (
    <p
      role="status"
      className={cn(
        'flex items-center gap-2 text-xs font-medium',
        ready ? 'text-emerald-700' : 'text-amber-700',
      )}
    >
      <Icon className="size-4 shrink-0" aria-hidden="true" />
      {ready
        ? 'Everything required is filled in.'
        : `${errorCount} required ${errorCount === 1 ? 'item' : 'items'} still to fill in.`}
    </p>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  if (value === '') return null;
  return (
    <div className="flex justify-between gap-3 text-xs">
      <dt className="shrink-0 text-stone-500">{label}</dt>
      <dd className="truncate text-right font-medium text-stone-800">{value}</dd>
    </div>
  );
}

// The order at a glance, kept in view while the customer works down the form:
// what the job is, which areas are on it, and how much is left. The Submit
// button is never greyed out for missing fields — pressing it is what shows
// the customer exactly which ones, which beats a dead button with no reason.
export function OrderSummaryPanel({ form, status, layout, labels, onCancel }: OrderSummaryPanelProps) {
  const { errorCount, isSubmitting } = status;
  if (layout === 'bar') {
    return (
      <div className="fixed inset-x-0 bottom-0 z-20 flex items-center justify-between gap-3 border-t border-stone-200 bg-white px-4 py-3 shadow-sm">
        <StatusLine errorCount={errorCount} />
        <div className="flex shrink-0 items-center gap-2">
          <CancelButton onCancel={onCancel} disabled={isSubmitting} />
          <SubmitButton isSubmitting={isSubmitting} labels={labels} />
        </div>
      </div>
    );
  }

  const place = [form.city.trim(), form.zip.trim()].filter(Boolean).join(' ');
  return (
    <aside
      aria-label="Order summary"
      className="sticky top-20 space-y-4 rounded-2xl border border-stone-200 bg-white p-5 shadow-sm"
    >
      <h2 className="text-sm font-semibold text-stone-900">Order summary</h2>

      <dl className="space-y-1.5">
        <SummaryRow label="Builder" value={form.builder.trim()} />
        <SummaryRow label="Community" value={form.community.trim()} />
        <SummaryRow label="Plan" value={form.plan.trim()} />
        <SummaryRow label="Address" value={form.installAddress.trim()} />
        <SummaryRow label="City / ZIP" value={place} />
        <SummaryRow label="Measure" value={formatDisplayDate(form.measureDate)} />
        <SummaryRow label="Install" value={formatDisplayDate(form.installDate)} />
      </dl>

      <div className="border-t border-stone-100 pt-3">
        <p className="text-xs font-semibold text-stone-900">
          Areas <span className="font-normal text-stone-500">({form.areas.length})</span>
        </p>
        {form.areas.length === 0 ? (
          <p className="mt-1 text-xs text-stone-500">None added yet.</p>
        ) : (
          <ul className="mt-1.5 space-y-1">
            {form.areas.map((area) => (
              <li key={area.key} className="flex items-center justify-between gap-2 text-xs text-stone-700">
                <span className="truncate">{area.name || 'Unnamed area'}</span>
                <span className="shrink-0 text-stone-500">{area.color.trim() || 'No color'}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="space-y-3 border-t border-stone-100 pt-3">
        <StatusLine errorCount={errorCount} />
        <div className="grid gap-2">
          <SubmitButton isSubmitting={isSubmitting} labels={labels} />
          <CancelButton onCancel={onCancel} disabled={isSubmitting} />
        </div>
      </div>
    </aside>
  );
}
