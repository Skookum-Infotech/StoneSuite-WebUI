import { useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Undo2, AlertCircle, Loader2, Save, Info } from 'lucide-react';
import { refundService } from '@/services/refundService';
import { lookupService } from '@/services/lookupService';
import { apiErrorMessage } from '@/api/tenantClient';
import { cn } from '@/lib/utils';
import { fieldLabelCls } from '@/components/crm/formUtils';
import { ModernSection, FormActionBar } from '@/components/crm/FormPrimitives';
import { CrmPageHeader } from '@/pages/crm/components/CrmPageHeader';
import { EditableFilesPanel, type EditableFilesPanelHandle } from '@/components/crm/CrmSubTabsPanel';
import { CustomerPicker } from './components/CustomerPicker';
import type { CustomerRef } from './components/CustomerPicker';
import { customerDefaultFields } from '@/lib/customerDefaults';
import { RefundSourcePicker, type RefundSourceRef } from './components/RefundSourcePicker';
import { RefundSectionGrid } from './components/RefundFormFields';
import {
  PRIMARY_INFO_FIELDS, refundDefaults, toCreatePayload, PAGE_TABS, type PageTab,
} from '@/lib/refundForm';

export default function AddRefundPage() {
  const navigate    = useNavigate();
  const queryClient = useQueryClient();
  const panelRef    = useRef<EditableFilesPanelHandle>(null);

  const [activeTab, setActiveTab] = useState<PageTab>('details');
  const [data, setData]           = useState<Record<string, unknown>>(refundDefaults);
  const [customer, setCustomer]   = useState<CustomerRef | null>(null);

  // Lineage, not money (spec AD-12). Unlike AddPaymentPage — which composes an
  // inline `applications` array at create time — a refund's ledger cannot be
  // touched here at all: applying requires the refund be APPV (AD-5) and a new
  // refund always starts PEND, so the backend omits an Applications field from
  // the create contract entirely rather than always rejecting one (spec §11).
  // These two pickers only record "this refund arose from that document"; the
  // money is drawn afterwards from the detail page's Applications tab.
  const [lineagePayment, setLineagePayment] = useState<RefundSourceRef | null>(null);
  const [lineageCreditMemo, setLineageCreditMemo] = useState<RefundSourceRef | null>(null);

  const set = useCallback((key: string, value: unknown) => setData((d) => ({ ...d, [key]: value })), []);

  const { data: lookups } = useQuery({
    queryKey: ['crm-lookups'],
    queryFn: lookupService.getCrmLookups,
    staleTime: 10 * 60 * 1000,
  });

  const { mutate: save, isPending, error: saveError } = useMutation({
    mutationFn: () => {
      if (!customer) throw new Error('A customer is required.');
      return refundService.createRefund(
        toCreatePayload(data, customer.id, {
          paymentUuid: lineagePayment?.id,
          creditMemoUuid: lineageCreditMemo?.id,
        }),
      );
    },
    onSuccess: async (refund) => {
      queryClient.invalidateQueries({ queryKey: ['refunds'] });
      if (panelRef.current?.hasStagedFiles()) {
        try { await panelRef.current.uploadStagedTo(refund.id); } catch { /* non-fatal */ }
      }
      navigate('/sales/refund');
    },
  });

  // Changing the customer invalidates any lineage picked under the previous
  // one — the backend requires a lineage document belong to the refund's own
  // customer and would 400 on a mismatch.
  const handleCustomerChange = useCallback((next: CustomerRef | null) => {
    setCustomer(next);
    setLineagePayment(null);
    setLineageCreditMemo(null);
    if (next) {
      const defaults = customerDefaultFields(next);
      setData((d) => ({
        ...d,
        ...Object.fromEntries(Object.entries(defaults).filter(([k]) => !d[k])),
      }));
    }
  }, []);

  return (
    <div className="flex flex-col flex-1 min-h-0 bg-stone-50">
      <form onSubmit={(e) => { e.preventDefault(); save(); }} className="flex flex-col flex-1 min-h-0">

        <CrmPageHeader
          backLabel="Refunds"
          onBack={() => navigate('/sales/refund')}
          icon={Undo2}
          title="New Refund"
          subtitle="Fields marked * are required."
          actions={(
            <button type="submit" disabled={isPending}
              className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-3.5 py-1.5 text-xs font-semibold text-stone-900 hover:bg-brand-hover disabled:opacity-50 transition-all shadow-sm">
              {isPending ? <Loader2 className="size-3 animate-spin" /> : <Save className="size-3" />}
              {isPending ? 'Saving…' : 'Save Refund'}
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

        {/* ── Page-level tab bar ── */}
        <div className="flex shrink-0 overflow-x-auto overflow-y-hidden border-b border-stone-200 bg-white px-5 3xl:px-10 4xl:px-16 modal-scrollbar">
          {PAGE_TABS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={cn(
                'flex shrink-0 items-center gap-1.5 px-4 py-3 text-sm font-medium border-b-2 -mb-px transition-colors whitespace-nowrap',
                activeTab === tab.key
                  ? 'border-stone-800 text-stone-900'
                  : 'border-transparent text-stone-400 hover:text-stone-600 hover:border-stone-300',
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* ── Scrollable content ── */}
        <div className="flex-1 overflow-y-auto modal-scrollbar">
          <div className="px-4 py-3 pb-24 space-y-2 3xl:px-10 3xl:py-5 4xl:px-16 4xl:py-8">

            {activeTab === 'details' && (
              <>
                <ModernSection title="Customer" index={0}>
                  <CustomerPicker value={customer} onChange={handleCustomerChange} required />
                </ModernSection>

                <ModernSection title="Refund Details" index={1}>
                  <RefundSectionGrid fields={PRIMARY_INFO_FIELDS} data={data} set={set} lookups={lookups} />
                </ModernSection>

                <ModernSection title="Related Documents (optional)" index={2}>
                  <div className="space-y-3">
                    <div className="flex items-start gap-2 rounded-lg border border-stone-200 bg-stone-50 px-3 py-2">
                      <Info className="mt-0.5 size-3.5 shrink-0 text-stone-400" aria-hidden="true" />
                      <p className="text-2xs text-stone-500">
                        Recorded for reporting only — linking a document here does not draw any
                        money from it. Approve this refund first, then draw from a source on the
                        refund's Applications tab.
                      </p>
                    </div>

                    <div className="grid grid-cols-1 gap-x-5 gap-y-4 sm:grid-cols-2">
                      <div>
                        <span className={fieldLabelCls}>Payment</span>
                        <div className="mt-1.5">
                          <RefundSourcePicker
                            customer={customer}
                            kind="payment"
                            value={lineagePayment}
                            onChange={setLineagePayment}
                          />
                        </div>
                      </div>
                      <div>
                        <span className={fieldLabelCls}>Credit Memo</span>
                        <div className="mt-1.5">
                          <RefundSourcePicker
                            customer={customer}
                            kind="credit_memo"
                            value={lineageCreditMemo}
                            onChange={setLineageCreditMemo}
                          />
                        </div>
                      </div>
                    </div>

                    {!customer && (
                      <p className="text-2xs text-stone-400">
                        Select a customer above to link this refund to one of their documents.
                      </p>
                    )}
                  </div>
                </ModernSection>
              </>
            )}

            {activeTab === 'audit' && (
              <p className="py-12 text-center text-sm text-stone-400">
                Audit trail will be available after saving the refund.
              </p>
            )}

            {/* Always mounted so staged files survive tab switches */}
            <div className={activeTab === 'files' ? '' : 'hidden'}>
              <EditableFilesPanel ref={panelRef} />
            </div>
          </div>
        </div>

        <FormActionBar
          onCancel={() => navigate('/sales/refund')}
          isPending={isPending}
          submitLabel="Save Refund"
        />
      </form>
    </div>
  );
}
