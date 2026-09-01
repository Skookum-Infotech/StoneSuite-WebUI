import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { Wallet, Upload, Pencil, FileDown, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { vendorPaymentService } from '@/services/vendorPaymentService';
import { apiErrorMessage } from '@/api/tenantClient';
import { Spinner, ErrorNote, Badge } from '@/components/tenant/ui';
import { ModernSection } from '@/components/crm/FormPrimitives';
import { readonlyCls, fieldLabelCls } from '@/components/crm/formUtils';
import { FilesContent } from '@/components/crm/CrmSubTabsPanel';
import { CrmPageHeader } from '@/pages/crm/components/CrmPageHeader';
import { ApprovalBanner } from '@/components/tenant/ApprovalBanner';
import { SalesDetailSidebar } from '@/pages/sales/components/SalesDetailSidebar';
import { useBreadcrumbStore } from '@/store/useBreadcrumbStore';
import { useUserPermissions } from '@/hooks/useUserPermissions';
import { cn } from '@/lib/utils';
import { VP_STATUS_COLORS, VP_STATUS_CODES, VP_EDITABLE_STATUSES, vpTransitionTargets } from '@/lib/vendorPaymentForm';
import { statusToastLabel } from '@/lib/statusToast';
import { VendorPaymentAuditTab } from './components/VendorPaymentAuditTab';
import { VendorPaymentApplicationsTab } from './components/VendorPaymentApplicationsTab';
import { VendorPaymentRefundsTab } from './components/VendorPaymentRefundsTab';
import { VendorPaymentTransitionBar } from './components/VendorPaymentTransitionBar';
import { DeleteVendorPaymentDialog } from './components/DeleteVendorPaymentDialog';
import type { VendorPayment } from '@/types/vendorPayment';

const TABS = [
  { key: 'overview', label: 'Overview' },
  { key: 'applications', label: 'Applications' },
  { key: 'refunds', label: 'Refunds' },
  { key: 'audit', label: 'Audit' },
  { key: 'files', label: 'Files' },
] as const;

// Poll the primary record so status/approval changes made by another user or
// tab show up without a manual reload — same cadence as NotificationBell's
// unread poll.
const DETAIL_POLL_MS = 60_000;
type Tab = (typeof TABS)[number]['key'];

function fmtDate(iso?: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

function currency(n: number | undefined): string {
  return (n ?? 0).toLocaleString(undefined, { style: 'currency', currency: 'USD' });
}

export default function VendorPaymentDetailPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [exportingPdf, setExportingPdf] = useState(false);
  const [exportPdfError, setExportPdfError] = useState<string>();

  const { hasPermission, isLoading: permissionsLoading } = useUserPermissions();
  const canEdit = permissionsLoading || hasPermission('vendor_payment', 'update');
  const canDelete = permissionsLoading || hasPermission('vendor_payment', 'delete');
  const canTransition = permissionsLoading || hasPermission('vendor_payment', 'transition');

  const { data: payment, isLoading, error } = useQuery({
    queryKey: ['vendor-payment', id],
    queryFn: () => vendorPaymentService.getVendorPayment(id),
    enabled: Boolean(id),
    refetchInterval: DETAIL_POLL_MS,
  });

  const setLabel = useBreadcrumbStore((s) => s.setLabel);
  const clearLabel = useBreadcrumbStore((s) => s.clearLabel);
  useEffect(() => {
    if (payment?.vendorPaymentNumber) {
      setLabel(id, payment.vendorPaymentNumber);
      return () => clearLabel(id);
    }
  }, [id, payment?.vendorPaymentNumber, setLabel, clearLabel]);

  // Every mutation on this page (transition/approve/apply/unapply) returns the
  // full updated payment, so the cache is re-seeded from the response instead
  // of refetching. Applying also moves a vendor bill's balance, hence the
  // vendor-bill invalidations.
  function absorb(updated: VendorPayment) {
    queryClient.setQueryData(['vendor-payment', id], updated);
    queryClient.invalidateQueries({ queryKey: ['vendor-payments'] });
    queryClient.invalidateQueries({ queryKey: ['vendor-bills'] });
    queryClient.invalidateQueries({ queryKey: ['vendor-bill'] });
  }

  const transition = useMutation({
    mutationFn: (toStatusCode: string) => vendorPaymentService.transition(id, toStatusCode),
    onSuccess: (updated, toStatusCode) => {
      absorb(updated);
      toast.success(`Moved to ${statusToastLabel(VP_STATUS_CODES, toStatusCode)}.`);
    },
  });

  const approve = useMutation({
    mutationFn: () => vendorPaymentService.approve(id),
    onSuccess: (updated) => {
      absorb(updated);
      toast.success('Approved.');
    },
  });

  if (isLoading) return <div className="p-6"><Spinner label="Loading vendor payment…" /></div>;
  if (!payment)
    return <div className="p-6"><ErrorNote>{apiErrorMessage(error, 'Failed to load vendor payment.')}</ErrorNote></div>;

  const color = VP_STATUS_COLORS[payment.statusCode] ?? '#a8a29e';
  // The backend refuses a delete while any live application references the
  // payment (409) — unapply or void it first.
  const canDeleteHere = canDelete && payment.applications.length === 0;
  const hasTransitions = canTransition && vpTransitionTargets(payment.statusCode).length > 0;
  const showActions = hasTransitions || Boolean(transition.error);
  const canEditHere = canEdit && VP_EDITABLE_STATUSES.has(payment.statusCode);

  async function handleExportPdf() {
    if (!payment) return;
    setExportPdfError(undefined);
    setExportingPdf(true);
    try {
      const { exportPurchasesRecordToPdf } = await import('@/lib/purchasesPdfExport');
      await exportPurchasesRecordToPdf({
        recordType: 'vendor_payment',
        title: payment.vendorPaymentNumber || 'Vendor Payment',
        recordNumber: payment.vendorPaymentNumber,
        statusLabel: payment.status,
        counterpartyName: payment.vendor.name,
        createdAt: payment.createdAt,
        updatedAt: payment.updatedAt,
        sections: [
          {
            title: 'Primary Information',
            rows: [
              ['Payment Method', payment.method || ''],
              ['Reference #', payment.referenceNumber || ''],
              ['Payment Date', fmtDate(payment.paymentDate)],
              ['Scheduled Date', payment.scheduledDate ? fmtDate(payment.scheduledDate) : ''],
              ['Memo', payment.memo || ''],
              ['Internal Notes', payment.internalNotes || ''],
            ],
          },
        ],
        itemsTable: {
          title: 'Applications',
          head: ['Vendor Bill #', 'Amount', 'Applied On'],
          rows: payment.applications.map((app) => [
            app.vendorBillNumber || '—',
            currency(app.amount),
            fmtDate(app.createdAt),
          ]),
          numericFrom: 1,
        },
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
        backLabel="Vendor Payments"
        onBack={() => navigate('/purchases/vendor_payment')}
        icon={Wallet}
        title={payment.vendorPaymentNumber || 'Vendor Payment'}
        subtitle={payment.vendor.name}
        recordNumber={payment.vendorPaymentNumber}
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
              {apiErrorMessage(approve.error, 'Failed to approve vendor payment.')}
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
                  <ReadonlyField
                    label="Scheduled Date"
                    value={payment.scheduledDate ? fmtDate(payment.scheduledDate) : undefined}
                  />
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
            <VendorPaymentApplicationsTab payment={payment} canEdit={canEdit} onChanged={absorb} />
          )}
          {activeTab === 'refunds' && <VendorPaymentRefundsTab refunds={payment.refunds ?? []} />}
          {activeTab === 'audit' && <VendorPaymentAuditTab vendorPaymentId={id} />}
          {activeTab === 'files' && <FilesContent ref={null} recordId={id} readOnly={false} />}

          <div className="h-6" />
        </div>

        {/* Right sidebar */}
        <SalesDetailSidebar label="Vendor Payment Details">
          <div className="rounded-xl border border-stone-200 bg-white shadow-sm p-4 space-y-3 mb-4">
            <p className="text-xs font-semibold text-stone-400">Quick Actions</p>
            <div className="space-y-0.5">
              <button
                type="button"
                onClick={() => navigate(`/purchases/vendor_payment/${id}/edit`, { state: { initialTab: 'files' } })}
                className="flex items-center gap-2.5 hover:bg-stone-50 rounded-lg px-3 py-2 cursor-pointer text-xs text-stone-700 w-full transition-colors text-left"
              >
                <Upload className="size-4 text-stone-400 shrink-0" />
                Upload file
              </button>
              {canEditHere && (
                <button
                  type="button"
                  onClick={() => navigate(`/purchases/vendor_payment/${id}/edit`)}
                  className="flex items-center gap-2.5 hover:bg-stone-50 rounded-lg px-3 py-2 cursor-pointer text-xs text-stone-700 w-full transition-colors text-left"
                >
                  <Pencil className="size-4 text-stone-400 shrink-0" />
                  Edit vendor payment
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

          {showActions && (
            <div className="rounded-xl border border-stone-200 bg-white shadow-sm p-4 space-y-3 mb-4">
              <p className="text-xs font-semibold text-stone-400">Actions</p>
              <VendorPaymentTransitionBar
                statusCode={payment.statusCode}
                approvalStatus={payment.approvalStatus}
                gated={payment.gated}
                scheduledDate={payment.scheduledDate}
                onTransition={(toCode) => transition.mutate(toCode)}
                isPending={transition.isPending}
              />
              {transition.error && (
                <p role="alert" className="text-2xs text-destructive">
                  {apiErrorMessage(transition.error, 'Failed to change status.')}
                </p>
              )}
            </div>
          )}

          <div className="rounded-xl border border-stone-200 bg-white shadow-sm p-4 space-y-3 mb-4">
            <p className="text-xs font-semibold text-stone-400">Status</p>
            <div className="flex justify-between items-center py-2 border-b border-stone-100 text-xs">
              <span className="text-stone-500">Status</span>
              <Badge color={color}>{payment.status}</Badge>
            </div>
            {payment.approvalStatus !== 'none' && (
              <div className="flex justify-between items-center py-2 border-b border-stone-100 text-xs">
                <span className="text-stone-500">Approval</span>
                <span className={cn('font-medium', payment.approvalStatus === 'approved' ? 'text-emerald-600' : 'text-amber-600')}>
                  {payment.approvalStatus === 'approved' ? 'Approved' : 'Pending Approval'}
                </span>
              </div>
            )}
            <div className="flex justify-between items-center py-2 border-b border-stone-100 text-xs">
              <span className="text-stone-500">Vendor</span>
              <button
                type="button"
                onClick={() => navigate(`/purchases/vendor/${payment.vendor.id}`)}
                className="text-stone-700 hover:text-accent-foreground truncate max-w-[140px] transition-colors"
              >
                {payment.vendor.name}
              </button>
            </div>
            {payment.scheduledDate && (
              <div className="flex justify-between items-center py-2 border-b border-stone-100 text-xs">
                <span className="text-stone-500">Scheduled</span>
                <span className="text-stone-700">{fmtDate(payment.scheduledDate)}</span>
              </div>
            )}
            <div className="flex justify-between items-center py-2 border-b border-stone-100 text-xs">
              <span className="text-stone-500">Created</span>
              <span className="text-stone-700">{fmtDate(payment.createdAt)}</span>
            </div>
            <div className="flex justify-between items-center py-2 text-xs">
              <span className="text-stone-500">Updated</span>
              <span className="text-stone-700">{fmtDate(payment.updatedAt)}</span>
            </div>
          </div>

          {canDeleteHere && (
            <div className="rounded-xl border border-stone-200 bg-white shadow-sm p-4 space-y-3 mb-4">
              <p className="text-xs font-semibold text-red-400">Danger Zone</p>
              <DeleteVendorPaymentDialog
                vendorPaymentId={id}
                label={`Vendor Payment ${payment.vendorPaymentNumber}`}
                onDeleted={() => {
                  queryClient.invalidateQueries({ queryKey: ['vendor-payments'] });
                  navigate('/purchases/vendor_payment');
                }}
              />
            </div>
          )}
        </SalesDetailSidebar>
      </div>
    </div>
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
