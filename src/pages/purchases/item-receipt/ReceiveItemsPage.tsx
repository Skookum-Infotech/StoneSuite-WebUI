import { useState, useRef, useCallback, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { Inbox, AlertCircle, Loader2, Save, ArrowLeft } from 'lucide-react';
import { itemReceiptService } from '@/services/itemReceiptService';
import { purchaseOrderService } from '@/services/purchaseOrderService';
import { lookupService } from '@/services/lookupService';
import { apiErrorMessage } from '@/api/tenantClient';
import { FormActionBar } from '@/components/crm/FormPrimitives';
import { CrmPageHeader } from '@/pages/crm/components/CrmPageHeader';
import { Spinner, ErrorNote } from '@/components/tenant/ui';
import { UnsavedChangesPrompt } from '@/components/UnsavedChangesPrompt';
import { useUnsavedChangesGuard } from '@/hooks/useUnsavedChangesGuard';
import { type EditableFilesPanelHandle } from '@/components/crm/CrmSubTabsPanel';
import { ItemReceiptFormBody } from './components/ItemReceiptFormBody';
import {
  itemReceiptDefaults, toCreatePayload, validateReceiptLines, validateReceiptLineErrors, mergeReceiptLines,
  isPurchaseOrderReceivable, PAGE_TABS, type PageTab, type ItemReceiptDraftLine,
} from '@/lib/itemReceiptForm';

export default function ReceiveItemsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const purchaseOrderId = searchParams.get('po') ?? '';
  const panelRef = useRef<EditableFilesPanelHandle>(null);

  const [activeTab, setActiveTab] = useState<PageTab>(PAGE_TABS[0].key);
  const [data, setData] = useState<Record<string, unknown>>(itemReceiptDefaults);
  const [lines, setLines] = useState<ItemReceiptDraftLine[] | null>(null);
  const [customFieldValues, setCustomFieldValues] = useState<Record<string, unknown>>({});

  const set = useCallback((key: string, value: unknown) => setData((d) => ({ ...d, [key]: value })), []);
  const setCustomField = useCallback(
    (key: string, value: unknown) => setCustomFieldValues((v) => ({ ...v, [key]: value })),
    [],
  );

  const { data: po, isLoading, error: loadError } = useQuery({
    queryKey: ['purchase-order', purchaseOrderId],
    queryFn: () => purchaseOrderService.getPurchaseOrder(purchaseOrderId),
    enabled: Boolean(purchaseOrderId),
  });

  const { data: lookups } = useQuery({
    queryKey: ['crm-lookups'],
    queryFn: lookupService.getCrmLookups,
    staleTime: 10 * 60 * 1000,
  });

  const activeLines = useMemo(() => lines ?? (po ? mergeReceiptLines(po.items) : []), [lines, po]);
  const validationErrors = validateReceiptLines(activeLines);
  const lineErrors = useMemo(() => validateReceiptLineErrors(activeLines), [activeLines]);

  // Baseline once the PO has loaded — the received-quantity lines are seeded from
  // it, so an earlier baseline would flag those defaults as user edits.
  const guard = useUnsavedChangesGuard({ data, activeLines, customFieldValues }, Boolean(po));

  const { mutate: save, isPending, error: saveError } = useMutation({
    mutationFn: () => {
      if (validationErrors.length > 0) throw new Error(validationErrors[0]);
      const payload = toCreatePayload(purchaseOrderId, data, activeLines, customFieldValues);
      return itemReceiptService.createItemReceipt(payload);
    },
    onSuccess: async (ir) => {
      queryClient.invalidateQueries({ queryKey: ['item-receipts'] });
      queryClient.invalidateQueries({ queryKey: ['purchase-order-receipts', purchaseOrderId] });
      queryClient.invalidateQueries({ queryKey: ['purchase-order', purchaseOrderId] });
      if (panelRef.current?.hasStagedFiles()) {
        try { await panelRef.current.uploadStagedTo(ir.id); } catch { /* non-fatal */ }
      }
      guard.markClean();
      navigate(`/purchases/item_receipt/${ir.id}`);
    },
  });

  if (!purchaseOrderId) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
        <Inbox className="size-8 text-stone-300" aria-hidden="true" />
        <p className="text-sm font-semibold text-stone-700">Choose a purchase order to receive against.</p>
        <button
          type="button"
          onClick={() => navigate('/purchases/item_receipt')}
          className="mt-1 inline-flex items-center gap-1.5 rounded-lg border border-stone-200 bg-white px-3.5 py-1.5 text-xs font-medium text-stone-600 hover:bg-stone-50 transition-colors"
        >
          <ArrowLeft className="size-3.5" />
          Back to Item Receipts
        </button>
      </div>
    );
  }

  if (isLoading) return <div className="p-6"><Spinner label="Loading purchase order…" /></div>;
  if (loadError || !po)
    return <div className="p-6"><ErrorNote>{apiErrorMessage(loadError, 'Failed to load purchase order.')}</ErrorNote></div>;

  if (!isPurchaseOrderReceivable(po)) {
    return (
      <div className="flex flex-col flex-1 min-h-0 bg-stone-50">
        <CrmPageHeader
          backLabel="Item Receipts"
          onBack={() => navigate('/purchases/item_receipt')}
          icon={Inbox}
          title="New Item Receipt"
          subtitle={po.vendor.name}
        />
        <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
          <p className="text-sm font-semibold text-stone-700">
            {po.purchaseOrderNumber} is {po.status} and cannot be received against.
          </p>
          <p className="text-xs text-stone-400">Only Sent or Partially Received purchase orders can accept a receipt.</p>
          <button
            type="button"
            onClick={() => navigate(`/purchases/purchase_order/${po.id}`)}
            className="mt-2 rounded-lg border border-stone-200 bg-white px-3.5 py-1.5 text-xs font-medium text-stone-600 hover:bg-stone-50 transition-colors"
          >
            View purchase order
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1 min-h-0 bg-stone-50">
      <UnsavedChangesPrompt guard={guard} />
      <form onSubmit={(e) => { e.preventDefault(); save(); }} className="flex flex-col flex-1 min-h-0">
        <CrmPageHeader
          backLabel="Item Receipts"
          onBack={() => navigate('/purchases/item_receipt')}
          icon={Inbox}
          title="New Item Receipt"
          subtitle={`Against ${po.purchaseOrderNumber} · Fields marked * are required.`}
          actions={(
            <button type="submit" disabled={isPending}
              className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-3.5 py-1.5 text-xs font-semibold text-stone-900 hover:bg-brand-hover disabled:opacity-50 transition-all shadow-sm">
              {isPending ? <Loader2 className="size-3 animate-spin" /> : <Save className="size-3" />}
              {isPending ? 'Saving…' : 'Save Item Receipt'}
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
              {apiErrorMessage(saveError, 'Failed to save item receipt.')}
            </p>
          </div>
        )}

        <ItemReceiptFormBody
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          data={data}
          set={set}
          lines={activeLines}
          setLines={setLines}
          lineErrors={lineErrors}
          sourcePurchaseOrder={{ id: po.id, number: po.purchaseOrderNumber, vendorName: po.vendor.name }}
          customFieldValues={customFieldValues}
          setCustomField={setCustomField}
          lookups={lookups}
          filesPanelRef={panelRef}
        />

        <FormActionBar
          onCancel={() => navigate('/purchases/item_receipt')}
          isPending={isPending}
          submitLabel="Save Item Receipt"
        />
      </form>
    </div>
  );
}
