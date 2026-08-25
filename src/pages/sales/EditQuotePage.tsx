import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { FileText, AlertCircle, Loader2, Save, Lock } from 'lucide-react';
import { quoteService } from '@/services/quoteService';
import { lookupService } from '@/services/lookupService';
import { attachmentService } from '@/services/attachmentService';
import { apiErrorMessage } from '@/api/tenantClient';
import { FormActionBar } from '@/components/crm/FormPrimitives';
import { CrmPageHeader } from '@/pages/crm/components/CrmPageHeader';
import { Spinner, ErrorNote } from '@/components/tenant/ui';
import { useBreadcrumbStore } from '@/store/useBreadcrumbStore';
import { QuoteFormBody } from './components/QuoteFormBody';
import { QuoteStatusControl } from './components/QuoteStatusControl';
import type { CustomerRef } from './components/CustomerPicker';
import {
  fromQuote, toCreatePayload, PAGE_TABS, type PageTab,
  type QuoteLineItem, QUOTE_TERMINAL_STATUSES,
} from '@/lib/quoteForm';

// Stable reference so `lineItems`'s fallback doesn't create a new array
// identity every render (which would defeat the totals useMemo below).
const EMPTY_ITEMS: QuoteLineItem[] = [];

export default function EditQuotePage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<PageTab>(PAGE_TABS[0].key);

  const [localData, setLocalData] = useState<Record<string, unknown> | null>(null);
  const [localLineItems, setLocalLineItems] = useState<QuoteLineItem[] | null>(null);
  const [localCustomer, setLocalCustomer] = useState<CustomerRef | null>(null);
  const [localStatusCode, setLocalStatusCode] = useState<string | null>(null);

  const { data: quote, isLoading, error: loadError } = useQuery({
    queryKey: ['quote', id],
    queryFn: () => quoteService.getQuote(id),
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
    if (quote?.quoteNumber) {
      setLabel(id, quote.quoteNumber);
      return () => clearLabel(id);
    }
  }, [id, quote?.quoteNumber, setLabel, clearLabel]);

  const mapped = useMemo(() => (quote ? fromQuote(quote) : null), [quote]);
  const data = localData ?? mapped?.data ?? {};
  const lineItems = localLineItems ?? mapped?.lineItems ?? EMPTY_ITEMS;
  const customer = localCustomer ?? mapped?.customer ?? null;
  const statusCode = localStatusCode ?? quote?.statusCode ?? '';
  const approvalStatus = quote?.approvalStatus ?? 'none';
  const gated = quote?.gated ?? false;
  const isTerminal = QUOTE_TERMINAL_STATUSES.has(statusCode);

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
    mutationFn: (toStatusCode: string) => quoteService.transition(id, toStatusCode),
    onSuccess: (updated) => {
      setLocalStatusCode(updated.statusCode);
      queryClient.invalidateQueries({ queryKey: ['quote', id] });
      queryClient.invalidateQueries({ queryKey: ['quotes'] });
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
    mutationFn: () => quoteService.updateQuote(id, toCreatePayload(data, lineItems)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quote', id] });
      queryClient.invalidateQueries({ queryKey: ['quotes'] });
      navigate(`/sales/quote/${id}`);
    },
  });

  if (isLoading) return <div className="p-6"><Spinner label="Loading quote…" /></div>;
  if (loadError || !quote)
    return <div className="p-6"><ErrorNote>{apiErrorMessage(loadError, 'Failed to load quote.')}</ErrorNote></div>;

  const saveError = save.error ?? transition.error;

  if (isTerminal) {
    return (
      <div className="flex flex-col flex-1 min-h-0 bg-stone-50">
        <CrmPageHeader
          backLabel="Quotes"
          onBack={() => navigate(`/sales/quote/${id}`)}
          icon={FileText}
          title={quote.quoteNumber || 'Quote'}
          subtitle={quote.customer.name}
        />
        <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
          <Lock className="size-8 text-stone-300" aria-hidden="true" />
          <p className="text-sm font-semibold text-stone-700">
            This quote is {quote.status} and can no longer be edited.
          </p>
          <p className="text-xs text-stone-400">{quote.status} quotes are locked server-side.</p>
          <button
            type="button"
            onClick={() => navigate(`/sales/quote/${id}`)}
            className="mt-2 rounded-lg border border-stone-200 bg-white px-3.5 py-1.5 text-xs font-medium text-stone-600 hover:bg-stone-50 transition-colors"
          >
            Back to quote
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
          backLabel="Quotes"
          onBack={() => navigate('/sales/quote')}
          icon={FileText}
          title={quote.quoteNumber || 'Quote'}
          subtitle={customer?.name ?? 'Edit quote'}
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
              {apiErrorMessage(saveError, 'Failed to save quote.')}
            </p>
          </div>
        )}

        <QuoteFormBody
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          quoteId={id}
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
          statusControl={(
            <QuoteStatusControl
              quote={{ statusCode, approvalStatus, gated, hasAttachments }}
              onChange={handleStatusChange}
              disabled={transition.isPending}
            />
          )}
          sourceEstimate={quote.estimate ? { id: quote.estimate.id, number: quote.estimate.number } : null}
        />

        <FormActionBar
          onCancel={() => navigate(`/sales/quote/${id}`)}
          isPending={save.isPending}
        />
      </form>
    </div>
  );
}
