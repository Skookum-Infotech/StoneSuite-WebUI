import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { CreditCard, Upload, Pencil, DollarSign, Unlink, FileDown, Loader2 } from 'lucide-react';
import { paymentService } from '@/services/paymentService';
import { lookupService } from '@/services/lookupService';
import { apiErrorMessage } from '@/api/tenantClient';
import { Spinner, ErrorNote, Badge } from '@/components/tenant/ui';
import { ModernSection } from '@/components/crm/FormPrimitives';
import { readonlyCls, fieldLabelCls, fieldCls } from '@/components/crm/formUtils';
import { FilesContent } from '@/components/crm/CrmSubTabsPanel';
import { CrmPageHeader } from '@/pages/crm/components/CrmPageHeader';
import { ApprovalBanner } from '@/components/tenant/ApprovalBanner';
import { useBreadcrumbStore } from '@/store/useBreadcrumbStore';
import { useUserPermissions } from '@/hooks/useUserPermissions';
import { cn } from '@/lib/utils';
import { PAYMENT_STATUS_COLORS, PAYMENT_BLOCKS_APPLY } from '@/lib/paymentForm';
import { PaymentAuditTab } from './components/PaymentAuditTab';
import { DeletePaymentDialog } from './components/DeletePaymentDialog';
import { InvoicePicker } from './components/InvoicePicker';
import type { InvoiceRef } from './components/InvoicePicker';
import { SalesDetailSidebar } from './components/SalesDetailSidebar';
import { PaymentStatusControl } from './components/PaymentStatusControl';
import type { PaymentApplication } from '@/types/payment';

const TABS = [
  { key: 'overview', label: 'Overview' },
  { key: 'applications', label: 'Applications' },
  { key: 'audit', label: 'Audit' },
  { key: 'files', label: 'Files' },
] as const;
type Tab = (typeof TABS)[number]['key'];

function fmtDate(iso?: string): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

function currency(n: number | undefined): string {
  return (n ?? 0).toLocaleString(undefined, { style: 'currency', currency: 'USD' });
}

