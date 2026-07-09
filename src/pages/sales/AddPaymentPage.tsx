import { useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { CreditCard, AlertCircle, Loader2, Save } from 'lucide-react';
import { crmService } from '@/services/crmService';
import { apiErrorMessage } from '@/api/tenantClient';
import { cn } from '@/lib/utils';
import { ModernSection, ModernFieldShell, FormActionBar } from '@/components/crm/FormPrimitives';
import {
  fieldCls, textareaCls, readonlyCls,
} from '@/components/crm/formUtils';
import { CrmPageHeader } from '@/pages/crm/components/CrmPageHeader';
import { EditableFilesPanel, type EditableFilesPanelHandle } from '@/components/crm/CrmSubTabsPanel';
import {
  PRIMARY_INFO_FIELDS, CUSTOMER_FIELDS, paymentDefaults, type PaymentFormField,
} from '@/lib/paymentForm';

// ── Page-level tabs ───────────────────────────────────────────────────────────

const PAGE_TABS = [
  { key: 'details', label: 'Details' },
  { key: 'audit',   label: 'Audit' },
  { key: 'files',   label: 'Files' },
] as const;
type PageTab = (typeof PAGE_TABS)[number]['key'];

// ── Field renderer ────────────────────────────────────────────────────────────

function PaymentField({ field, value, set }: {
  field: PaymentFormField;
  value: unknown;
  set: (k: string, v: unknown) => void;
}) {
  const str = typeof value === 'string' ? value : value === null ? '' : String(value);

  if (field.type === 'readonly') {
    return (
      <ModernFieldShell label={field.label}>
        <div className={`${readonlyCls} cursor-not-allowed select-none`}>
          {str || <span className="text-stone-400">—</span>}
        </div>
      </ModernFieldShell>
    );
  }

  if (field.type === 'textarea') {
    return (
      <div className={field.colSpanFull ? 'col-span-full' : field.colSpan2 ? 'sm:col-span-2' : ''}>
        <ModernFieldShell label={field.label} required={field.required}>
          <textarea
            rows={field.rows ?? 3}
            required={field.required}
            value={str}
            onChange={(e) => set(field.key, e.target.value)}
            className={textareaCls}
            placeholder={field.placeholder}
            aria-label={field.label}
          />
        </ModernFieldShell>
      </div>
    );
  }

  if (field.type === 'select') {
    return (
      <div className={field.colSpanFull ? 'col-span-full' : field.colSpan2 ? 'sm:col-span-2' : ''}>
        <ModernFieldShell label={field.label} required={field.required}>
          <select
            required={field.required}
            value={str}
            onChange={(e) => set(field.key, e.target.value)}
            className={fieldCls}
            aria-label={field.label}
          >
            {field.options?.map((opt) => (
              <option key={opt} value={opt}>{opt || '— Select —'}</option>
            ))}
          </select>
        </ModernFieldShell>
      </div>
    );
  }

  return (
    <div className={field.colSpanFull ? 'col-span-full' : field.colSpan2 ? 'sm:col-span-2' : ''}>
      <ModernFieldShell label={field.label} required={field.required}>
        <input
          type={field.type ?? 'text'}
          required={field.required}
          value={str}
          onChange={(e) => set(field.key, e.target.value)}
          className={fieldCls}
          placeholder={field.placeholder}
          aria-label={field.label}
        />
      </ModernFieldShell>
    </div>
  );
}

function PaymentSectionGrid({ fields, data, set }: {
  fields: PaymentFormField[];
  data: Record<string, unknown>;
  set: (k: string, v: unknown) => void;
}) {
  return (
    <div className={cn('grid grid-cols-1 gap-x-5 gap-y-4 sm:grid-cols-2 lg:grid-cols-3')}>
      {fields.map((f) => (
        <PaymentField key={f.key} field={f} value={data[f.key]} set={set} />
      ))}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function AddPaymentPage() {
  const navigate    = useNavigate();
  const queryClient = useQueryClient();
  const panelRef    = useRef<EditableFilesPanelHandle>(null);

  const [activeTab, setActiveTab] = useState<PageTab>('details');
  const [data, setData]           = useState<Record<string, unknown>>(paymentDefaults);

  const set = useCallback((key: string, value: unknown) => setData((d) => ({ ...d, [key]: value })), []);

  const { mutate: save, isPending, error: saveError } = useMutation({
    mutationFn: () =>
      crmService.createRecord('payment', {
        coreFields: data,
        customFields: {},
      }),
    onSuccess: async (record) => {
      queryClient.invalidateQueries({ queryKey: ['crm-records', 'payment'] });
      if (panelRef.current?.hasStagedFiles()) {
        try { await panelRef.current.uploadStagedTo(record.id); } catch { /* non-fatal */ }
      }
      navigate('/sales/payment');
    },
  });

  return (
    <div className="flex flex-col flex-1 min-h-0 bg-stone-50">
      <form onSubmit={(e) => { e.preventDefault(); save(); }} className="flex flex-col flex-1 min-h-0">

        <CrmPageHeader
          backLabel="Payments"
          onBack={() => navigate('/sales/payment')}
          icon={CreditCard}
          title="New Payment"
          subtitle="Fields marked * are required."
          actions={(
            <button type="submit" disabled={isPending}
              className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-3.5 py-1.5 text-xs font-semibold text-stone-900 hover:bg-brand-hover disabled:opacity-50 transition-all shadow-sm">
              {isPending ? <Loader2 className="size-3 animate-spin" /> : <Save className="size-3" />}
              {isPending ? 'Saving…' : 'Save Payment'}
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
                <ModernSection title="Payment Details" index={0}>
                  <PaymentSectionGrid fields={PRIMARY_INFO_FIELDS} data={data} set={set} />
                </ModernSection>
                <ModernSection title="Customer" index={1}>
                  <PaymentSectionGrid fields={CUSTOMER_FIELDS} data={data} set={set} />
                </ModernSection>
              </>
            )}

            {activeTab === 'audit' && (
              <p className="py-12 text-center text-sm text-stone-400">
                Audit trail will be available after saving the payment.
              </p>
            )}

            {/* Always mounted so staged files survive tab switches */}
            <div className={activeTab === 'files' ? '' : 'hidden'}>
              <EditableFilesPanel ref={panelRef} />
            </div>
          </div>
        </div>

        <FormActionBar
          onCancel={() => navigate('/sales/payment')}
          isPending={isPending}
          submitLabel="Save Payment"
        />
      </form>
    </div>
  );
}
