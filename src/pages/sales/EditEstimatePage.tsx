import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { FileSpreadsheet, AlertCircle, Loader2, Save, Lock } from 'lucide-react';
import { estimateService } from '@/services/estimateService';
import { lookupService } from '@/services/lookupService';
import { apiErrorMessage } from '@/api/tenantClient';
import { FormActionBar } from '@/components/crm/FormPrimitives';
import { CrmPageHeader } from '@/pages/crm/components/CrmPageHeader';
import { Spinner, ErrorNote } from '@/components/tenant/ui';
import { useBreadcrumbStore } from '@/store/useBreadcrumbStore';
import { EstimateFormBody } from './components/EstimateFormBody';
import { EstimateStatusControl } from './components/EstimateStatusControl';
import type { CustomerRef } from './components/CustomerPicker';
import {
  fromEstimate, toCreatePayload, PAGE_TABS, type PageTab,
  type EstimateLineItem, ESTIMATE_TERMINAL_STATUSES,
} from '@/lib/estimateForm';

// Stable reference so `lineItems`'s fallback doesn't create a new array
// identity every render (which would defeat the totals useMemo below).
const EMPTY_ITEMS: EstimateLineItem[] = [];

export default function EditEstimatePage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<PageTab>(PAGE_TABS[0].key);

  const [localData, setLocalData] = useState<Record<string, unknown> | null>(null);
  const [localLineItems, setLocalLineItems] = useState<EstimateLineItem[] | null>(null);
  const [localCustomer, setLocalCustomer] = useState<CustomerRef | null>(null);
  const [localStatusCode, setLocalStatusCode] = useState<string | null>(null);

  const { data: estimate, isLoading, error: loadError } = useQuery({
    queryKey: ['estimate', id],
    queryFn: () => estimateService.getEstimate(id),
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
    if (estimate?.estimateNumber) {
      setLabel(id, estimate.estimateNumber);
      return () => clearLabel(id);
    }
  }, [id, estimate?.estimateNumber, setLabel, clearLabel]);

  const mapped = useMemo(() => (estimate ? fromEstimate(estimate) : null), [estimate]);
  const data = localData ?? mapped?.data ?? {};
  const lineItems = localLineItems ?? mapped?.lineItems ?? EMPTY_ITEMS;
  const customer = localCustomer ?? mapped?.customer ?? null;
  const statusCode = localStatusCode ?? estimate?.statusCode ?? '';
  const approvalStatus = estimate?.approvalStatus ?? 'none';
  const isTerminal = ESTIMATE_TERMINAL_STATUSES.has(statusCode);

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
    mutationFn: (toStatusCode: string) => estimateService.transition(id, toStatusCode),
    onSuccess: (updated) => {
      setLocalStatusCode(updated.statusCode);
      queryClient.invalidateQueries({ queryKey: ['estimate', id] });
      queryClient.invalidateQueries({ queryKey: ['estimates'] });
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
    mutationFn: () => estimateService.updateEstimate(id, toCreatePayload(data, lineItems)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['estimate', id] });
      queryClient.invalidateQueries({ queryKey: ['estimates'] });
      navigate(`/sales/estimate/${id}`);
    },
  });

  if (isLoading) return <div className="p-6"><Spinner label="Loading estimate…" /></div>;
  if (loadError || !estimate)
    return <div className="p-6"><ErrorNote>{apiErrorMessage(loadError, 'Failed to load estimate.')}</ErrorNote></div>;

  const saveError = save.error ?? transition.error;

  if (isTerminal) {
    return (
      <div className="flex flex-col flex-1 min-h-0 bg-stone-50">
        <CrmPageHeader
          backLabel="Estimates"
          onBack={() => navigate(`/sales/estimate/${id}`)}
          icon={FileSpreadsheet}
          title={estimate.estimateNumber || 'Estimate'}
          subtitle={estimate.customer.name}
        />
        <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
          <Lock className="size-8 text-stone-300" aria-hidden="true" />
          <p className="text-sm font-semibold text-stone-700">
            This estimate is {estimate.status} and can no longer be edited.
          </p>
          <p className="text-xs text-stone-400">{estimate.status} estimates are locked server-side.</p>
          <button
            type="button"
            onClick={() => navigate(`/sales/estimate/${id}`)}
            className="mt-2 rounded-lg border border-stone-200 bg-white px-3.5 py-1.5 text-xs font-medium text-stone-600 hover:bg-stone-50 transition-colors"
          >
            Back to estimate
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
          backLabel="Estimates"
          onBack={() => navigate('/sales/estimate')}
          icon={FileSpreadsheet}
          title={estimate.estimateNumber || 'Estimate'}
          subtitle={customer?.name ?? 'Edit estimate'}
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
              {apiErrorMessage(saveError, 'Failed to save estimate.')}
            </p>
          </div>
        )}

        <EstimateFormBody
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          estimateId={id}
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
            <EstimateStatusControl
              estimate={{ statusCode, approvalStatus }}
              onChange={handleStatusChange}
              disabled={transition.isPending}
            />
          )}
        />

        <FormActionBar
          onCancel={() => navigate(`/sales/estimate/${id}`)}
          isPending={save.isPending}
        />
      </form>
    </div>
  );
}
