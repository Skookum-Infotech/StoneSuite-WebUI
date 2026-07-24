import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Inbox, AlertCircle, Loader2, Save, Lock } from 'lucide-react';
import { itemReceiptService } from '@/services/itemReceiptService';
import { purchaseOrderService } from '@/services/purchaseOrderService';
import { lookupService } from '@/services/lookupService';
import { apiErrorMessage } from '@/api/tenantClient';
import { FormActionBar } from '@/components/crm/FormPrimitives';
import { CrmPageHeader } from '@/pages/crm/components/CrmPageHeader';
import { Spinner, ErrorNote } from '@/components/tenant/ui';
import { useBreadcrumbStore } from '@/store/useBreadcrumbStore';
import { ItemReceiptFormBody } from './components/ItemReceiptFormBody';
import {
  fromItemReceipt, toUpdatePayload, validateReceiptLines, mergeReceiptLines,
  IR_EDITABLE_STATUSES, irStatusLabel, PAGE_TABS, type PageTab, type ItemReceiptDraftLine,
} from '@/lib/itemReceiptForm';

const EMPTY_CUSTOM: Record<string, unknown> = {};

// Editing an item receipt is PEND-only (itemreceipt/store_update.go) — once
// posted, its quantities have moved through the ledger, so any other status
// renders read-only with "Void and reissue to correct" (mirrors
// EditPurchaseOrderPage's non-draft lock).
export default function EditItemReceiptPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<PageTab>(PAGE_TABS[0].key);
  const [localData, setLocalData] = useState<Record<string, unknown> | null>(null);
  const [localLines, setLocalLines] = useState<ItemReceiptDraftLine[] | null>(null);
  const [localCustomFields, setLocalCustomFields] = useState<Record<string, unknown> | null>(null);

  const { data: ir, isLoading, error: loadError } = useQuery({
    queryKey: ['item-receipt', id],
    queryFn: () => itemReceiptService.getItemReceipt(id),
    enabled: Boolean(id),
  });

  const { data: po, isLoading: poLoading, error: poError } = useQuery({
    queryKey: ['purchase-order', ir?.purchaseOrder.id],
    queryFn: () => purchaseOrderService.getPurchaseOrder(ir!.purchaseOrder.id),
    enabled: Boolean(ir?.purchaseOrder.id),
  });

  const { data: lookups } = useQuery({
    queryKey: ['crm-lookups'],
    queryFn: lookupService.getCrmLookups,
    staleTime: 10 * 60 * 1000,
  });

  const setLabel = useBreadcrumbStore((s) => s.setLabel);
  const clearLabel = useBreadcrumbStore((s) => s.clearLabel);
  useEffect(() => {
    if (ir?.itemReceiptNumber) {
      setLabel(id, ir.itemReceiptNumber);
      return () => clearLabel(id);
    }
  }, [id, ir?.itemReceiptNumber, setLabel, clearLabel]);

  const mapped = useMemo(() => (ir ? fromItemReceipt(ir) : null), [ir]);
  const mergedLines = useMemo(
    () => (po && ir ? mergeReceiptLines(po.items, ir.items ?? []) : []),
    [po, ir],
  );
  const data = localData ?? mapped?.data ?? {};
  const lines = localLines ?? mergedLines;
  const customFieldValues = localCustomFields ?? mapped?.customFieldValues ?? EMPTY_CUSTOM;
  const isLocked = ir ? !IR_EDITABLE_STATUSES.has(ir.statusCode) : false;

  const set = useCallback(
    (key: string, value: unknown) => setLocalData((prev) => ({ ...(prev ?? mapped?.data ?? {}), [key]: value })),
    [mapped],
  );
  const setCustomField = useCallback(
    (key: string, value: unknown) => setLocalCustomFields((prev) => ({ ...(prev ?? mapped?.customFieldValues ?? {}), [key]: value })),
    [mapped],
  );

  const validationErrors = validateReceiptLines(lines);

  const save = useMutation({
    mutationFn: () => {
      if (validationErrors.length > 0) throw new Error(validationErrors[0]);
      return itemReceiptService.updateItemReceipt(id, toUpdatePayload(data, lines, customFieldValues));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['item-receipt', id] });
      queryClient.invalidateQueries({ queryKey: ['item-receipts'] });
      navigate(`/purchases/item_receipt/${id}`);
    },
  });

  if (isLoading || (Boolean(ir) && poLoading)) return <div className="p-6"><Spinner label="Loading item receipt…" /></div>;
  if (loadError || !ir)
    return <div className="p-6"><ErrorNote>{apiErrorMessage(loadError, 'Failed to load item receipt.')}</ErrorNote></div>;
  if (poError || !po)
    return <div className="p-6"><ErrorNote>{apiErrorMessage(poError, 'Failed to load the source purchase order.')}</ErrorNote></div>;

  if (isLocked) {
    return (
      <div className="flex flex-col flex-1 min-h-0 bg-stone-50">
        <CrmPageHeader
          backLabel="Item Receipts"
          onBack={() => navigate(`/purchases/item_receipt/${id}`)}
          icon={Inbox}
          title={ir.itemReceiptNumber || 'Item Receipt'}
          subtitle={ir.vendor.name}
        />
        <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
          <Lock className="size-8 text-stone-300" aria-hidden="true" />
          <p className="text-sm font-semibold text-stone-700">
            This item receipt is {irStatusLabel(ir.statusCode)} and can no longer be edited.
          </p>
          <p className="text-xs text-stone-400">
            {ir.statusCode === 'VOID'
              ? 'A voided receipt is terminal.'
              : 'Void and reissue a new receipt to make changes — a posted receipt is immutable.'}
          </p>
          <button
            type="button"
            onClick={() => navigate(`/purchases/item_receipt/${id}`)}
            className="mt-2 rounded-lg border border-stone-200 bg-white px-3.5 py-1.5 text-xs font-medium text-stone-600 hover:bg-stone-50 transition-colors"
          >
            Back to item receipt
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1 min-h-0 bg-stone-50">
      <form
        onSubmit={(e) => { e.preventDefault(); save.mutate(); }}
        className="flex flex-col flex-1 min-h-0"
      >
        <CrmPageHeader
          backLabel="Item Receipts"
          onBack={() => navigate('/purchases/item_receipt')}
          icon={Inbox}
          title={ir.itemReceiptNumber || 'Item Receipt'}
          subtitle={`Against ${po.purchaseOrderNumber}`}
          actions={(
            <button type="submit" disabled={save.isPending}
              className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-3.5 py-1.5 text-xs font-semibold text-stone-900 hover:bg-brand-hover disabled:opacity-50 transition-all shadow-sm">
              {save.isPending ? <Loader2 className="size-3 animate-spin" /> : <Save className="size-3" />}
              {save.isPending ? 'Saving…' : 'Save Changes'}
            </button>
          )}
        />

        {save.error && (
          <div className="shrink-0 flex items-start gap-3 border-b border-red-200 bg-red-50 px-5 py-2.5">
            <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-red-100">
              <AlertCircle className="size-3 text-red-600" />
            </span>
            <p className="text-xs text-red-700">
              <span className="font-bold">Error: </span>
              {apiErrorMessage(save.error, 'Failed to save item receipt.')}
            </p>
          </div>
        )}

        <ItemReceiptFormBody
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          itemReceiptId={id}
          data={data}
          set={set}
          lines={lines}
          setLines={setLocalLines}
          sourcePurchaseOrder={{ id: po.id, number: po.purchaseOrderNumber, vendorName: po.vendor.name }}
          customFieldValues={customFieldValues}
          setCustomField={setCustomField}
          lookups={lookups}
        />

        <FormActionBar
          onCancel={() => navigate(`/purchases/item_receipt/${id}`)}
          isPending={save.isPending}
        />
      </form>
    </div>
  );
}
