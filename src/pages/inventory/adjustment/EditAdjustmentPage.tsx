import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ClipboardEdit, AlertCircle, Loader2, Save } from 'lucide-react';
import { inventoryAdjustmentService } from '@/services/inventoryAdjustmentService';
import { apiErrorMessage } from '@/api/tenantClient';
import { FormActionBar, ModernSection, ModernFieldShell } from '@/components/crm/FormPrimitives';
import { CrmPageHeader } from '@/pages/crm/components/CrmPageHeader';
import { fieldCls } from '@/components/crm/formUtils';
import { Spinner, ErrorNote } from '@/components/tenant/ui';
import { WarehouseSelect } from '@/components/inventory/WarehouseSelect';
import { toNumericWarehouseId } from '@/lib/inventoryWarehouse';
import { ReasonSelect } from '@/components/inventory/ReasonSelect';
import { useInventoryLookups } from '@/hooks/useInventoryLookups';
import { useBreadcrumbStore } from '@/store/useBreadcrumbStore';
import { TRACKING_QUANTITY, TRACKING_SERIALIZED } from '@/types/inventory';
import type { AdjustmentLineInput, InventoryItem, InventoryUnit, Adjustment, Warehouse } from '@/types/inventory';
import { AdjustmentLinesEditor } from './components/AdjustmentLinesEditor';
import { nextLineKey, type AdjustmentDraftLine } from '@/lib/inventoryAdjustmentLines';

function draftLinesFromAdjustment(a: Adjustment): AdjustmentDraftLine[] {
  return a.lines.map((line) => {
    const serialized = Boolean(line.inventoryUnitId);
    const item: InventoryItem = {
      id: line.inventoryItemId, sku: line.sku ?? '', name: line.inventoryItemName ?? '', description: '',
      unitId: 0, unitPrice: 0, isActive: true, customFields: {},
      tracking: serialized ? TRACKING_SERIALIZED : TRACKING_QUANTITY,
      thicknessMm: 0, barcode: '', createdAt: '', updatedAt: '',
    };
    const unit: InventoryUnit | null = serialized ? {
      id: line.inventoryUnitId!, serial: line.unitSerial ?? '', kind: 'slab',
      supplierCode: '', barcode: '', inventoryItemId: line.inventoryItemId,
      warehouseId: a.warehouseId, lengthMm: 0, widthMm: 0, thicknessMm: 0,
      area: Math.abs(line.qtyDelta), areaUnitId: 0, form: 'full', status: 'available',
      isUsableRemnant: false, createdAt: '', updatedAt: '',
    } : null;
    return {
      key: nextLineKey(), item, unit,
      sign: line.qtyDelta < 0 ? -1 : 1,
      qtyDelta: serialized ? '' : String(line.qtyDelta),
      reasonId: String(line.reasonId), notes: line.notes ?? '',
    };
  });
}

function toLineInput(line: AdjustmentDraftLine): AdjustmentLineInput | null {
  if (!line.item || !line.reasonId) return null;
  const serialized = line.item.tracking === TRACKING_SERIALIZED;
  if (serialized) {
    if (!line.unit) return null;
    return { inventoryItemId: line.item.id, inventoryUnitId: line.unit.id, reasonId: Number(line.reasonId), qtyDelta: line.sign, notes: line.notes || undefined };
  }
  const qty = Number(line.qtyDelta);
  if (!qty) return null;
  return { inventoryItemId: line.item.id, reasonId: Number(line.reasonId), qtyDelta: qty, notes: line.notes || undefined };
}

interface AdjustmentFormState {
  warehouseId: string;
  date: string;
  reasonId: string;
  notes: string;
  lines: AdjustmentDraftLine[];
}

function mapAdjustmentToForm(a: Adjustment, warehouses: Warehouse[]): AdjustmentFormState {
  return {
    warehouseId: warehouses.find((w) => w.name === a.warehouseName)?.id ?? '',
    date: a.date,
    reasonId: a.reasonId ? String(a.reasonId) : '',
    notes: a.notes ?? '',
    lines: draftLinesFromAdjustment(a),
  };
}

