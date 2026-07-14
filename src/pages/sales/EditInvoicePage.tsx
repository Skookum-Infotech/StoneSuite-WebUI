import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Receipt, AlertCircle, Loader2, Save, Lock } from 'lucide-react';
import { invoiceService } from '@/services/invoiceService';
import { lookupService } from '@/services/lookupService';
import { apiErrorMessage } from '@/api/tenantClient';
import { FormActionBar } from '@/components/crm/FormPrimitives';
import { CrmPageHeader } from '@/pages/crm/components/CrmPageHeader';
import { Spinner, ErrorNote } from '@/components/tenant/ui';
import { useBreadcrumbStore } from '@/store/useBreadcrumbStore';
import { InvoiceFormBody } from './components/InvoiceFormBody';
import { InvoiceStatusControl } from './components/InvoiceStatusControl';
import type { CustomerRef } from './components/CustomerPicker';
import {
  fromInvoice, toCreatePayload, PAGE_TABS, type PageTab,
  type InvoiceLineItem, INVOICE_TERMINAL_STATUSES,
} from '@/lib/invoiceForm';

// Stable reference so `lineItems`'s fallback doesn't create a new array
// identity every render (which would defeat the totals useMemo below).
const EMPTY_ITEMS: InvoiceLineItem[] = [];

export default function EditInvoicePage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<PageTab>(PAGE_TABS[0].key);

  const [localData, setLocalData] = useState<Record<string, unknown> | null>(null);
  const [localLineItems, setLocalLineItems] = useState<InvoiceLineItem[] | null>(null);
  const [localCustomer, setLocalCustomer] = useState<CustomerRef | null>(null);
  const [localStatusCode, setLocalStatusCode] = useState<string | null>(null);

  const { data: invoice, isLoading, error: loadError } = useQuery({
    queryKey: ['invoice', id],
    queryFn: () => invoiceService.getInvoice(id),
    enabled: Boolean(id),
  });

  const { data: lookups } = useQuery({
    queryKey: ['crm-lookups'],
    queryFn: lookupService.getCrmLookups,
    staleTime: 10 * 60 * 1000,
  });

  const setLabel = useBreadcrumbStore((s) => s.setLabel);
  const clearLabel = useBreadcrumbStore((s) => s.clearLabel);
  useEffect(() => {
    if (invoice?.invoiceNumber) {
      setLabel(id, invoice.invoiceNumber);
      return () => clearLabel(id);
    }
  }, [id, invoice?.invoiceNumber, setLabel, clearLabel]);

  const mapped = useMemo(() => (invoice ? fromInvoice(invoice) : null), [invoice]);
  const data = localData ?? mapped?.data ?? {};
  const lineItems = localLineItems ?? mapped?.lineItems ?? EMPTY_ITEMS;
  const customer = localCustomer ?? mapped?.customer ?? null;
  const statusCode = localStatusCode ?? invoice?.statusCode ?? '';
  const isTerminal = INVOICE_TERMINAL_STATUSES.has(statusCode);

  const set = useCallback(
    (key: string, value: unknown) => setLocalData((prev) => ({ ...(prev ?? mapped?.data ?? {}), [key]: value })),
    [mapped],
  );

  const headerTaxPercent = parseFloat(String(data.sales_tax_pct ?? '')) || 0;

  const { subtotal, discountAmt, taxTotal, total } = useMemo(() => {
    const subtotal = lineItems.reduce((s, r) => s + (parseFloat(r.amount) || 0), 0);
    const discountAmt = lineItems.reduce((s, r) => {
      const base = (parseFloat(r.quantity) || 0) * (parseFloat(r.unitPrice) || 0);
      return s + base * ((parseFloat(r.discount) || 0) / 100);
    }, 0);
    const taxTotal = subtotal * (headerTaxPercent / 100);
    return { subtotal, discountAmt, taxTotal, total: subtotal - discountAmt + taxTotal };
  }, [lineItems, headerTaxPercent]);

  const transition = useMutation({
    mutationFn: (toStatusCode: string) => invoiceService.transition(id, toStatusCode),
    onSuccess: (updated) => {
      setLocalStatusCode(updated.statusCode);
      queryClient.invalidateQueries({ queryKey: ['invoice', id] });
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
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
    mutationFn: () => invoiceService.updateInvoice(id, toCreatePayload(data, lineItems)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoice', id] });
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      navigate(`/sales/invoice/${id}`);
    },
  });

  if (isLoading) return <div className="p-6"><Spinner label="Loading invoice…" /></div>;
  if (loadError || !invoice)
    return <div className="p-6"><ErrorNote>{apiErrorMessage(loadError, 'Failed to load invoice.')}</ErrorNote></div>;

  const saveError = save.error ?? transition.error;

  if (isTerminal) {
    return (
      <div className="flex flex-col flex-1 min-h-0 bg-stone-50">
        <CrmPageHeader
          backLabel="Invoices"
          onBack={() => navigate(`/sales/invoice/${id}`)}
          icon={Receipt}
          title={invoice.invoiceNumber || 'Invoice'}
          subtitle={invoice.customer.name}
        />
        <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
          <Lock className="size-8 text-stone-300" aria-hidden="true" />
          <p className="text-sm font-semibold text-stone-700">
            This invoice is {invoice.status} and can no longer be edited.
          </p>
          <p className="text-xs text-stone-400">{invoice.status} invoices are locked server-side.</p>
          <button
            type="button"
            onClick={() => navigate(`/sales/invoice/${id}`)}
            className="mt-2 rounded-lg border border-stone-200 bg-white px-3.5 py-1.5 text-xs font-medium text-stone-600 hover:bg-stone-50 transition-colors"
          >
            Back to invoice
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
          backLabel="Invoices"
          onBack={() => navigate('/sales/invoice')}
          icon={Receipt}
          title={invoice.invoiceNumber || 'Invoice'}
          subtitle={customer?.name ?? 'Edit invoice'}
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
              {apiErrorMessage(saveError, 'Failed to save invoice.')}
            </p>
          </div>
        )}

        <InvoiceFormBody
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          invoiceId={id}
          data={data}
          set={set}
          lineItems={lineItems}
          setLineItems={setLocalLineItems}
          customer={customer}
          setCustomer={setLocalCustomer}
          customerLocked
          lookups={lookups}
          subtotal={subtotal}
          discountAmt={discountAmt}
          taxTotal={taxTotal}
          total={total}
          amountPaid={invoice.amountPaid}
          statusControl={(
            <InvoiceStatusControl
              value={statusCode}
              onChange={handleStatusChange}
              disabled={transition.isPending}
            />
          )}
        />

        <FormActionBar
          onCancel={() => navigate(`/sales/invoice/${id}`)}
          isPending={save.isPending}
        />
      </form>
    </div>
  );
}
