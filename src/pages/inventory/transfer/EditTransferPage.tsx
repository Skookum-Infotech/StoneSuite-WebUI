import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Repeat, AlertCircle, Loader2, Save } from 'lucide-react';
import { inventoryTransferService } from '@/services/inventoryTransferService';
import { apiErrorMessage } from '@/api/tenantClient';
import { FormActionBar, ModernSection, ModernFieldShell } from '@/components/crm/FormPrimitives';
import { CrmPageHeader } from '@/pages/crm/components/CrmPageHeader';
import { fieldCls } from '@/components/crm/formUtils';
import { Spinner, ErrorNote } from '@/components/tenant/ui';
import { WarehouseSelect } from '@/components/inventory/WarehouseSelect';
import { toNumericWarehouseId } from '@/lib/inventoryWarehouse';
import { BinPicker } from '@/components/inventory/BinPicker';
import { useInventoryLookups } from '@/hooks/useInventoryLookups';
import { inventoryBinService } from '@/services/inventoryBinService';
import { useBreadcrumbStore } from '@/store/useBreadcrumbStore';
import { TRACKING_QUANTITY, TRACKING_SERIALIZED } from '@/types/inventory';
import type { TransferLineInput, InventoryItem, InventoryUnit, Transfer, Warehouse } from '@/types/inventory';
import { TransferLinesEditor } from './components/TransferLinesEditor';
import { nextLineKey, type TransferDraftLine } from '@/lib/inventoryTransferLines';

function draftLinesFromTransfer(t: Transfer): TransferDraftLine[] {
  return t.lines.map((line) => {
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
      warehouseId: t.fromWarehouseId, lengthMm: 0, widthMm: 0, thicknessMm: 0,
      area: line.qty, areaUnitId: 0, form: 'full', status: 'available',
      isUsableRemnant: false, createdAt: '', updatedAt: '',
    } : null;
    return { key: nextLineKey(), item, unit, qty: serialized ? '' : String(line.qty), notes: line.notes ?? '' };
  });
}

function toLineInput(line: TransferDraftLine): TransferLineInput | null {
  if (!line.item) return null;
  const serialized = line.item.tracking === TRACKING_SERIALIZED;
  if (serialized) {
    if (!line.unit) return null;
    return { inventoryItemId: line.item.id, inventoryUnitId: line.unit.id, qty: 0, notes: line.notes || undefined };
  }
  const qty = Number(line.qty);
  if (!qty) return null;
  return { inventoryItemId: line.item.id, qty, notes: line.notes || undefined };
}

interface TransferFormState {
  fromWarehouseId: string;
  toWarehouseId: string;
  toBinId: string;
  date: string;
  expectedDate: string;
  carrier: string;
  trackingNumber: string;
  notes: string;
  lines: TransferDraftLine[];
}

function mapTransferToForm(t: Transfer, warehouses: Warehouse[]): TransferFormState {
  return {
    fromWarehouseId: warehouses.find((w) => w.name === t.fromWarehouseName)?.id ?? '',
    toWarehouseId: warehouses.find((w) => w.name === t.toWarehouseName)?.id ?? '',
    toBinId: t.toBinId ?? '',
    date: t.date,
    expectedDate: t.expectedDate ?? '',
    carrier: t.carrier ?? '',
    trackingNumber: t.trackingNumber ?? '',
    notes: t.notes ?? '',
    lines: draftLinesFromTransfer(t),
  };
}

