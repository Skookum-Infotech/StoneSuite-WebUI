import { useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { Wrench, AlertCircle, Loader2, Save } from 'lucide-react';
import { fabricationService } from '@/services/fabricationService';
import { salesOrderService } from '@/services/salesOrderService';
import { lookupService } from '@/services/lookupService';
import { apiErrorMessage } from '@/api/tenantClient';
import { FormActionBar } from '@/components/crm/FormPrimitives';
import { CrmPageHeader } from '@/pages/crm/components/CrmPageHeader';
import { type EditableFilesPanelHandle } from '@/components/crm/CrmSubTabsPanel';
import type { FabricationSourceOrder } from './components/FabricationSourceOrderPicker';
import { FabricationJobFormBody } from './components/FabricationJobFormBody';
import {
  fjDefaults, toJobFields, toPieceInput, PAGE_TABS, type PageTab, type FJPieceRow,
} from '@/lib/fabricationForm';

export default function AddFabricationJobPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const panelRef = useRef<EditableFilesPanelHandle>(null);

  const [activeTab, setActiveTab] = useState<PageTab>(PAGE_TABS[0].key);
  const [data, setData] = useState<Record<string, unknown>>(fjDefaults);
  const [pieces, setPieces] = useState<FJPieceRow[]>([]);
  const [sourceOrder, setSourceOrder] = useState<FabricationSourceOrder | null>(null);

  const set = useCallback((key: string, value: unknown) => setData((d) => ({ ...d, [key]: value })), []);

  const { data: lookups } = useQuery({
    queryKey: ['crm-lookups'],
    queryFn: lookupService.getCrmLookups,
    staleTime: 10 * 60 * 1000,
  });

  // Full source order (for its line items, offered as a piece's optional
  // sales-order-line link) — only fetched once a sales order is picked.
  const { data: sourceOrderDetail } = useQuery({
    queryKey: ['sales-order', sourceOrder?.id],
    queryFn: () => salesOrderService.getOrder(sourceOrder!.id),
    enabled: Boolean(sourceOrder?.id),
  });
  const sourceOrderItems = (sourceOrderDetail?.items ?? []).map((line) => ({
    id: line.id,
    label: `#${line.lineNumber} ${line.itemName || line.description || ''}`.trim(),
  }));

  const { mutate: save, isPending, error: saveError } = useMutation({
    mutationFn: () => {
      if (!sourceOrder) throw new Error('A sales order is required to open a fabrication job.');
      return fabricationService.createJob({
        salesOrderUuid: sourceOrder.id,
        ...toJobFields(data),
        pieces: pieces.map(toPieceInput),
      });
    },
    onSuccess: async (job) => {
      queryClient.invalidateQueries({ queryKey: ['fabrication-jobs'] });
      if (panelRef.current?.hasStagedFiles()) {
        try { await panelRef.current.uploadStagedTo(job.id); } catch { /* non-fatal */ }
      }
      navigate('/sales/installation');
    },
  });

  return (
    <div className="flex flex-col flex-1 min-h-0 bg-stone-50">
      <form onSubmit={(e) => { e.preventDefault(); save(); }} className="flex flex-col flex-1 min-h-0">
        <CrmPageHeader
          backLabel="Installation / Fabrication"
          onBack={() => navigate('/sales/installation')}
          icon={Wrench}
          title="New Fabrication Job"
          subtitle="Every job starts from an existing sales order."
          actions={(
            <button type="submit" disabled={isPending || !sourceOrder}
              className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-3.5 py-1.5 text-xs font-semibold text-stone-900 hover:bg-brand-hover disabled:opacity-50 transition-all shadow-sm">
              {isPending ? <Loader2 className="size-3 animate-spin" /> : <Save className="size-3" />}
              {isPending ? 'Saving…' : 'Save Job'}
            </button>
          )}
        />

        {saveError && (
          <div className="shrink-0 flex items-start gap-3 border-b border-red-200 bg-red-50 px-5 py-2.5">
            <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-red-100">
              <AlertCircle className="size-3 text-red-600" />
            </span>
            <p className="text-xs text-red-700">
              <span className="font-bold">Error: </span>
              {apiErrorMessage(saveError, 'Failed to save fabrication job.')}
            </p>
          </div>
        )}

        <FabricationJobFormBody
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          data={data}
          set={set}
          sourceOrder={sourceOrder}
          setSourceOrder={setSourceOrder}
          pieces={pieces}
          setPieces={setPieces}
          sourceOrderItems={sourceOrderItems}
          lookups={lookups}
          filesPanelRef={panelRef}
        />

        <FormActionBar
          onCancel={() => navigate('/sales/installation')}
          isPending={isPending}
          submitLabel="Save Job"
        />
      </form>
    </div>
  );
}
