import { useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Wallet, AlertCircle, Loader2, Save, Plus, X } from 'lucide-react';
import { vendorPaymentService } from '@/services/vendorPaymentService';
import { lookupService } from '@/services/lookupService';
import { apiErrorMessage } from '@/api/tenantClient';
import { fieldCls } from '@/components/crm/formUtils';
import { ModernSection, FormActionBar } from '@/components/crm/FormPrimitives';
import { CrmPageHeader } from '@/pages/crm/components/CrmPageHeader';
import { UnsavedChangesPrompt } from '@/components/UnsavedChangesPrompt';
import { useUnsavedChangesGuard } from '@/hooks/useUnsavedChangesGuard';
import { type EditableFilesPanelHandle } from '@/components/crm/CrmSubTabsPanel';
import { type VendorRef } from '@/pages/purchases/purchase-order/components/VendorPicker';
import { VendorPaymentFormBody } from './components/VendorPaymentFormBody';
import { VendorBillPicker, type VendorBillRef } from './components/VendorBillPicker';
import {
  PRIMARY_INFO_FIELDS, vendorPaymentDefaults, toCreatePayload, PAGE_TABS, type PageTab,
} from '@/lib/vendorPaymentForm';
import type { VendorPaymentApplicationInput } from '@/types/vendorPayment';

function currency(n: number): string {
  return n.toLocaleString(undefined, { style: 'currency', currency: 'USD' });
}

