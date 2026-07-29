import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Repeat, AlertCircle, Loader2, Save } from 'lucide-react';
import { inventoryTransferService } from '@/services/inventoryTransferService';
import { apiErrorMessage } from '@/api/tenantClient';
import { FormActionBar, ModernSection, ModernFieldShell } from '@/components/crm/FormPrimitives';
import { CrmPageHeader } from '@/pages/crm/components/CrmPageHeader';
import { fieldCls } from '@/components/crm/formUtils';
import { WarehouseSelect } from '@/components/inventory/WarehouseSelect';
import { toNumericWarehouseId } from '@/lib/inventoryWarehouse';
import { BinPicker } from '@/components/inventory/BinPicker';
import { useInventoryLookups } from '@/hooks/useInventoryLookups';
import { useQuery } from '@tanstack/react-query';
import { inventoryBinService } from '@/services/inventoryBinService';
import { TRACKING_SERIALIZED } from '@/types/inventory';
import type { TransferLineInput } from '@/types/inventory';
import { TransferLinesEditor } from './components/TransferLinesEditor';
import { emptyTransferLine, type TransferDraftLine } from '@/lib/inventoryTransferLines';

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

export default function AddTransferPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { lookups } = useInventoryLookups();

  const [fromWarehouseId, setFromWarehouseId] = useState('');
  const [toWarehouseId, setToWarehouseId] = useState('');
  const [toBinId, setToBinId] = useState('');

  const { data: bins = [] } = useQuery({
    queryKey: ['inventory-bins-tree', toWarehouseId],
    queryFn: () => inventoryBinService.getTree(toWarehouseId),
    enabled: Boolean(toWarehouseId),
  });

  function handleToWarehouseChange(v: string) {
    setToWarehouseId(v);
    setToBinId('');
  }
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [expectedDate, setExpectedDate] = useState('');
  const [carrier, setCarrier] = useState('');
  const [trackingNumber, setTrackingNumber] = useState('');
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState<TransferDraftLine[]>([emptyTransferLine()]);
  const [fieldError, setFieldError] = useState<string | null>(null);

  const { mutate: save, isPending, error: saveError } = useMutation({
    mutationFn: () => {
      const lineInputs = lines.map(toLineInput).filter((l): l is TransferLineInput => l !== null);
      return inventoryTransferService.create({
        fromWarehouseId: toNumericWarehouseId(lookups?.warehouses ?? [], fromWarehouseId),
        toWarehouseId: toNumericWarehouseId(lookups?.warehouses ?? [], toWarehouseId),
        toBinId: toBinId || undefined,
        date, expectedDate: expectedDate || undefined,
        carrier, trackingNumber, notes,
        lines: lineInputs,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory-transfers'] });
      navigate('/inventory/transfer');
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!fromWarehouseId || !toWarehouseId) { setFieldError('Source and destination warehouses are required.'); return; }
    if (fromWarehouseId === toWarehouseId) { setFieldError('Source and destination must differ.'); return; }
    const lineInputs = lines.map(toLineInput).filter(Boolean);
    if (lineInputs.length === 0) { setFieldError('At least one complete line is required.'); return; }
    setFieldError(null);
    save();
  }

  return (
    <div className="flex flex-col flex-1 min-h-0 bg-stone-50">
      <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
        <CrmPageHeader
          backLabel="Transfers"
          onBack={() => navigate('/inventory/transfer')}
          icon={Repeat}
          title="New Transfer"
          subtitle="Fields marked * are required."
          actions={(
            <button type="submit" disabled={isPending} className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-3.5 py-1.5 text-xs font-semibold text-stone-900 hover:bg-brand-hover disabled:opacity-50 transition-all shadow-sm">
              {isPending ? <Loader2 className="size-3 animate-spin" /> : <Save className="size-3" />}
              {isPending ? 'Saving…' : 'Save Draft'}
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
                  <WarehouseSelect warehouses={lookups?.warehouses ?? []} value={toWarehouseId} onChange={handleToWarehouseChange} required />
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

        <FormActionBar onCancel={() => navigate('/inventory/transfer')} isPending={isPending} submitLabel="Save Draft" />
      </form>
    </div>
  );
}
