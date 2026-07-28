import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ClipboardEdit, AlertCircle, Loader2, Save } from 'lucide-react';
import { inventoryAdjustmentService } from '@/services/inventoryAdjustmentService';
import { apiErrorMessage } from '@/api/tenantClient';
import { FormActionBar, ModernSection, ModernFieldShell } from '@/components/crm/FormPrimitives';
import { CrmPageHeader } from '@/pages/crm/components/CrmPageHeader';
import { fieldCls } from '@/components/crm/formUtils';
import { WarehouseSelect } from '@/components/inventory/WarehouseSelect';
import { toNumericWarehouseId } from '@/lib/inventoryWarehouse';
import { ReasonSelect } from '@/components/inventory/ReasonSelect';
import { useInventoryLookups } from '@/hooks/useInventoryLookups';
import { TRACKING_SERIALIZED } from '@/types/inventory';
import type { AdjustmentLineInput } from '@/types/inventory';
import { AdjustmentLinesEditor } from './components/AdjustmentLinesEditor';
import { emptyAdjustmentLine, type AdjustmentDraftLine } from '@/lib/inventoryAdjustmentLines';

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

export default function AddAdjustmentPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { lookups } = useInventoryLookups();

  const [warehouseId, setWarehouseId] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [reasonId, setReasonId] = useState('');
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState<AdjustmentDraftLine[]>([emptyAdjustmentLine()]);
  const [fieldError, setFieldError] = useState<string | null>(null);

  const { mutate: save, isPending, error: saveError } = useMutation({
    mutationFn: () => {
      const lineInputs = lines.map(toLineInput).filter((l): l is AdjustmentLineInput => l !== null);
      return inventoryAdjustmentService.create({
        warehouseId: toNumericWarehouseId(lookups?.warehouses ?? [], warehouseId),
        date,
        reasonId: reasonId ? Number(reasonId) : undefined,
        notes,
        lines: lineInputs,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory-adjustments'] });
      navigate('/inventory/adjustment');
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!warehouseId) { setFieldError('A warehouse is required.'); return; }
    const lineInputs = lines.map(toLineInput).filter(Boolean);
    if (lineInputs.length === 0) { setFieldError('At least one complete line (item, reason, and quantity or unit) is required.'); return; }
    setFieldError(null);
    save();
  }

  return (
    <div className="flex flex-col flex-1 min-h-0 bg-stone-50">
      <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
        <CrmPageHeader
          backLabel="Adjustments"
          onBack={() => navigate('/inventory/adjustment')}
          icon={ClipboardEdit}
          title="New Adjustment"
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

        <FormActionBar onCancel={() => navigate('/inventory/adjustment')} isPending={isPending} submitLabel="Save Draft" />
      </form>
    </div>
  );
}
