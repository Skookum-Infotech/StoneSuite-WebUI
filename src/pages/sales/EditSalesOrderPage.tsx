import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ShoppingCart, AlertCircle, Loader2, Save } from 'lucide-react';
import { toast } from 'sonner';
import { salesOrderService } from '@/services/salesOrderService';
import { lookupService } from '@/services/lookupService';
import { attachmentService } from '@/services/attachmentService';
import { apiErrorMessage } from '@/api/tenantClient';
import { FormActionBar } from '@/components/crm/FormPrimitives';
import { CrmPageHeader } from '@/pages/crm/components/CrmPageHeader';
import { Spinner, ErrorNote } from '@/components/tenant/ui';
import { UnsavedChangesPrompt } from '@/components/UnsavedChangesPrompt';
import { useUnsavedChangesGuard } from '@/hooks/useUnsavedChangesGuard';
import { useBreadcrumbStore } from '@/store/useBreadcrumbStore';
import { SalesOrderFormBody } from './components/SalesOrderFormBody';
import { SalesOrderStatusControl } from './components/SalesOrderStatusControl';
import type { CustomerRef } from './components/CustomerPicker';
import {
  fromOrder, toCreatePayload, PAGE_TABS, type PageTab,
  type SOLineItem, type SODrawing, SO_STATUS_CODES,
} from '@/lib/salesOrderForm';
import { statusToastLabel } from '@/lib/statusToast';

// Stable reference so `lineItems`'s fallback doesn't create a new array
// identity every render (which would defeat the totals useMemo below).
const EMPTY_ITEMS: SOLineItem[] = [];

