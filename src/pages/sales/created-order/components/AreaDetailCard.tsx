import { areaKindConfig } from '@/lib/createdOrderAreas';
import { areaDetailRows } from '@/lib/createdOrderDisplay';
import type { CreatedOrderArea } from '@/types/createdOrder';
import { DetailField } from './DetailField';

interface AreaDetailCardProps {
  area: CreatedOrderArea;
}

// One area of a submitted order, read-only: the same inputs the customer filled
// in on the form, labelled the same way.
export function AreaDetailCard({ area }: AreaDetailCardProps) {
  const rows = areaDetailRows(area);
  const kindLabel = areaKindConfig(area.kind).label;
  return (
    <article
      aria-label={area.name}
      className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm sm:p-5"
    >
      <header className="flex flex-wrap items-center gap-2">
        <h3 className="text-sm font-semibold text-stone-900">{area.name}</h3>
        {kindLabel !== area.name && (
          <span className="rounded-full border border-stone-200 bg-stone-100 px-2 py-0.5 text-label font-semibold text-stone-600">
            {kindLabel}
          </span>
        )}
      </header>
      <dl className="mt-3 grid gap-x-6 gap-y-3 sm:grid-cols-2 xl:grid-cols-3">
        {rows.map((row) => (
          <DetailField key={row.label} label={row.label}>
            {row.value}
          </DetailField>
        ))}
      </dl>
      {area.notes.trim() && (
        <div className="mt-4 border-t border-stone-100 pt-3">
          <p className="text-label font-semibold uppercase tracking-wide text-stone-500">Notes</p>
          <p className="mt-0.5 whitespace-pre-wrap break-words text-sm text-stone-800">{area.notes}</p>
        </div>
      )}
    </article>
  );
}
