import { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { FileText, AlertCircle, Loader2, Save } from 'lucide-react';
import { toast } from 'sonner';
import { quoteService } from '@/services/quoteService';
import { estimateService } from '@/services/estimateService';
import { lookupService } from '@/services/lookupService';
import { apiErrorMessage } from '@/api/tenantClient';
import { FormActionBar } from '@/components/crm/FormPrimitives';
import { CrmPageHeader } from '@/pages/crm/components/CrmPageHeader';
import { type EditableFilesPanelHandle } from '@/components/crm/CrmSubTabsPanel';
import { type CustomerRef } from './components/CustomerPicker';
import { customerDefaultFields, BILL_ADDRESS_KEYS } from '@/lib/customerDefaults';
import { shipSameAsBillFields } from '@/lib/shipToDefaults';
import { defaultCountryId, defaultCurrencyId } from '@/lib/lookupDefaults';
import { InventoryItemReturnContext, useInventoryItemReturn } from '@/hooks/useInventoryItemReturn';
import { useRecordCreateReturn } from '@/hooks/useRecordCreateReturn';
import { QuoteFormBody } from './components/QuoteFormBody';
import {
  quoteDefaults, toCreatePayload, fromSourceEstimate, PAGE_TABS, type PageTab,
  type QuoteLineItem,
} from '@/lib/quoteForm';

/** Unsaved form state carried across an "Add to Inventory" round trip. */
interface QuoteDraft {
  activeTab: PageTab;
  localData: Record<string, unknown> | null;
  localLineItems: QuoteLineItem[] | null;
  localCustomer: CustomerRef | null;
  customerTouched: boolean;
  customFieldValues: Record<string, unknown>;
}

export default function AddQuotePage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const panelRef = useRef<EditableFilesPanelHandle>(null);
  const [searchParams] = useSearchParams();
  const fromEstimateId = searchParams.get('fromEstimate') ?? '';
  const inventoryReturn = useInventoryItemReturn<QuoteDraft>();
  const customerReturn = useRecordCreateReturn<QuoteDraft, CustomerRef>(
    'customer', '/crm/customer/new', { resource: 'customer', action: 'create' },
  );
  const restored = inventoryReturn.restored ?? customerReturn.restored;

  const [activeTab, setActiveTab] = useState<PageTab>(restored?.activeTab ?? PAGE_TABS[0].key);

  const { data: sourceEstimate } = useQuery({
    queryKey: ['estimate', fromEstimateId],
    queryFn: () => estimateService.getEstimate(fromEstimateId),
    enabled: Boolean(fromEstimateId),
  });

  const { data: lookups } = useQuery({
    queryKey: ['crm-lookups'],
    queryFn: lookupService.getCrmLookups,
    staleTime: 10 * 60 * 1000,
  });

  // Prefill is derived, not copied via an effect: once sourceEstimate loads,
  // `baseData`/`baseLineItems`/`baseCustomer` recompute automatically, and
  // `local*` (still null/unset) falls through to them. Once the user edits a
  // field, `local*` takes over and the prefill is no longer consulted — this
  // mirrors EditQuotePage's localData-shadows-server-state pattern instead of
  // pushing setState calls into a useEffect body. The same derivation defaults
  // a still-empty country/currency to United States/USD once lookups load,
  // without overriding a value carried over from the source estimate.
  const prefill = useMemo(
    () => (sourceEstimate ? fromSourceEstimate(sourceEstimate) : null),
    [sourceEstimate],
  );
  const baseData = useMemo(() => {
    const merged: Record<string, unknown> = { ...quoteDefaults(), ...(prefill?.data ?? {}) };
    if (lookups) {
      merged.bill_country = merged.bill_country || defaultCountryId(lookups.countries);
      merged.ship_country = merged.ship_country || defaultCountryId(lookups.countries);
      merged.currency_id = merged.currency_id || defaultCurrencyId(lookups.currencies);
    }
    return merged;
  }, [prefill, lookups]);

  const [localData, setLocalData] = useState<Record<string, unknown> | null>(restored?.localData ?? null);
  const [localLineItems, setLocalLineItems] = useState<QuoteLineItem[] | null>(restored?.localLineItems ?? null);
  const [localCustomer, setLocalCustomer] = useState<CustomerRef | null>(restored?.localCustomer ?? null);
  const [customerTouched, setCustomerTouched] = useState(restored?.customerTouched ?? false);
  const [customFieldValues, setCustomFieldValues] = useState<Record<string, unknown>>(restored?.customFieldValues ?? {});

  const data = localData ?? baseData;
  const lineItems = useMemo(() => localLineItems ?? prefill?.lineItems ?? [], [localLineItems, prefill]);
  const customer = customerTouched ? localCustomer : (prefill?.customer ?? null);

  const set = useCallback((key: string, value: unknown) => {
    setLocalData((d) => {
      const current = d ?? baseData;
      if (key === 'ship_same_as_bill' && value === true) {
        return { ...current, ...shipSameAsBillFields(current, customer?.name), [key]: value };
      }
      return { ...current, [key]: value };
    });
  }, [baseData, customer]);
  const setCustomField = useCallback(
    (key: string, value: unknown) => setCustomFieldValues((v) => ({ ...v, [key]: value })),
    [],
  );
  const setCustomer = useCallback((c: CustomerRef | null) => {
    setLocalCustomer(c);
    setCustomerTouched(true);
    if (c) {
      const defaults = customerDefaultFields(c);
      setLocalData((d) => {
        const current = d ?? baseData;
        return {
          ...current,
          ...Object.fromEntries(Object.entries(defaults).filter(([k]) => !current[k] || BILL_ADDRESS_KEYS.has(k))),
        };
      });
    }
  }, [baseData]);

  // Applies the customer created via the round trip exactly as if it had
  // been picked from the list — same Bill To/currency/tax defaulting. An
  // effect, not a render-time computation, because the source is router
  // state delivered once by the navigation back from Create Customer, not a
  // prop or state this component already owns — there's nothing to derive it
  // from during render.
  useEffect(() => {
    if (customerReturn.createdRef) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCustomer(customerReturn.createdRef);
      customerReturn.consumeCreated();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customerReturn.createdRef]);

  // Shared by both return-trip hooks — either one may stash and restore it.
  const draft: QuoteDraft = { activeTab, localData, localLineItems, localCustomer, customerTouched, customFieldValues };
  const { startCreate: startCreateCustomer } = customerReturn.provide(draft);

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

  const { mutate: save, isPending, error: saveError } = useMutation({
    mutationFn: () => {
      if (!customer) throw new Error('A billing customer is required.');
      const payload = toCreatePayload({ ...data, customer_uuid: customer.id }, lineItems, sourceEstimate?.id, customFieldValues);
      return quoteService.createQuote(payload);
    },
    onSuccess: async (quote) => {
      toast.success('Quote created.');
      queryClient.invalidateQueries({ queryKey: ['quotes'] });
      if (panelRef.current?.hasStagedFiles()) {
        try { await panelRef.current.uploadStagedTo(quote.id); } catch { /* non-fatal */ }
      }
      navigate('/sales/quote');
    },
  });

  return (
    <div className="flex flex-col flex-1 min-h-0 bg-stone-50">
      <form onSubmit={(e) => { e.preventDefault(); save(); }} className="flex flex-col flex-1 min-h-0">
        <CrmPageHeader
          backLabel="Quotes"
          onBack={() => navigate('/sales/quote')}
          icon={FileText}
          title="New Quote"
          subtitle="Fields marked * are required."
          actions={(
            <button type="submit" disabled={isPending}
              className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-3.5 py-1.5 text-xs font-semibold text-stone-900 hover:bg-brand-hover disabled:opacity-50 transition-all shadow-sm">
              {isPending ? <Loader2 className="size-3 animate-spin" /> : <Save className="size-3" />}
              {isPending ? 'Saving…' : 'Save Quote'}
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

        <InventoryItemReturnContext.Provider value={inventoryReturn.provide(draft)}>
          <QuoteFormBody
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            data={data}
            set={set}
            lineItems={lineItems}
            setLineItems={setLocalLineItems}
            customer={customer}
            setCustomer={setCustomer}
            onCreateCustomer={startCreateCustomer}
            customFieldValues={customFieldValues}
            setCustomField={setCustomField}
            lookups={lookups}
            subtotal={subtotal}
            discountAmt={discountAmt}
            taxTotal={taxTotal}
            total={total}
            filesPanelRef={panelRef}
            sourceEstimate={sourceEstimate ? { id: sourceEstimate.id, number: sourceEstimate.estimateNumber } : null}
          />
        </InventoryItemReturnContext.Provider>

        <FormActionBar
          onCancel={() => navigate('/sales/quote')}
          isPending={isPending}
          submitLabel="Save Quote"
        />
      </form>
    </div>
  );
}
