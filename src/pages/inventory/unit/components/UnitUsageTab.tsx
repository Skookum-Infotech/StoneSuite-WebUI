import { ModernSection } from '@/components/crm/FormPrimitives';
import { usageOf } from '@/lib/unitConsumption';
import { UNIT_STATUS_CONSUMED } from '@/types/inventory';
import type { InventoryUnit } from '@/types/inventory';
import { UnitLifecycle } from './UnitLifecycle';
import { UnitOffcutsList } from './UnitOffcutsList';
import { UnitUsageHero } from './UnitUsageHero';

// The unit detail page's main tab: what has been used, the story so far, and —
// for a cut slab — the offcuts it left.
export function UnitUsageTab({ unit }: { unit: InventoryUnit }) {
  const hasOffcuts = unit.status === UNIT_STATUS_CONSUMED && usageOf(unit).offcutCount > 0;
  return (
    <>
      <UnitUsageHero unit={unit} />
      <ModernSection title="Lifecycle" index={1}>
        <UnitLifecycle unit={unit} />
      </ModernSection>
      {hasOffcuts && (
        <ModernSection title="Offcuts" index={2}>
          <UnitOffcutsList parentId={unit.id} />
        </ModernSection>
      )}
    </>
  );
}
