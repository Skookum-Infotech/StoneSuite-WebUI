import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Undo2, AlertCircle, Loader2, Save } from 'lucide-react';
import { refundService } from '@/services/refundService';
import { lookupService } from '@/services/lookupService';
import { apiErrorMessage } from '@/api/tenantClient';
import { FormActionBar, ModernSection } from '@/components/crm/FormPrimitives';
import { CrmPageHeader } from '@/pages/crm/components/CrmPageHeader';
import { Spinner, ErrorNote } from '@/components/tenant/ui';
import { readonlyCls, fieldLabelCls } from '@/components/crm/formUtils';
import { useBreadcrumbStore } from '@/store/useBreadcrumbStore';
import { RefundSectionGrid } from './components/RefundFormFields';
import { RefundStatusControl } from './components/RefundStatusControl';
import { EDIT_FIELDS, fromRefund, toUpdatePayload } from '@/lib/refundForm';

export default function EditRefundPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [localData, setLocalData] = useState<Record<string, unknown> | null>(null);
  const [localStatusCode, setLocalStatusCode] = useState<string | null>(null);

  const { data: refund, isLoading, error: loadError } = useQuery({
    queryKey: ['refund', id],
    queryFn: () => refundService.getRefund(id),
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
    if (refund?.refundNumber) {
      setLabel(id, refund.refundNumber);
      return () => clearLabel(id);
    }
  }, [id, refund?.refundNumber, setLabel, clearLabel]);

  const mapped = useMemo(() => (refund ? fromRefund(refund) : null), [refund]);
  const data = localData ?? mapped?.data ?? {};
  const statusCode = localStatusCode ?? refund?.statusCode ?? '';

  const set = useCallback(
    (key: string, value: unknown) => setLocalData((prev) => ({ ...(prev ?? mapped?.data ?? {}), [key]: value })),
    [mapped],
  );

  const transition = useMutation({
    mutationFn: (toStatusCode: string) => refundService.transition(id, toStatusCode),
    onSuccess: (updated) => {
      setLocalStatusCode(updated.statusCode);
      queryClient.invalidateQueries({ queryKey: ['refund', id] });
      queryClient.invalidateQueries({ queryKey: ['refunds'] });
    },
    // A denied move (409) or missing refund:approve (403) leaves the server's
    // status unchanged, so roll the optimistic pick back rather than leave the
    // control showing a status the record never reached.
    onError: () => setLocalStatusCode(null),
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
    mutationFn: () => refundService.updateRefund(id, toUpdatePayload(data)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['refund', id] });
      queryClient.invalidateQueries({ queryKey: ['refunds'] });
      navigate(`/sales/refund/${id}`);
    },
  });

  if (isLoading) return <div className="p-6"><Spinner label="Loading refund…" /></div>;
  if (loadError || !refund)
    return <div className="p-6"><ErrorNote>{apiErrorMessage(loadError, 'Failed to load refund.')}</ErrorNote></div>;

  const saveError = save.error ?? transition.error;
  const customerName = mapped?.customer.name ?? refund.customer.name;

  return (
    <div className="flex flex-col flex-1 min-h-0 bg-stone-50">
      <form
        onSubmit={(e) => { e.preventDefault(); save.mutate(); }}
        className="flex flex-col flex-1 min-h-0"
      >
        <CrmPageHeader
          backLabel="Refunds"
          onBack={() => navigate(`/sales/refund/${id}`)}
          icon={Undo2}
          title={refund.refundNumber || 'Refund'}
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
          <div role="alert" className="shrink-0 flex items-start gap-3 border-b border-red-200 bg-red-50 px-5 py-2.5">
            <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-red-100">
              <AlertCircle className="size-3 text-red-600" aria-hidden="true" />
            </span>
            <p className="text-xs text-red-700">
              <span className="font-bold">Error: </span>
              {apiErrorMessage(saveError, 'Failed to save refund.')}
            </p>
          </div>
        )}

        <div className="flex-1 overflow-y-auto modal-scrollbar">
          <div className="px-4 py-3 pb-24 space-y-3 3xl:px-10 3xl:py-5 4xl:px-16 4xl:py-8">
            <ModernSection title="Status" index={0}>
              <div className="grid grid-cols-1 gap-x-5 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
                <div className="space-y-1.5">
                  <label className={fieldLabelCls}>Status</label>
                  <RefundStatusControl
                    value={statusCode}
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
                    {refund.amount.toLocaleString(undefined, { style: 'currency', currency: 'USD' })}
                  </div>
                </div>
              </div>
            </ModernSection>

            <ModernSection title="Refund Details" index={1}>
              <RefundSectionGrid fields={EDIT_FIELDS} data={data} set={set} lookups={lookups} />
            </ModernSection>
          </div>
        </div>

        <FormActionBar
          onCancel={() => navigate(`/sales/refund/${id}`)}
          isPending={save.isPending}
        />
      </form>
    </div>
  );
}