export default function EditSalesOrderPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<PageTab>(PAGE_TABS[0].key);
  const [drawings, setDrawings] = useState<SODrawing[]>([]);

  const [localData, setLocalData] = useState<Record<string, unknown> | null>(null);
  const [localLineItems, setLocalLineItems] = useState<SOLineItem[] | null>(null);
  const [localCustomer, setLocalCustomer] = useState<CustomerRef | null>(null);
  const [localStatusCode, setLocalStatusCode] = useState<string | null>(null);

  const { data: order, isLoading, error: loadError } = useQuery({
    queryKey: ['sales-order', id],
    queryFn: () => salesOrderService.getOrder(id),
    enabled: Boolean(id),
  });

  const { data: lookups } = useQuery({
    queryKey: ['crm-lookups'],
    queryFn: lookupService.getCrmLookups,
    staleTime: 10 * 60 * 1000,
  });

  const { data: attachments } = useQuery({
    queryKey: ['record-attachments', id],
    queryFn: () => attachmentService.listAttachments(id),
    enabled: Boolean(id),
  });
  const hasAttachments = attachments ? attachments.length > 0 : undefined;

  const setLabel = useBreadcrumbStore((s) => s.setLabel);
  const clearLabel = useBreadcrumbStore((s) => s.clearLabel);
  useEffect(() => {
    if (order?.salesOrderNumber) {
      setLabel(id, order.salesOrderNumber);
      return () => clearLabel(id);
    }
  }, [id, order?.salesOrderNumber, setLabel, clearLabel]);

  const mapped = useMemo(() => (order ? fromOrder(order) : null), [order]);
  const data = localData ?? mapped?.data ?? {};
  const lineItems = localLineItems ?? mapped?.lineItems ?? EMPTY_ITEMS;
  const customer = localCustomer ?? mapped?.customer ?? null;
  const statusCode = localStatusCode ?? order?.statusCode ?? '';
  const approvalStatus = order?.approvalStatus ?? 'none';
  const gated = order?.gated ?? false;

  const set = useCallback(
    (key: string, value: unknown) => setLocalData((prev) => ({ ...(prev ?? mapped?.data ?? {}), [key]: value })),
    [mapped],
  );

  // Status changes are saved by their own transition mutation the moment they are
  // picked, so they are excluded from the snapshot — only unsaved form edits count.
  const guard = useUnsavedChangesGuard({ data, lineItems, drawings, customer }, Boolean(mapped));

  const { subtotal, discountAmt, taxTotal, total } = useMemo(() => {
    const subtotal = lineItems.reduce((s, r) => s + (parseFloat(r.amount) || 0), 0);
    const discountAmt = lineItems.reduce((s, r) => {
      const base = (parseFloat(r.quantity) || 0) * (parseFloat(r.unitPrice) || 0);
      return s + base * ((parseFloat(r.discount) || 0) / 100);
    }, 0);
    const taxTotal = lineItems.reduce((s, r) => s + (parseFloat(r.total) || 0) - (parseFloat(r.amount) || 0), 0);
    return { subtotal, discountAmt, taxTotal, total: subtotal - discountAmt + taxTotal };
  }, [lineItems]);

  const transition = useMutation({
    mutationFn: (toStatusCode: string) => salesOrderService.transition(id, toStatusCode),
    onSuccess: (updated) => {
      setLocalStatusCode(updated.statusCode);
      queryClient.invalidateQueries({ queryKey: ['sales-order', id] });
      queryClient.invalidateQueries({ queryKey: ['sales-orders'] });
      toast.success(`Moved to ${statusToastLabel(SO_STATUS_CODES, updated.statusCode)}.`);
    },
  });

  const handleStatusChange = useCallback(
    (toCode: string) => {
      if (toCode !== statusCode) {
        setLocalStatusCode(toCode);
        transition.mutate(toCode);
      }
    },
    // transition.mutate is a stable reference from TanStack Query
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [statusCode, transition.mutate],
  );

  const save = useMutation({
    mutationFn: () => salesOrderService.updateOrder(id, toCreatePayload(data, lineItems)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sales-order', id] });
      queryClient.invalidateQueries({ queryKey: ['sales-orders'] });
      guard.markClean();
      navigate('/sales/sales_order');
    },
  });

  if (isLoading) return <div className="p-6"><Spinner label="Loading sales order…" /></div>;
  if (loadError || !order)
    return <div className="p-6"><ErrorNote>{apiErrorMessage(loadError, 'Failed to load sales order.')}</ErrorNote></div>;

  const saveError = save.error ?? transition.error;

  return (
    <div className="flex flex-col flex-1 min-h-0 bg-stone-50">
      <UnsavedChangesPrompt guard={guard} />
      <form
        onSubmit={(e) => { e.preventDefault(); save.mutate(); }}
        className="flex flex-col flex-1 min-h-0"
      >
        <CrmPageHeader
          backLabel="Sales Orders"
          onBack={() => navigate('/sales/sales_order')}
          icon={ShoppingCart}
          title={order.salesOrderNumber || 'Sales Order'}
          subtitle={customer?.name ?? 'Edit sales order'}
          actions={(
            <button type="submit" disabled={save.isPending}
              className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-3.5 py-1.5 text-xs font-semibold text-stone-900 hover:bg-brand-hover disabled:opacity-50 transition-all shadow-sm">
              {save.isPending ? <Loader2 className="size-3 animate-spin" /> : <Save className="size-3" />}
              {save.isPending ? 'Saving…' : 'Save Changes'}
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
              {apiErrorMessage(saveError, 'Failed to save sales order.')}
            </p>
          </div>
        )}

        <SalesOrderFormBody
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          orderId={id}
          data={data}
          set={set}
          lineItems={lineItems}
          setLineItems={setLocalLineItems}
          drawings={drawings}
          setDrawings={setDrawings}
          customer={customer}
          setCustomer={setLocalCustomer}
          customerLocked
          lookups={lookups}
          subtotal={subtotal}
          discountAmt={discountAmt}
          taxTotal={taxTotal}
          total={total}
          statusControl={(
            <SalesOrderStatusControl
              order={{ statusCode, approvalStatus, gated, hasAttachments }}
              onChange={handleStatusChange}
              disabled={transition.isPending}
            />
          )}
        />

        <FormActionBar
          onCancel={() => navigate('/sales/sales_order')}
          isPending={save.isPending}
        />
      </form>
    </div>
  );
}