export default function PaymentDetailPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [applyOpen, setApplyOpen] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [exportPdfError, setExportPdfError] = useState<string>();

  const { hasPermission, isLoading: permissionsLoading } = useUserPermissions();
  const canEdit = permissionsLoading || hasPermission('payment', 'update');
  const canDelete = permissionsLoading || hasPermission('payment', 'delete');

  const { data: payment, isLoading, error } = useQuery({
    queryKey: ['payment', id],
    queryFn: () => paymentService.getPayment(id),
    enabled: Boolean(id),
  });

  const { data: lookups } = useQuery({
    queryKey: ['crm-lookups'],
    queryFn: lookupService.getCrmLookups,
  });

  const setLabel = useBreadcrumbStore((s) => s.setLabel);
  const clearLabel = useBreadcrumbStore((s) => s.clearLabel);
  useEffect(() => {
    if (payment?.paymentNumber) {
      setLabel(id, payment.paymentNumber);
      return () => clearLabel(id);
    }
  }, [id, payment?.paymentNumber, setLabel, clearLabel]);

  const unapply = useMutation({
    mutationFn: (invoiceId: string) => paymentService.unapply(id, invoiceId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['payment', id] }),
  });

  // Inline status change from the sidebar's Status row — mirrors the Edit
  // page's transition mutation.
  const transition = useMutation({
    mutationFn: (toStatusCode: string) => paymentService.transition(id, toStatusCode),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payment', id] });
      queryClient.invalidateQueries({ queryKey: ['payments'] });
    },
  });

  const approve = useMutation({
    mutationFn: () => paymentService.approve(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payment', id] });
      queryClient.invalidateQueries({ queryKey: ['payments'] });
    },
  });

  if (isLoading) return <div className="p-6"><Spinner label="Loading payment…" /></div>;
  if (error || !payment)
    return <div className="p-6"><ErrorNote>{apiErrorMessage(error, 'Failed to load payment.')}</ErrorNote></div>;

  const color = PAYMENT_STATUS_COLORS[payment.status] ?? '#a8a29e';
  const applyBlocked = PAYMENT_BLOCKS_APPLY.has(payment.statusCode);

  async function handleExportPdf() {
    if (!payment) return;
    setExportPdfError(undefined);
    setExportingPdf(true);
    try {
      const { exportSalesDocToPdf } = await import('@/lib/salesPdfExport');
      await exportSalesDocToPdf({
        docType: 'payment',
        title: payment.paymentNumber || 'Payment',
        recordNumber: payment.paymentNumber,
        statusLabel: payment.status,
        customerName: payment.customer.name,
        createdAt: payment.createdAt,
        updatedAt: payment.updatedAt,
        sections: [
          {
            title: 'Primary Information',
            rows: [
              ['Payment Method', payment.method || ''],
              ['Reference #', payment.referenceNumber || ''],
              ['Payment Date', fmtDate(payment.paymentDate)],
              ['Memo', payment.memo || ''],
              ['Internal Notes', payment.internalNotes || ''],
            ],
          },
          {
            title: 'Applications',
            rows: payment.applications.map((app) => [`Invoice ${app.invoiceNumber || '—'}`, currency(app.amount)]),
          },
        ],
        totals: [
          { label: 'Amount', value: currency(payment.amount), bold: true },
          { label: 'Applied', value: currency(payment.appliedTotal) },
          { label: 'Unapplied', value: currency(payment.unappliedAmount), bold: true },
        ],
      });
    } catch (err) {
      setExportPdfError(apiErrorMessage(err, 'Failed to export PDF.'));
    } finally {
      setExportingPdf(false);
    }
  }

  return (
    <div className="flex flex-col flex-1 min-h-0 bg-stone-50">
      <CrmPageHeader
        backLabel="Payments"
        onBack={() => navigate('/sales/payment')}
        icon={CreditCard}
        title={payment.paymentNumber || 'Payment'}
        subtitle={payment.customer.name}
        recordNumber={payment.paymentNumber}
        statusBadge={<Badge color={color}>{payment.status}</Badge>}
      />

      {payment.gated && (
        <>
          <ApprovalBanner
            approverNames={payment.approvers.filter((a) => !a.approved).map((a) => a.name)}
            canApprove={payment.canApprove}
            isOverride={payment.isOverride}
            requiredApprovals={payment.requiredApprovals}
            approvedCount={payment.approvedCount}
            callerAlreadyApproved={payment.callerAlreadyApproved}
            onApprove={() => approve.mutate()}
            approving={approve.isPending}
          />
          {approve.isError && (
            <p role="alert" className="px-5 py-1.5 text-2xs text-destructive 3xl:px-12 4xl:px-16">
              {apiErrorMessage(approve.error, 'Failed to approve payment.')}
            </p>
          )}
        </>
      )}

      {/* Tab bar */}
      <div className="flex shrink-0 overflow-x-auto overflow-y-hidden border-b border-stone-200 bg-white px-5 3xl:px-12 4xl:px-16 modal-scrollbar">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key)}
            className={cn(
              'px-4 py-3 text-sm font-semibold border-b-2 -mb-px transition-colors duration-150 whitespace-nowrap shrink-0',
              activeTab === tab.key
                ? 'border-brand text-stone-950'
                : 'border-transparent text-stone-500 hover:text-stone-700 hover:border-stone-200',
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="flex flex-col lg:flex-row gap-6 px-4 py-4 sm:px-5 sm:py-5 3xl:px-12 3xl:py-8 3xl:gap-10 4xl:px-16 4xl:py-10 4xl:gap-14">
        {/* Left column */}
        <div className="flex-1 space-y-3 min-w-0">
          {activeTab === 'overview' && (
            <>
              <ModernSection title="Primary Information" index={0}>
                <div className="grid grid-cols-1 gap-x-5 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
                  <ReadonlyField label="Payment Method" value={payment.method} />
                  <ReadonlyField label="Reference #" value={payment.referenceNumber} />
                  <ReadonlyField label="Payment Date" value={fmtDate(payment.paymentDate)} />
                  {payment.currencyId && (
                    <ReadonlyField
                      label="Currency"
                      value={lookups?.currencies.find((c) => c.id === payment.currencyId)?.name ?? '—'}
                    />
                  )}
                  {payment.memo && <ReadonlyField label="Memo" value={payment.memo} full />}
                  {payment.internalNotes && <ReadonlyField label="Internal Notes" value={payment.internalNotes} full />}
                </div>
              </ModernSection>
              <div className="rounded-lg border border-stone-200 bg-white p-4">
                <div className="grid grid-cols-3 gap-3">
                  <Total label="Amount" value={payment.amount} bold />
                  <Total label="Applied" value={payment.appliedTotal} />
                  <Total label="Unapplied" value={payment.unappliedAmount} bold />
                </div>
              </div>
            </>
          )}

          {activeTab === 'applications' && (
            <div className="space-y-3">
              {canEdit && (
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => setApplyOpen(true)}
                    disabled={applyBlocked || payment.unappliedAmount <= 0}
                    title={applyBlocked ? 'A voided payment cannot be applied.' : payment.unappliedAmount <= 0 ? 'No unapplied balance remaining.' : undefined}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-3 py-1.5 text-xs font-semibold text-stone-900 hover:bg-brand-hover disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                  >
                    <DollarSign className="size-3.5" />
                    Apply to invoice
                  </button>
                </div>
              )}

              <div className="overflow-x-auto modal-scrollbar rounded-lg border border-stone-200 bg-white">
                <table className="w-full text-left text-xs">
                  <thead className="bg-stone-50 border-b border-stone-200">
                    <tr className="divide-x divide-stone-200">
                      {['Invoice #', 'Amount', 'Applied Date', ''].map((h) => (
                        <th key={h} className="px-3 py-2.5 text-2xs font-semibold uppercase tracking-wide text-stone-500 whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100">
                    {payment.applications.map((app: PaymentApplication) => (
                      <tr key={app.id} className="hover:bg-stone-50/50 divide-x divide-stone-100">
                        <td className="px-3 py-2.5 font-medium text-stone-800">
                          <button type="button" onClick={() => navigate(`/sales/invoice/${app.invoiceId}`)} className="hover:text-accent-foreground transition-colors">
                            {app.invoiceNumber || '—'}
                          </button>
                        </td>
                        <td className="px-3 py-2.5 tabular-nums text-stone-700">{currency(app.amount)}</td>
                        <td className="px-3 py-2.5 tabular-nums text-stone-400">{fmtDate(app.createdAt)}</td>
                        <td className="px-3 py-2.5 text-right">
                          {canEdit && (
                            <button
                              type="button"
                              onClick={() => unapply.mutate(app.invoiceId)}
                              disabled={unapply.isPending || applyBlocked}
                              aria-label={`Unapply payment from invoice ${app.invoiceNumber}`}
                              className="inline-flex items-center gap-1 rounded-lg border border-stone-200 bg-white px-2 py-1 text-2xs font-medium text-stone-500 hover:bg-stone-50 disabled:opacity-40 transition-colors"
                            >
                              <Unlink className="size-3" />
                              Unapply
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                    {payment.applications.length === 0 && (
                      <tr><td colSpan={4} className="py-8 text-center text-stone-400">Not applied to any invoices yet.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
              {unapply.error && (
                <p className="text-xs text-destructive">{apiErrorMessage(unapply.error, 'Failed to unapply payment.')}</p>
              )}
            </div>
          )}

          {activeTab === 'audit' && <PaymentAuditTab paymentId={id} />}
          {activeTab === 'files' && <FilesContent ref={null} recordId={id} readOnly={!canEdit} />}

          <div className="h-6" />
        </div>

        {/* Right sidebar */}
        <SalesDetailSidebar label="Payment Details">
          <div className="rounded-xl border border-stone-200 bg-white shadow-sm p-4 space-y-3 mb-4">
            <p className="text-xs font-semibold text-stone-400">Quick Actions</p>
            <div className="space-y-0.5">
              {canEdit && (
                <button
                  type="button"
                  onClick={() => navigate(`/sales/payment/${id}/edit`, { state: { initialTab: 'files' } })}
                  className="flex items-center gap-2.5 hover:bg-stone-50 rounded-lg px-3 py-2 cursor-pointer text-xs text-stone-700 w-full transition-colors text-left"
                >
                  <Upload className="size-4 text-stone-400 shrink-0" />
                  Upload file
                </button>
              )}
              {canEdit && (
                <button
                  type="button"
                  onClick={() => navigate(`/sales/payment/${id}/edit`)}
                  className="flex items-center gap-2.5 hover:bg-stone-50 rounded-lg px-3 py-2 cursor-pointer text-xs text-stone-700 w-full transition-colors text-left"
                >
                  <Pencil className="size-4 text-stone-400 shrink-0" />
                  Edit payment
                </button>
              )}
              <button
                type="button"
                onClick={handleExportPdf}
                disabled={exportingPdf}
                className="flex items-center gap-2.5 hover:bg-stone-50 rounded-lg px-3 py-2 cursor-pointer text-xs text-stone-700 w-full transition-colors text-left disabled:opacity-60 disabled:cursor-not-allowed"
                aria-label="Export as PDF"
              >
                {exportingPdf ? <Loader2 className="size-4 text-stone-400 shrink-0 animate-spin" /> : <FileDown className="size-4 text-stone-400 shrink-0" />}
                {exportingPdf ? 'Exporting…' : 'Export PDF'}
              </button>
            </div>
            {exportPdfError && (
              <p role="alert" className="text-2xs text-destructive">{exportPdfError}</p>
            )}
          </div>

          <div className="rounded-xl border border-stone-200 bg-white shadow-sm p-4 space-y-3 mb-4">
            <p className="text-xs font-semibold text-stone-400">Status</p>
            <div className="flex justify-between items-center py-2 border-b border-stone-100 text-xs">
              <span className="text-stone-500">Status</span>
              <PaymentStatusControl
                payment={payment}
                onChange={(code) => transition.mutate(code)}
                disabled={transition.isPending}
                variant="pill"
              />
            </div>
            <div className="flex justify-between items-center py-2 border-b border-stone-100 text-xs">
              <span className="text-stone-500">Customer</span>
              <span className="text-stone-700 truncate max-w-[140px]">{payment.customer.name}</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-stone-100 text-xs">
              <span className="text-stone-500">Created</span>
              <span className="text-stone-700">{fmtDate(payment.createdAt)}</span>
            </div>
            <div className="flex justify-between items-center py-2 text-xs">
              <span className="text-stone-500">Updated</span>
              <span className="text-stone-700">{fmtDate(payment.updatedAt)}</span>
            </div>
          </div>

          {canDelete && (
            <div className="rounded-xl border border-stone-200 bg-white shadow-sm p-4 space-y-3 mb-4">
              <p className="text-xs font-semibold text-red-400">Danger Zone</p>
              <DeletePaymentDialog
                paymentId={id}
                label={`Payment ${payment.paymentNumber}`}
                onDeleted={() => {
                  queryClient.invalidateQueries({ queryKey: ['payments'] });
                  navigate('/sales/payment');
                }}
              />
            </div>
          )}
        </SalesDetailSidebar>
      </div>

      {applyOpen && (
        <ApplyDialog
          paymentId={id}
          customer={payment.customer}
          unappliedAmount={payment.unappliedAmount}
          excludeIds={payment.applications.map((a) => a.invoiceId)}
          onClose={() => setApplyOpen(false)}
          onApplied={() => {
            setApplyOpen(false);
            queryClient.invalidateQueries({ queryKey: ['payment', id] });
          }}
        />
      )}
    </div>
  );
}

function ApplyDialog({ paymentId, customer, unappliedAmount, excludeIds, onClose, onApplied }: {
  paymentId: string;
  customer: { id: string; name: string };
  unappliedAmount: number;
  excludeIds: string[];
  onClose: () => void;
  onApplied: () => void;
}) {
  const [invoice, setInvoice] = useState<InvoiceRef | null>(null);
  const [amount, setAmount] = useState('');

  const apply = useMutation({
    mutationFn: () => paymentService.apply(paymentId, invoice!.id, parseFloat(amount)),
    onSuccess: onApplied,
  });

  const parsedAmount = parseFloat(amount);
  const validAmount = Number.isFinite(parsedAmount) && parsedAmount > 0;

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="apply-payment-dialog-title"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="mx-4 w-full max-w-sm rounded-xl bg-white p-6 shadow-2xl">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex size-9 flex-shrink-0 items-center justify-center rounded-full bg-emerald-100">
            <DollarSign className="size-4 text-emerald-600" />
          </div>
          <div>
            <h3 id="apply-payment-dialog-title" className="text-sm font-bold text-stone-900">
              Apply to invoice
            </h3>
            <p className="text-xs text-stone-400 mt-0.5">
              Unapplied balance: {currency(unappliedAmount)}
            </p>
          </div>
        </div>

        <div className="space-y-3">
          <div>
            <label className={fieldLabelCls}>Invoice</label>
            <div className="mt-1.5">
              <InvoicePicker customer={customer} value={invoice} onChange={setInvoice} excludeIds={excludeIds} />
            </div>
          </div>
          <div>
            <label htmlFor="apply-amount" className={fieldLabelCls}>Amount</label>
            <input
              id="apply-amount"
              type="number"
              min="0.01"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              className={`${fieldCls} mt-1.5`}
              aria-label="Application amount"
            />
          </div>
        </div>

        {apply.error && (
          <p className="mt-3 text-xs text-destructive">
            {apiErrorMessage(apply.error, 'Failed to apply payment.')}
          </p>
        )}

        <div className="flex justify-end gap-2 mt-4">
          <button
            type="button"
            onClick={onClose}
            disabled={apply.isPending}
            className="rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-xs font-medium text-stone-600 hover:bg-stone-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => apply.mutate()}
            disabled={apply.isPending || !invoice || !validAmount}
            className="rounded-lg bg-brand px-3 py-1.5 text-xs font-semibold text-stone-900 hover:bg-brand-hover disabled:opacity-50 disabled:cursor-not-allowed active:scale-95 transition-all"
          >
            {apply.isPending ? 'Applying…' : 'Apply'}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function ReadonlyField({ label, value, full }: { label: string; value?: string; full?: boolean }) {
  return (
    <div className={cn('space-y-1', full && 'col-span-full')}>
      <label className={fieldLabelCls}>{label}</label>
      <div className={readonlyCls}>{value || <span className="text-stone-400">—</span>}</div>
    </div>
  );
}

function Total({ label, value, bold }: { label: string; value: number; bold?: boolean }) {
  return (
    <div>
      <p className="text-2xs font-semibold uppercase tracking-wide text-stone-400">{label}</p>
      <p className={cn('tabular-nums', bold ? 'text-sm font-bold text-stone-900' : 'text-xs font-semibold text-stone-600')}>
        {currency(value)}
      </p>
    </div>
  );
}
