import { useNavigate } from 'react-router-dom';
import { formatMaterialArea, materialDetailLine, materialSwatchStyle } from '@/lib/materialConsumption';
import { WidgetCard } from './WidgetCard';
import { MoreHint } from './MoreHint';
import { Spinner, ErrorNote } from '@/components/tenant/ui';
import type { MaterialConsumptionData } from '@/types/dashboardData';

export function MaterialConsumption({
  data,
  isLoading,
  isError,
}: {
  data: MaterialConsumptionData | undefined;
  isLoading: boolean;
  isError: boolean;
}) {
  const navigate = useNavigate();

  if (isLoading) {
    return (
      <WidgetCard title="Material consumption">
        <Spinner label="Loading material consumption…" />
      </WidgetCard>
    );
  }

  if (isError || !data) {
    return (
      <WidgetCard title="Material consumption">
        <ErrorNote>Couldn&apos;t load material consumption.</ErrorNote>
      </WidgetCard>
    );
  }

  // Unit-free counts in the header, never a summed area -- items can carry
  // different units (sqft, sqm, ...), so adding their areas together would
  // be meaningless.
  const subtitle = `${data.materialCount} ${data.materialCount === 1 ? 'material' : 'materials'} · ${data.slabTotal} ${data.slabTotal === 1 ? 'slab' : 'slabs'}`;
  const max = Math.max(...data.materials.map((m) => m.netUsed), 1);

  return (
    <WidgetCard title="Material consumption" subtitle={subtitle}>
      {data.materials.length === 0 ? (
        <p className="text-xs text-stone-400">No material has been consumed yet.</p>
      ) : (
        <>
          <div className="flex flex-col gap-[13px]">
            {data.materials.map((m) => (
              <div key={m.id} className="flex items-center gap-[11px]">
                <span
                  className="h-[22px] w-[22px] shrink-0 rounded-md shadow-[0_0_0_1px_rgba(28,25,23,0.09)]"
                  style={materialSwatchStyle(m.colorHex, m.id)}
                  aria-hidden="true"
                />
                <div className="w-[132px] shrink-0">
                  <button
                    type="button"
                    onClick={() => navigate(`/inventory/item/${m.id}`)}
                    aria-label={`View inventory item ${m.name}`}
                    className="block w-full truncate rounded text-left text-xs font-medium text-stone-950 hover:text-accent-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {m.name}
                  </button>
                  <div className="truncate text-2xs text-stone-500">{materialDetailLine(m)}</div>
                </div>
                <div className="h-[9px] flex-1 overflow-hidden rounded-full bg-stone-100">
                  <div className="h-full rounded-full bg-brand-dark" style={{ width: `${(m.netUsed / max) * 100}%` }} />
                </div>
                <div className="flex w-[92px] shrink-0 flex-col items-end gap-0.5">
                  <span className="text-xs font-bold text-stone-950 tabular-nums">
                    {formatMaterialArea(m.netUsed, m.unitCode)}
                  </span>
                  {m.scrappedArea > 0 && (
                    <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-700">
                      {formatMaterialArea(m.scrappedArea, m.unitCode)} scrapped
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
          <MoreHint count={data.materialCount - data.materials.length} label="more materials" />
        </>
      )}
    </WidgetCard>
  );
}