export default function AddVendorPaymentPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const panelRef = useRef<EditableFilesPanelHandle>(null);

  const [activeTab, setActiveTab] = useState<PageTab>(PAGE_TABS[0].key);
  const [data, setData] = useState<Record<string, unknown>>(vendorPaymentDefaults);
  const [vendor, setVendor] = useState<VendorRef | null>(null);
  const [customFieldValues, setCustomFieldValues] = useState<Record<string, unknown>>({});

  const [applications, setApplications] = useState<VendorPaymentApplicationInput[]>([]);
  const [appliedBillNumbers, setAppliedBillNumbers] = useState<Record<string, string>>({});
  const [pendingBill, setPendingBill] = useState<VendorBillRef | null>(null);
  const [pendingAmount, setPendingAmount] = useState('');

  const set = useCallback((key: string, value: unknown) => setData((d) => ({ ...d, [key]: value })), []);
  const setCustomField = useCallback(
    (key: string, value: unknown) => setCustomFieldValues((v) => ({ ...v, [key]: value })),
    [],
  );

  const { data: lookups } = useQuery({
    queryKey: ['crm-lookups'],
    queryFn: lookupService.getCrmLookups,
    staleTime: 10 * 60 * 1000,
  });

  const guard = useUnsavedChangesGuard({ data, vendor, customFieldValues, applications });

  function addApplication() {
    if (!pendingBill) return;
    const amount = parseFloat(pendingAmount);
    if (!Number.isFinite(amount) || amount <= 0) return;
    setApplications((a) => [...a, { vendorBillUuid: pendingBill.id, amount }]);
    setAppliedBillNumbers((m) => ({ ...m, [pendingBill.id]: pendingBill.number }));
    setPendingBill(null);
    setPendingAmount('');
  }

  function removeApplication(vendorBillUuid: string) {
    setApplications((a) => a.filter((row) => row.vendorBillUuid !== vendorBillUuid));
    setAppliedBillNumbers((m) => {
      const next = { ...m };
      delete next[vendorBillUuid];
      return next;
    });
  }

  const { mutate: save, isPending, error: saveError } = useMutation({
    mutationFn: () => {
      if (!vendor) throw new Error('A vendor is required.');
      const payload = { ...toCreatePayload(data, vendor.id, customFieldValues), applications };
      return vendorPaymentService.createVendorPayment(payload);
    },
    onSuccess: async (payment) => {
      queryClient.invalidateQueries({ queryKey: ['vendor-payments'] });
      if (panelRef.current?.hasStagedFiles()) {
        try { await panelRef.current.uploadStagedTo(payment.id); } catch { /* non-fatal */ }
      }
      guard.markClean();
      navigate('/purchases/vendor_payment');
    },
  });

  return (
    <div className="flex flex-col flex-1 min-h-0 bg-stone-50">
      <UnsavedChangesPrompt guard={guard} />
      <form onSubmit={(e) => { e.preventDefault(); save(); }} className="flex flex-col flex-1 min-h-0">
        <CrmPageHeader
          backLabel="Vendor Payments"
          onBack={() => navigate('/purchases/vendor_payment')}
          icon={Wallet}
          title="New Vendor Payment"
          subtitle="Fields marked * are required."
          actions={(
            <button type="submit" disabled={isPending}
              className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-3.5 py-1.5 text-xs font-semibold text-stone-900 hover:bg-brand-hover disabled:opacity-50 transition-all shadow-sm">
              {isPending ? <Loader2 className="size-3 animate-spin" /> : <Save className="size-3" />}
              {isPending ? 'Saving…' : 'Save Vendor Payment'}
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
              {apiErrorMessage(saveError, 'Failed to save vendor payment.')}
            </p>
          </div>
        )}

        <VendorPaymentFormBody
          shell={{ activeTab, setActiveTab }}
          form={{
            fields: PRIMARY_INFO_FIELDS, data, set, lookups,
            customFieldValues, setCustomField,
          }}
          vendor={{ value: vendor, onChange: setVendor }}
          filesPanelRef={panelRef}
        >
          <ModernSection title="Apply to Bills (optional)" index={2}>
            <div className="space-y-3">
              {applications.length > 0 && (
                <div className="space-y-1.5">
                  {applications.map((app) => (
                    <div key={app.vendorBillUuid} className="flex items-center justify-between rounded-lg border border-stone-200 bg-stone-50 px-3 py-2 text-xs">
                      <span className="font-medium text-stone-700">{appliedBillNumbers[app.vendorBillUuid]}</span>
                      <div className="flex items-center gap-2">
                        <span className="tabular-nums text-stone-600">{currency(app.amount)}</span>
                        <button
                          type="button"
                          onClick={() => removeApplication(app.vendorBillUuid)}
                          aria-label={`Remove application to ${appliedBillNumbers[app.vendorBillUuid]}`}
                          className="rounded p-0.5 text-stone-400 hover:bg-stone-200 hover:text-stone-600 transition-colors"
                        >
                          <X className="size-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
                <div className="flex-1">
                  <VendorBillPicker
                    vendor={vendor}
                    value={pendingBill}
                    onChange={setPendingBill}
                    excludeIds={applications.map((a) => a.vendorBillUuid)}
                  />
                </div>
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={pendingAmount}
                  onChange={(e) => setPendingAmount(e.target.value)}
                  placeholder="Amount"
                  aria-label="Application amount"
                  className={`${fieldCls} sm:w-32`}
                />
                <button
                  type="button"
                  onClick={addApplication}
                  disabled={!pendingBill || !(parseFloat(pendingAmount) > 0)}
                  className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-stone-200 bg-white px-3 py-2 text-xs font-semibold text-stone-700 hover:bg-stone-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shrink-0"
                >
                  <Plus className="size-3.5" />
                  Add
                </button>
              </div>

              <p className="text-2xs text-stone-400">
                {vendor
                  ? 'Only this vendor’s approved bills with a balance due can be paid. Each application is recorded after the payment itself saves — if one is rejected, the payment still exists and can be applied again from its detail page.'
                  : 'Select a vendor above to apply this payment to their bills.'}
              </p>
            </div>
          </ModernSection>
        </VendorPaymentFormBody>

        <FormActionBar
          onCancel={() => navigate('/purchases/vendor_payment')}
          isPending={isPending}
          submitLabel="Save Vendor Payment"
        />
      </form>
    </div>
  );
}