export default function EditTransferPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { lookups } = useInventoryLookups();

  const { data, isLoading, error: loadError } = useQuery({
    queryKey: ['inventory-transfer', id],
    queryFn: () => inventoryTransferService.get(id),
    enabled: Boolean(id),
  });

  // Derived-from-server + local-override pattern (mirrors
  // EditPurchaseOrderPage) — avoids syncing loaded data into state via a
  // useEffect, which would fire cascading renders.
  const mapped = useMemo(
    () => (data && lookups ? mapTransferToForm(data.transfer, lookups.warehouses) : null),
    [data, lookups],
  );
  const [local, setLocal] = useState<Partial<TransferFormState>>({});
  const [fieldError, setFieldError] = useState<string | null>(null);

  const fromWarehouseId = local.fromWarehouseId ?? mapped?.fromWarehouseId ?? '';
  const toWarehouseId = local.toWarehouseId ?? mapped?.toWarehouseId ?? '';
  const toBinId = local.toBinId ?? mapped?.toBinId ?? '';
  const date = local.date ?? mapped?.date ?? '';
  const expectedDate = local.expectedDate ?? mapped?.expectedDate ?? '';
  const carrier = local.carrier ?? mapped?.carrier ?? '';
  const trackingNumber = local.trackingNumber ?? mapped?.trackingNumber ?? '';
  const notes = local.notes ?? mapped?.notes ?? '';
  const lines = local.lines ?? mapped?.lines ?? [];

  const { data: bins = [] } = useQuery({
    queryKey: ['inventory-bins-tree', toWarehouseId],
    queryFn: () => inventoryBinService.getTree(toWarehouseId),
    enabled: Boolean(toWarehouseId),
  });

  const setFromWarehouseId = (v: string) => setLocal((p) => ({ ...p, fromWarehouseId: v }));
  const setToWarehouseId = (v: string) => setLocal((p) => ({ ...p, toWarehouseId: v, toBinId: '' }));
  const setToBinId = (v: string) => setLocal((p) => ({ ...p, toBinId: v }));
  const setDate = (v: string) => setLocal((p) => ({ ...p, date: v }));
  const setExpectedDate = (v: string) => setLocal((p) => ({ ...p, expectedDate: v }));
  const setCarrier = (v: string) => setLocal((p) => ({ ...p, carrier: v }));
  const setTrackingNumber = (v: string) => setLocal((p) => ({ ...p, trackingNumber: v }));
  const setNotes = (v: string) => setLocal((p) => ({ ...p, notes: v }));
  const setLines = (v: TransferDraftLine[]) => setLocal((p) => ({ ...p, lines: v }));

  const setLabel = useBreadcrumbStore((s) => s.setLabel);
  const clearLabel = useBreadcrumbStore((s) => s.clearLabel);
  useEffect(() => {
    if (data?.transfer.number) {
      setLabel(id, data.transfer.number);
      return () => clearLabel(id);
    }
  }, [id, data?.transfer.number, setLabel, clearLabel]);

  const { mutate: save, isPending, error: saveError } = useMutation({
    mutationFn: () => {
      const lineInputs = lines.map(toLineInput).filter((l): l is TransferLineInput => l !== null);
      return inventoryTransferService.update(id, {
        fromWarehouseId: toNumericWarehouseId(lookups?.warehouses ?? [], fromWarehouseId) || data!.transfer.fromWarehouseId,
        toWarehouseId: toNumericWarehouseId(lookups?.warehouses ?? [], toWarehouseId) || data!.transfer.toWarehouseId,
        toBinId: toBinId || undefined,
        date, expectedDate: expectedDate || undefined, carrier, trackingNumber, notes,
        lines: lineInputs,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory-transfers'] });
      queryClient.invalidateQueries({ queryKey: ['inventory-transfer', id] });
      navigate(`/inventory/transfer/${id}`);
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (fromWarehouseId && toWarehouseId && fromWarehouseId === toWarehouseId) { setFieldError('Source and destination must differ.'); return; }
    const lineInputs = lines.map(toLineInput).filter(Boolean);
    if (lineInputs.length === 0) { setFieldError('At least one complete line is required.'); return; }
    setFieldError(null);
    save();
  }

  if (isLoading || !mapped) return <div className="p-6"><Spinner label="Loading transfer…" /></div>;
  if (loadError || !data) return <div className="p-6"><ErrorNote>{apiErrorMessage(loadError, 'Failed to load transfer.')}</ErrorNote></div>;

  return (
    <div className="flex flex-col flex-1 min-h-0 bg-stone-50">
      <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
        <CrmPageHeader
          backLabel="Transfers"
          onBack={() => navigate(`/inventory/transfer/${id}`)}
          icon={Repeat}
          title={data.transfer.number || 'Edit Transfer'}
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
            <p className="text-xs text-red-700"><span className="font-bold">Error: </span>{fieldError || apiErrorMessage(saveError, 'Failed to save transfer.')}</p>
          </div>
        )}

        <div className="flex-1 overflow-y-auto modal-scrollbar">
          <div className="px-4 py-3 pb-24 space-y-2 3xl:px-10 3xl:py-5 4xl:px-16 4xl:py-8">
            <ModernSection title="Header" index={0}>
              <div className="grid grid-cols-1 gap-x-5 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
                <ModernFieldShell label="From Warehouse" required>
                  <WarehouseSelect warehouses={lookups?.warehouses ?? []} value={fromWarehouseId} onChange={setFromWarehouseId} required />
                </ModernFieldShell>
                <ModernFieldShell label="To Warehouse" required>
                  <WarehouseSelect warehouses={lookups?.warehouses ?? []} value={toWarehouseId} onChange={setToWarehouseId} required />
                </ModernFieldShell>
                <ModernFieldShell label="To Bin">
                  <BinPicker bins={bins} value={toBinId} onChange={setToBinId} label="To Bin" allowEmpty emptyLabel="— No bin —" />
                </ModernFieldShell>
                <ModernFieldShell label="Date" required>
                  <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={fieldCls} aria-label="Date" required />
                </ModernFieldShell>
                <ModernFieldShell label="Expected Date">
                  <input type="date" value={expectedDate} onChange={(e) => setExpectedDate(e.target.value)} className={fieldCls} aria-label="Expected date" />
                </ModernFieldShell>
                <ModernFieldShell label="Carrier">
                  <input type="text" value={carrier} onChange={(e) => setCarrier(e.target.value)} className={fieldCls} aria-label="Carrier" />
                </ModernFieldShell>
                <ModernFieldShell label="Tracking #">
                  <input type="text" value={trackingNumber} onChange={(e) => setTrackingNumber(e.target.value)} className={fieldCls} aria-label="Tracking number" />
                </ModernFieldShell>
                <div className="sm:col-span-2 lg:col-span-3">
                  <ModernFieldShell label="Notes">
                    <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className={`${fieldCls} h-auto resize-none`} aria-label="Notes" />
                  </ModernFieldShell>
                </div>
              </div>
            </ModernSection>

            <ModernSection title="Lines" index={1}>
              <TransferLinesEditor lines={lines} onChange={setLines} fromWarehouseId={String(toNumericWarehouseId(lookups?.warehouses ?? [], fromWarehouseId))} />
            </ModernSection>
          </div>
        </div>

        <FormActionBar onCancel={() => navigate(`/inventory/transfer/${id}`)} isPending={isPending} submitLabel="Save Changes" />
      </form>
    </div>
  );
}
