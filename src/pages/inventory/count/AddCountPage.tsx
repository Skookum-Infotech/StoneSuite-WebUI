import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ClipboardCheck, AlertCircle, Loader2, Save } from 'lucide-react';
import { inventoryCountService } from '@/services/inventoryCountService';
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

export default function AddCountPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { lookups } = useInventoryLookups();

  const [warehouseId, setWarehouseId] = useState('');
  const [binId, setBinId] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState('');
  const [fieldError, setFieldError] = useState<string | null>(null);

  const { data: bins = [] } = useQuery({
    queryKey: ['inventory-bins-tree', warehouseId],
    queryFn: () => inventoryBinService.getTree(warehouseId),
    enabled: Boolean(warehouseId),
  });

  function handleWarehouseChange(v: string) {
    setWarehouseId(v);
    setBinId('');
  }

  const { mutate: save, isPending, error: saveError } = useMutation({
    mutationFn: () => inventoryCountService.create({
      warehouseId: toNumericWarehouseId(lookups?.warehouses ?? [], warehouseId),
      binId: binId || undefined,
      date, notes,
    }),
    onSuccess: (count) => {
      queryClient.invalidateQueries({ queryKey: ['inventory-counts'] });
      navigate(`/inventory/count/${count.id}`);
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!warehouseId) { setFieldError('A warehouse is required.'); return; }
    setFieldError(null);
    save();
  }

  return (
    <div className="flex flex-col flex-1 min-h-0 bg-stone-50">
      <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
        <CrmPageHeader
          backLabel="Counts"
          onBack={() => navigate('/inventory/count')}
          icon={ClipboardCheck}
          title="New Count"
          subtitle="Fields marked * are required. Lines are built when you freeze — from what the system actually holds."
          actions={(
            <button type="submit" disabled={isPending} className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-3.5 py-1.5 text-xs font-semibold text-stone-900 hover:bg-brand-hover disabled:opacity-50 transition-all shadow-sm">
              {isPending ? <Loader2 className="size-3 animate-spin" /> : <Save className="size-3" />}
              {isPending ? 'Creating…' : 'Create Count'}
            </button>
          )}
        />

        {(saveError || fieldError) && (
          <div className="shrink-0 flex items-start gap-3 border-b border-red-200 bg-red-50 px-5 py-2.5">
            <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-red-100"><AlertCircle className="size-3 text-red-600" /></span>
            <p className="text-xs text-red-700"><span className="font-bold">Error: </span>{fieldError || apiErrorMessage(saveError, 'Failed to create count.')}</p>
          </div>
        )}

        <div className="flex-1 overflow-y-auto modal-scrollbar">
          <div className="px-4 py-3 pb-24 space-y-2 3xl:px-10 3xl:py-5 4xl:px-16 4xl:py-8">
            <ModernSection title="Scope" index={0}>
              <div className="grid grid-cols-1 gap-x-5 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
                <ModernFieldShell label="Warehouse" required>
                  <WarehouseSelect warehouses={lookups?.warehouses ?? []} value={warehouseId} onChange={handleWarehouseChange} required />
                </ModernFieldShell>
                <ModernFieldShell label="Bin (optional)">
                  <BinPicker bins={bins} value={binId} onChange={setBinId} label="Bin" allowEmpty emptyLabel="— Whole warehouse —" />
                </ModernFieldShell>
                <ModernFieldShell label="Date" required>
                  <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={fieldCls} aria-label="Date" required />
                </ModernFieldShell>
                <div className="sm:col-span-2 lg:col-span-3">
                  <ModernFieldShell label="Notes">
                    <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className={`${fieldCls} h-auto resize-none`} aria-label="Notes" />
                  </ModernFieldShell>
                </div>
              </div>
            </ModernSection>
          </div>
        </div>

        <FormActionBar onCancel={() => navigate('/inventory/count')} isPending={isPending} submitLabel="Create Count" />
      </form>
    </div>
  );
}
