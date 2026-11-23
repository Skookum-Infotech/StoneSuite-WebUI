import { ModernSection } from '@/components/crm/FormPrimitives';
import { cn } from '@/lib/utils';
import { BAR_TONE_CLASS, consumptionSentence, unitSegments, usageHeadline, usageTiles } from '@/lib/unitConsumption';
import type { InventoryUnit } from '@/types/inventory';
import { UnitConsumptionBar } from './UnitConsumptionBar';

// The answer to "how much of this piece is gone", front and centre: one big word,
// the sentence behind it, the bar, and the few numbers it is made of.
export function UnitUsageHero({ unit }: { unit: InventoryUnit }) {
  const sentence = consumptionSentence(unit);
  return (
    <ModernSection title="Usage" index={0}>
      <div className="space-y-5">
        <div>
          <p className="text-3xl font-bold tracking-tight tabular-nums text-stone-950">{usageHeadline(unit)}</p>
          <p className="mt-1 text-sm text-stone-500">{sentence}</p>
        </div>

        <UnitConsumptionBar size="md" segments={unitSegments(unit)} label={sentence} />

        <dl className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {usageTiles(unit).map((tile) => (
            <div key={tile.label} className="rounded-lg border border-stone-200 bg-stone-50/60 px-4 py-3">
              <dt className="flex items-center gap-1.5 text-2xs font-semibold uppercase tracking-wider text-stone-500">
                {tile.tone && <span className={cn('size-2 shrink-0 rounded-full', BAR_TONE_CLASS[tile.tone])} aria-hidden="true" />}
                {tile.label}
              </dt>
              <dd className="mt-1 text-lg font-bold tabular-nums text-stone-950">{tile.value}</dd>
              {tile.note && <dd className="text-2xs text-stone-500">{tile.note}</dd>}
            </div>
          ))}
        </dl>
      </div>
    </ModernSection>
  );
}
