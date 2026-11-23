import { consumptionLine, consumptionSentence, unitSegments } from '@/lib/unitConsumption';
import type { InventoryUnit } from '@/types/inventory';
import { UnitConsumptionBar } from './UnitConsumptionBar';

// The Consumption column of the Inventory list: how used-up this piece is at a
// glance (the bar) and, in a line, what happened to it.
export function UnitConsumptionCell({ unit }: { unit: InventoryUnit }) {
  const sentence = consumptionSentence(unit);
  return (
    <div className="min-w-[170px]" title={sentence}>
      <UnitConsumptionBar segments={unitSegments(unit)} label={sentence} />
      <p className="mt-1 truncate text-2xs text-stone-500">{consumptionLine(unit)}</p>
    </div>
  );
}
