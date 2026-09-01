import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { CreditCard, AlertCircle, Loader2, Save } from 'lucide-react';
import { toast } from 'sonner';
import { paymentService } from '@/services/paymentService';
import { lookupService } from '@/services/lookupService';
import { apiErrorMessage } from '@/api/tenantClient';
import { FormActionBar, ModernSection } from '@/components/crm/FormPrimitives';
import { CrmPageHeader } from '@/pages/crm/components/CrmPageHeader';
import { Spinner, ErrorNote } from '@/components/tenant/ui';
import { readonlyCls, fieldLabelCls } from '@/components/crm/formUtils';
import { useBreadcrumbStore } from '@/store/useBreadcrumbStore';
import { PaymentSectionGrid } from './components/PaymentFormFields';
import { PaymentStatusControl } from './components/PaymentStatusControl';
import { EDIT_FIELDS, fromPayment, toUpdatePayload, PAYMENT_STATUS_CODES } from '@/lib/paymentForm';
import { statusToastLabel } from '@/lib/statusToast';

export default function EditPaymentPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [localData, setLocalData] = useState<Record<string, unknown> | null>(null);
  const [localStatusCode, setLocalStatusCode] = useState<string | null>(null);

  const { data: payment, isLoading, error: loadError } = useQuery({
    queryKey: ['payment', id],
    queryFn: () => paymentService.getPayment(id),
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
    if (payment?.paymentNumber) {
      setLabel(id, payment.paymentNumber);
      return () => clearLabel(id);
    }
  }, [id, payment?.paymentNumber, setLabel, clearLabel]);

  const mapped = useMemo(() => (payment ? fromPayment(payment) : null), [payment]);
  const data = localData ?? mapped?.data ?? {};
  const statusCode = localStatusCode ?? payment?.statusCode ?? '';
  const approvalStatus = payment?.approvalStatus ?? 'none';
  const gated = payment?.gated ?? false;

  const set = useCallback(
    (key: string, value: unknown) => setLocalData((prev) => ({ ...(prev ?? mapped?.data ?? {}), [key]: value })),
    [mapped],
  );

  const transition = useMutation({
    mutationFn: (toStatusCode: string) => paymentService.transition(id, toStatusCode),
    onSuccess: (updated) => {
      setLocalStatusCode(updated.statusCode);
      queryClient.invalidateQueries({ queryKey: ['payment', id] });
      queryClient.invalidateQueries({ queryKey: ['payments'] });
      toast.success(`Moved to ${statusToastLabel(PAYMENT_STATUS_CODES, updated.statusCode)}.`);
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
    mutationFn: () => paymentService.updatePayment(id, toUpdatePayload(data)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payment', id] });
      queryClient.invalidateQueries({ queryKey: ['payments'] });
      navigate(`/sales/payment/${id}`);
    },
  });

  if (isLoading) return <div className="p-6"><Spinner label="Loading payment…" /></div>;
  if (loadError || !payment)
    return <div className="p-6"><ErrorNote>{apiErrorMessage(loadError, 'Failed to load payment.')}</ErrorNote></div>;

  const saveError = save.error ?? transition.error;
  const customerName = mapped?.customer.name ?? payment.customer.name;

  return (
    <div className="flex flex-col flex-1 min-h-0 bg-stone-50">
      <form
        onSubmit={(e) => { e.preventDefault(); save.mutate(); }}
        className="flex flex-col flex-1 min-h-0"
      >
        <CrmPageHeader
          backLabel="Payments"
          onBack={() => navigate(`/sales/payment/${id}`)}
          icon={CreditCard}
          title={payment.paymentNumber || 'Payment'}
          subtitle={customerName}
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
              {apiErrorMessage(saveError, 'Failed to save payment.')}
            </p>
          </div>
        )}

        <div className="flex-1 overflow-y-auto modal-scrollbar">
          <div className="px-4 py-3 pb-24 space-y-3 3xl:px-10 3xl:py-5 4xl:px-16 4xl:py-8">
            <ModernSection title="Status" index={0}>
              <div className="grid grid-cols-1 gap-x-5 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
                <div className="space-y-1.5">
                  <label className={fieldLabelCls}>Status</label>
                  <PaymentStatusControl
                    payment={{ statusCode, approvalStatus, gated }}
                    onChange={handleStatusChange}
                    disabled={transition.isPending}
                  />
                </div>
                <div className="space-y-1">
                  <label className={fieldLabelCls}>Customer</label>
                  <div className={readonlyCls}>{customerName}</div>
                </div>
                <div className="space-y-1">
                  <label className={fieldLabelCls}>Amount</label>
                  <div className={readonlyCls}>
                    {payment.amount.toLocaleString(undefined, { style: 'currency', currency: 'USD' })}
                  </div>
                </div>
              </div>
            </ModernSection>

            <ModernSection title="Payment Details" index={1}>
              <PaymentSectionGrid fields={EDIT_FIELDS} data={data} set={set} lookups={lookups} />
            </ModernSection>
          </div>
        </div>

        <FormActionBar
          onCancel={() => navigate(`/sales/payment/${id}`)}
          isPending={save.isPending}
        />
      </form>
    </div>
  );
}
