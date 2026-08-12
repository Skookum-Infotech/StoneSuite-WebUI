import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Wallet, AlertCircle, Loader2, Save } from 'lucide-react';
import { vendorPaymentService } from '@/services/vendorPaymentService';
import { lookupService } from '@/services/lookupService';
import { apiErrorMessage } from '@/api/tenantClient';
import { FormActionBar } from '@/components/crm/FormPrimitives';
import { CrmPageHeader } from '@/pages/crm/components/CrmPageHeader';
import { Spinner, ErrorNote } from '@/components/tenant/ui';
import { UnsavedChangesPrompt } from '@/components/UnsavedChangesPrompt';
import { useUnsavedChangesGuard } from '@/hooks/useUnsavedChangesGuard';
import { useBreadcrumbStore } from '@/store/useBreadcrumbStore';
import { VendorPaymentFormBody } from './components/VendorPaymentFormBody';
import {
  EDIT_FIELDS, fromVendorPayment, toUpdatePayload, VP_EDITABLE_STATUSES,
  vpStatusLabel, PAGE_TABS, type PageTab,
} from '@/lib/vendorPaymentForm';

// Stable empty default so the unsaved-changes baseline doesn't see a brand new
// object every render before the payment loads.
const EMPTY_CUSTOM: Record<string, unknown> = {};

export default function EditVendorPaymentPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<PageTab>(PAGE_TABS[0].key);
  const [localData, setLocalData] = useState<Record<string, unknown> | null>(null);
  const [localCustomFields, setLocalCustomFields] = useState<Record<string, unknown> | null>(null);

  const { data: payment, isLoading, error: loadError } = useQuery({
    queryKey: ['vendor-payment', id],
    queryFn: () => vendorPaymentService.getVendorPayment(id),
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
    if (payment?.vendorPaymentNumber) {
      setLabel(id, payment.vendorPaymentNumber);
      return () => clearLabel(id);
    }
  }, [id, payment?.vendorPaymentNumber, setLabel, clearLabel]);

  const mapped = useMemo(() => (payment ? fromVendorPayment(payment) : null), [payment]);
  const data = localData ?? mapped?.data ?? {};
  const customFieldValues = localCustomFields ?? mapped?.customFieldValues ?? EMPTY_CUSTOM;
  const isLocked = payment ? !VP_EDITABLE_STATUSES.has(payment.statusCode) : false;

  // Baseline against the loaded record, not the empty defaults, so simply
  // opening the page never counts as an edit. A locked payment is read-only —
  // nothing to lose.
  const guard = useUnsavedChangesGuard(
    { data, customFieldValues },
    Boolean(mapped) && !isLocked,
  );

  const set = useCallback(
    (key: string, value: unknown) => setLocalData((prev) => ({ ...(prev ?? mapped?.data ?? {}), [key]: value })),
    [mapped],
  );
  const setCustomField = useCallback(
    (key: string, value: unknown) =>
      setLocalCustomFields((prev) => ({ ...(prev ?? mapped?.customFieldValues ?? {}), [key]: value })),
    [mapped],
  );

  const save = useMutation({
    mutationFn: () => vendorPaymentService.updateVendorPayment(id, toUpdatePayload(data, customFieldValues)),
    onSuccess: (updated) => {
      queryClient.setQueryData(['vendor-payment', id], updated);
      queryClient.invalidateQueries({ queryKey: ['vendor-payments'] });
      guard.markClean();
      navigate(`/purchases/vendor_payment/${id}`);
    },
  });

  if (isLoading) return <div className="p-6"><Spinner label="Loading vendor payment…" /></div>;
  if (loadError || !payment)
    return <div className="p-6"><ErrorNote>{apiErrorMessage(loadError, 'Failed to load vendor payment.')}</ErrorNote></div>;

  // The backend accepts PATCH only at DRFT/PAPV (store_update.go). Saying so
  // up front beats letting the user retype a form the server will reject.
  if (!VP_EDITABLE_STATUSES.has(payment.statusCode)) {
    return (
      <div className="p-6">
        <ErrorNote>
          {`A ${vpStatusLabel(payment.statusCode).toLowerCase()} vendor payment can no longer be edited. Recall it to draft first, or void it and record a new one.`}
        </ErrorNote>
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1 min-h-0 bg-stone-50">
      <UnsavedChangesPrompt guard={guard} />
      <form onSubmit={(e) => { e.preventDefault(); save.mutate(); }} className="flex flex-col flex-1 min-h-0">
        <CrmPageHeader
          backLabel="Vendor Payments"
          onBack={() => navigate(`/purchases/vendor_payment/${id}`)}
          icon={Wallet}
          title={payment.vendorPaymentNumber || 'Vendor Payment'}
          subtitle={payment.vendor.name}
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
              {apiErrorMessage(save.error, 'Failed to save vendor payment.')}
            </p>
          </div>
        )}

        <VendorPaymentFormBody
          shell={{ activeTab, setActiveTab, vendorPaymentId: id }}
          form={{
            fields: EDIT_FIELDS, data, set, lookups, lockedAmount: payment.amount,
            customFieldValues, setCustomField,
          }}
          vendor={{ value: mapped?.vendor ?? payment.vendor, onChange: () => undefined, locked: true }}
        />

        <FormActionBar
          onCancel={() => navigate(`/purchases/vendor_payment/${id}`)}
          isPending={save.isPending}
        />
      </form>
    </div>
  );
}
