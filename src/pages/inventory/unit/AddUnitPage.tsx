import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Layers, AlertCircle, Loader2, Save } from 'lucide-react';
import { inventoryUnitService } from '@/services/inventoryUnitService';
import { apiErrorMessage } from '@/api/tenantClient';
import { FormActionBar, ModernSection, ModernFieldShell } from '@/components/crm/FormPrimitives';
import { CrmPageHeader } from '@/pages/crm/components/CrmPageHeader';
import { fieldCls } from '@/components/crm/formUtils';
import { ItemPicker } from '@/components/inventory/ItemPicker';
import { WarehouseSelect } from '@/components/inventory/WarehouseSelect';
import { toNumericWarehouseId } from '@/lib/inventoryWarehouse';
import { BinPicker } from '@/components/inventory/BinPicker';
import { useInventoryLookups } from '@/hooks/useInventoryLookups';
import { inventoryBinService } from '@/services/inventoryBinService';
import { VendorPicker, type VendorRef } from '@/pages/purchases/purchase-order/components/VendorPicker';
import { isAreaUnit, findUnit } from '@/lib/inventoryUnits';
import { TRACKING_SERIALIZED } from '@/types/inventory';
import type { InventoryItem } from '@/types/inventory';

// Receives one physical piece — a slab, whole. Offcuts are never created
// here (spec §3): they are minted by a cut, which derives lineage and area
// from the parent. Only tracking:'serialized' items using an area unit
// (SQFT/SQM) may back a unit.
export default function AddUnitPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { lookups } = useInventoryLookups();

  const [item, setItem] = useState<InventoryItem | null>(null);
  const [serial, setSerial] = useState('');
  const [barcode, setBarcode] = useState('');
  const [warehouseId, setWarehouseId] = useState('');
  const [binId, setBinId] = useState('');
  const [lengthMm, setLengthMm] = useState('');
  const [widthMm, setWidthMm] = useState('');
  const [thicknessMm, setThicknessMm] = useState('');
  const [grade, setGrade] = useState('');
  const [finishId, setFinishId] = useState('');
  const [vendor, setVendor] = useState<VendorRef | null>(null);
  const [supplierCode, setSupplierCode] = useState('');
  const [blockId, setBlockId] = useState('');
  const [lot, setLot] = useState('');
  const [fieldError, setFieldError] = useState<string | null>(null);

  const { data: bins = [] } = useQuery({
    queryKey: ['inventory-bins-tree-all'],
    queryFn: () => inventoryBinService.getTree(),
  });

  const selectedUnit = findUnit(lookups?.units ?? [], item?.unitId);
  const itemUsable = !item || (item.tracking === TRACKING_SERIALIZED && isAreaUnit(selectedUnit));

  const { mutate: save, isPending, error: saveError } = useMutation({
    mutationFn: () => inventoryUnitService.createUnit({
      serial: serial.trim(),
      barcode: barcode.trim() || undefined,
      inventoryItemId: item!.id,
      warehouseId: toNumericWarehouseId(lookups?.warehouses ?? [], warehouseId),
      binId: binId || undefined,
      blockId: blockId || undefined,
      lot: lot || undefined,
      lengthMm: Number(lengthMm) || 0,
      widthMm: Number(widthMm) || 0,
      thicknessMm: Number(thicknessMm) || 0,
      grade: grade || undefined,
      finishId: finishId ? Number(finishId) : undefined,
      vendorId: vendor?.id || undefined,
      supplierCode: supplierCode || undefined,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory-units'] });
      navigate('/inventory/unit');
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!item) { setFieldError('An item is required.'); return; }
    if (!itemUsable) { setFieldError('Only serialized items on an area unit (SQFT/SQM) can have units.'); return; }
    if (!serial.trim()) { setFieldError('Serial is required.'); return; }
    if (!warehouseId) { setFieldError('A warehouse is required.'); return; }
    if (!(Number(lengthMm) > 0) || !(Number(widthMm) > 0) || !(Number(thicknessMm) > 0)) {
      setFieldError('Length, width and thickness must all be greater than zero.');
      return;
    }
    if (supplierCode.trim() && !vendor) {
      setFieldError('A vendor is required when a supplier code is set.');
      return;
    }
    setFieldError(null);
    save();
  }

  return (
    <div className="flex flex-col flex-1 min-h-0 bg-stone-50">
      <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
        <CrmPageHeader
          backLabel="Units"
          onBack={() => navigate('/inventory/unit')}
          icon={Layers}
          title="Receive Slab"
          subtitle="Fields marked * are required."
          actions={(
            <button type="submit" disabled={isPending} className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-3.5 py-1.5 text-xs font-semibold text-stone-900 hover:bg-brand-hover disabled:opacity-50 transition-all shadow-sm">
              {isPending ? <Loader2 className="size-3 animate-spin" /> : <Save className="size-3" />}
              {isPending ? 'Saving…' : 'Receive Slab'}
            </button>
          )}
        />

        {(saveError || fieldError) && (
          <div className="shrink-0 flex items-start gap-3 border-b border-red-200 bg-red-50 px-5 py-2.5">
            <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-red-100"><AlertCircle className="size-3 text-red-600" /></span>
            <p className="text-xs text-red-700"><span className="font-bold">Error: </span>{fieldError || apiErrorMessage(saveError, 'Failed to receive slab.')}</p>
          </div>
        )}

        <div className="flex-1 overflow-y-auto modal-scrollbar">
          <div className="px-4 py-3 pb-24 space-y-2 3xl:px-10 3xl:py-5 4xl:px-16 4xl:py-8">
            <ModernSection title="Item &amp; Location" index={0}>
              <div className="grid grid-cols-1 gap-x-5 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
                <div className="sm:col-span-2 lg:col-span-3">
                  <ModernFieldShell label="Item" required>
                    <ItemPicker value={item} onChange={setItem} filters={[{ field: 'tracking', op: 'eq', value: TRACKING_SERIALIZED }]} required />
                    {item && !itemUsable && <p className="mt-1 text-2xs text-destructive">This item&apos;s unit is not an area unit — units require SQFT/SQM.</p>}
                  </ModernFieldShell>
                </div>
                <ModernFieldShell label="Serial" required>
                  <input type="text" value={serial} onChange={(e) => setSerial(e.target.value)} className={fieldCls} aria-label="Serial" required />
                </ModernFieldShell>
                <ModernFieldShell label="Barcode">
                  <input type="text" value={barcode} onChange={(e) => setBarcode(e.target.value)} className={fieldCls} aria-label="Barcode" />
                </ModernFieldShell>
                <ModernFieldShell label="Warehouse" required>
                  <WarehouseSelect warehouses={lookups?.warehouses ?? []} value={warehouseId} onChange={setWarehouseId} required />
                </ModernFieldShell>
                <ModernFieldShell label="Bin">
                  <BinPicker bins={bins} value={binId} onChange={setBinId} label="Bin" allowEmpty emptyLabel="— No bin —" />
                </ModernFieldShell>
                <ModernFieldShell label="Block ID">
                  <input type="text" value={blockId} onChange={(e) => setBlockId(e.target.value)} className={fieldCls} aria-label="Block ID" />
                </ModernFieldShell>
                <ModernFieldShell label="Lot">
                  <input type="text" value={lot} onChange={(e) => setLot(e.target.value)} className={fieldCls} aria-label="Lot" />
                </ModernFieldShell>
              </div>
            </ModernSection>

            <ModernSection title="Dimensions" index={1}>
              <div className="grid grid-cols-1 gap-x-5 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
                <ModernFieldShell label="Length (mm)" required>
                  <input type="number" min={1} value={lengthMm} onChange={(e) => setLengthMm(e.target.value)} className={fieldCls} aria-label="Length mm" required />
                </ModernFieldShell>
                <ModernFieldShell label="Width (mm)" required>
                  <input type="number" min={1} value={widthMm} onChange={(e) => setWidthMm(e.target.value)} className={fieldCls} aria-label="Width mm" required />
                </ModernFieldShell>
                <ModernFieldShell label="Thickness (mm)" required>
                  <input type="number" min={1} value={thicknessMm} onChange={(e) => setThicknessMm(e.target.value)} className={fieldCls} aria-label="Thickness mm" required />
                </ModernFieldShell>
                <p className="sm:col-span-2 lg:col-span-3 text-2xs text-stone-400">Area is computed server-side from these dimensions into the item&apos;s own unit — never sent from here.</p>
              </div>
            </ModernSection>

            <ModernSection title="Attributes" index={2}>
              <div className="grid grid-cols-1 gap-x-5 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
                <ModernFieldShell label="Grade">
                  <input type="text" value={grade} onChange={(e) => setGrade(e.target.value)} className={fieldCls} aria-label="Grade" />
                </ModernFieldShell>
                <ModernFieldShell label="Finish">
                  <select value={finishId} onChange={(e) => setFinishId(e.target.value)} className={fieldCls} aria-label="Finish">
                    <option value="">— Select Finish —</option>
                    {(lookups?.finishes ?? []).map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
                  </select>
                </ModernFieldShell>
                <ModernFieldShell label="Supplier Code">
                  <input type="text" value={supplierCode} onChange={(e) => setSupplierCode(e.target.value)} className={fieldCls} aria-label="Supplier code" />
                </ModernFieldShell>
                <ModernFieldShell label="Vendor">
                  <VendorPicker value={vendor} onChange={setVendor} />
                </ModernFieldShell>
              </div>
            </ModernSection>
          </div>
        </div>

        <FormActionBar onCancel={() => navigate('/inventory/unit')} isPending={isPending} submitLabel="Receive Slab" />
      </form>
    </div>
  );
}
