import { useNavigate } from 'react-router-dom';
import { ModernSection } from '@/components/crm/FormPrimitives';
import { readonlyCls, fieldLabelCls } from '@/components/crm/formUtils';
import { formatUnitArea } from '@/lib/unitConsumption';
import type { InventoryUnit } from '@/types/inventory';

function ReadonlyField({ label, value }: { label: string; value?: string }) {
  return (
    <div className="space-y-1">
      <label className={fieldLabelCls}>{label}</label>
      <div className={readonlyCls}>{value || <span className="text-stone-400">—</span>}</div>
    </div>
  );
}

// The unit's static facts — what it is and where it came from. The usage story
// lives on the Usage tab; this is the reference sheet.
export function UnitDetailsTab({ unit }: { unit: InventoryUnit }) {
  const navigate = useNavigate();
  const showRoot = Boolean(unit.rootUnitId) && unit.rootUnitId !== unit.parentUnitId;

  return (
    <>
      <ModernSection title="Unit Information" index={0}>
        <div className="grid grid-cols-1 gap-x-5 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
          <ReadonlyField label="Item" value={unit.inventoryItemName} />
          <ReadonlyField label="Kind" value={unit.kind} />
          <ReadonlyField label="Form" value={unit.form} />
          <ReadonlyField label="Area" value={formatUnitArea(unit.area, unit.areaUnitCode)} />
          <ReadonlyField label="Dimensions (mm)" value={`${unit.lengthMm} × ${unit.widthMm} × ${unit.thicknessMm}`} />
          <ReadonlyField label="Grade" value={unit.grade} />
          <ReadonlyField label="Finish" value={unit.finish} />
          <ReadonlyField label="Location" value={unit.warehouseName} />
          <ReadonlyField label="Bin" value={unit.binPath} />
          <ReadonlyField label="Lot" value={unit.lot} />
          <ReadonlyField label="Block ID" value={unit.blockId} />
          <ReadonlyField label="Barcode" value={unit.barcode} />
        </div>
      </ModernSection>

      {(unit.parentUnitId || showRoot) && (
        <ModernSection title="Lineage" index={1}>
          <div className="grid grid-cols-1 gap-x-5 gap-y-4 sm:grid-cols-2">
            {unit.parentUnitId && (
              <div className="space-y-1">
                <label className={fieldLabelCls}>Cut From</label>
                <button
                  type="button"
                  onClick={() => navigate(`/inventory/unit/${unit.parentUnitId}`)}
                  aria-label={`Open parent unit ${unit.parentSerial || ''}`.trim()}
                  className={`${readonlyCls} block text-left hover:bg-stone-100 transition-colors`}
                >
                  {unit.parentSerial || 'Parent unit'}
                </button>
              </div>
            )}
            {showRoot && (
              <div className="space-y-1">
                <label className={fieldLabelCls}>Original Slab</label>
                <button
                  type="button"
                  onClick={() => navigate(`/inventory/unit/${unit.rootUnitId}`)}
                  aria-label={`Open original slab ${unit.rootSerial || ''}`.trim()}
                  className={`${readonlyCls} block text-left hover:bg-stone-100 transition-colors`}
                >
                  {unit.rootSerial || 'Original slab'}
                </button>
              </div>
            )}
          </div>
        </ModernSection>
      )}
    </>
  );
}