export default function EditAdjustmentPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { lookups } = useInventoryLookups();

  const { data, isLoading, error: loadError } = useQuery({
    queryKey: ['inventory-adjustment', id],
    queryFn: () => inventoryAdjustmentService.get(id),
    enabled: Boolean(id),
  });

  // Derived-from-server + local-override pattern (mirrors
  // EditPurchaseOrderPage) — avoids syncing loaded data into state via a
  // useEffect, which would fire cascading renders.
  const mapped = useMemo(
    () => (data && lookups ? mapAdjustmentToForm(data.adjustment, lookups.warehouses) : null),
    [data, lookups],
  );
  const [local, setLocal] = useState<Partial<AdjustmentFormState>>({});
  const [fieldError, setFieldError] = useState<string | null>(null);

  const warehouseId = local.warehouseId ?? mapped?.warehouseId ?? '';
  const date = local.date ?? mapped?.date ?? '';
  const reasonId = local.reasonId ?? mapped?.reasonId ?? '';
  const notes = local.notes ?? mapped?.notes ?? '';
  const lines = local.lines ?? mapped?.lines ?? [];

  const setWarehouseId = (v: string) => setLocal((p) => ({ ...p, warehouseId: v }));
  const setDate = (v: string) => setLocal((p) => ({ ...p, date: v }));
  const setReasonId = (v: string) => setLocal((p) => ({ ...p, reasonId: v }));
  const setNotes = (v: string) => setLocal((p) => ({ ...p, notes: v }));
  const setLines = (v: AdjustmentDraftLine[]) => setLocal((p) => ({ ...p, lines: v }));

  const setLabel = useBreadcrumbStore((s) => s.setLabel);
  const clearLabel = useBreadcrumbStore((s) => s.clearLabel);
  useEffect(() => {
    if (data?.adjustment.number) {
      setLabel(id, data.adjustment.number);
      return () => clearLabel(id);
    }
  }, [id, data?.adjustment.number, setLabel, clearLabel]);

  const { mutate: save, isPending, error: saveError } = useMutation({
    mutationFn: () => {
      const lineInputs = lines.map(toLineInput).filter((l): l is AdjustmentLineInput => l !== null);
      return inventoryAdjustmentService.update(id, {
        warehouseId: toNumericWarehouseId(lookups?.warehouses ?? [], warehouseId) || data!.adjustment.warehouseId,
        date, reasonId: reasonId ? Number(reasonId) : undefined, notes, lines: lineInputs,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory-adjustments'] });
      queryClient.invalidateQueries({ queryKey: ['inventory-adjustment', id] });
      navigate(`/inventory/adjustment/${id}`);
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const lineInputs = lines.map(toLineInput).filter(Boolean);
    if (lineInputs.length === 0) { setFieldError('At least one complete line is required.'); return; }
    setFieldError(null);
    save();
  }

  if (isLoading || !mapped) return <div className="p-6"><Spinner label="Loading adjustment…" /></div>;
  if (loadError || !data) return <div className="p-6"><ErrorNote>{apiErrorMessage(loadError, 'Failed to load adjustment.')}</ErrorNote></div>;

  return (
    <div className="flex flex-col flex-1 min-h-0 bg-stone-50">
      <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
        <CrmPageHeader
          backLabel="Adjustments"
          onBack={() => navigate(`/inventory/adjustment/${id}`)}
          icon={ClipboardEdit}
          title={data.adjustment.number || 'Edit Adjustment'}
          actions={(
            <button type="submit" disabled={isPending} className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-3.5 py-1.5 text-xs font-semibold text-stone-900 hover:bg-brand-hover disabled:opacity-50 transition-all shadow-sm">
              {isPending ? <Loader2 className="size-3 animate-spin" /> : <Save className="size-3" />}
              {isPending ? 'Saving…' : 'Save Changes'}
            </button>
          )}
        />

        {(saveError || fieldError) && (
          <div className="shrink-0 flex items-start gap-3 border-b border-red-200 bg-red-50 px-5 py-2.5">
            <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-red-100"><AlertCircle className="size-3 text-red-600" /></span>
            <p className="text-xs text-red-700"><span className="font-bold">Error: </span>{fieldError || apiErrorMessage(saveError, 'Failed to save adjustment.')}</p>
          </div>
        )}

        <div className="flex-1 overflow-y-auto modal-scrollbar">
          <div className="px-4 py-3 pb-24 space-y-2 3xl:px-10 3xl:py-5 4xl:px-16 4xl:py-8">
            <ModernSection title="Header" index={0}>
              <div className="grid grid-cols-1 gap-x-5 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
                <ModernFieldShell label="Warehouse" required>
                  <WarehouseSelect warehouses={lookups?.warehouses ?? []} value={warehouseId} onChange={setWarehouseId} required />
                </ModernFieldShell>
                <ModernFieldShell label="Date" required>
                  <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={fieldCls} aria-label="Date" required />
                </ModernFieldShell>
                <ModernFieldShell label="Document Reason">
                  <ReasonSelect reasons={lookups?.reasons ?? []} value={reasonId} onChange={setReasonId} required={false} />
                </ModernFieldShell>
                <div className="sm:col-span-2 lg:col-span-3">
                  <ModernFieldShell label="Notes">
                    <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className={`${fieldCls} h-auto resize-none`} aria-label="Notes" />
                  </ModernFieldShell>
                </div>
              </div>
            </ModernSection>

            <ModernSection title="Lines" index={1}>
              <AdjustmentLinesEditor lines={lines} onChange={setLines} warehouseId={warehouseId} />
            </ModernSection>
          </div>
        </div>

        <FormActionBar onCancel={() => navigate(`/inventory/adjustment/${id}`)} isPending={isPending} submitLabel="Save Changes" />
      </form>
    </div>
  );
}
