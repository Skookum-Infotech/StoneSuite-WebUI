import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { Undo2, Upload, Pencil, FileDown, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { refundService } from '@/services/refundService';
import { apiErrorMessage } from '@/api/tenantClient';
import { Spinner, ErrorNote, Badge } from '@/components/tenant/ui';
import { ModernSection } from '@/components/crm/FormPrimitives';
import { readonlyCls, fieldLabelCls } from '@/components/crm/formUtils';
import { FilesContent } from '@/components/crm/CrmSubTabsPanel';
import { CrmPageHeader } from '@/pages/crm/components/CrmPageHeader';
import { ApprovalBanner } from '@/components/tenant/ApprovalBanner';
import { useBreadcrumbStore } from '@/store/useBreadcrumbStore';
import { useUserPermissions } from '@/hooks/useUserPermissions';
import { cn } from '@/lib/utils';
import { REFUND_STATUS_COLORS, REFUND_STATUS_CODES } from '@/lib/refundForm';
import { statusToastLabel } from '@/lib/statusToast';
import { RefundAuditTab } from './components/RefundAuditTab';
import { RefundApplicationsTab } from './components/RefundApplicationsTab';
import { DeleteRefundDialog } from './components/DeleteRefundDialog';
import { SalesDetailSidebar } from './components/SalesDetailSidebar';
import { RefundStatusControl } from './components/RefundStatusControl';

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

export default function RefundDetailPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [exportingPdf, setExportingPdf] = useState(false);
  const [exportPdfError, setExportPdfError] = useState<string>();

  const { hasPermission, isLoading: permissionsLoading } = useUserPermissions();
  const canEdit = permissionsLoading || hasPermission('refund', 'update');
  const canDelete = permissionsLoading || hasPermission('refund', 'delete');

  const { data: refund, isLoading, error } = useQuery({
    queryKey: ['refund', id],
    queryFn: () => refundService.getRefund(id),
    enabled: Boolean(id),
  });

  const setLabel = useBreadcrumbStore((s) => s.setLabel);
  const clearLabel = useBreadcrumbStore((s) => s.clearLabel);
  useEffect(() => {
    if (refund?.refundNumber) {
      setLabel(id, refund.refundNumber);
      return () => clearLabel(id);
    }
  }, [id, refund?.refundNumber, setLabel, clearLabel]);

  // Inline status change from the sidebar's Status row — mirrors the Edit
  // page's transition mutation.
  const transition = useMutation({
    mutationFn: (toStatusCode: string) => refundService.transition(id, toStatusCode),
    onSuccess: (_data, toStatusCode) => {
      queryClient.invalidateQueries({ queryKey: ['refund', id] });
      queryClient.invalidateQueries({ queryKey: ['refunds'] });
      toast.success(`Moved to ${statusToastLabel(REFUND_STATUS_CODES, toStatusCode)}.`);
    },
  });

  const approve = useMutation({
    mutationFn: () => refundService.approve(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['refund', id] });
      queryClient.invalidateQueries({ queryKey: ['refunds'] });
      toast.success('Approved.');
    },
  });

  if (isLoading) return <div className="p-6"><Spinner label="Loading refund…" /></div>;
  if (error || !refund)
    return <div className="p-6"><ErrorNote>{apiErrorMessage(error, 'Failed to load refund.')}</ErrorNote></div>;

  const color = REFUND_STATUS_COLORS[refund.status] ?? '#a8a29e';

  async function handleExportPdf() {
    if (!refund) return;
    setExportPdfError(undefined);
    setExportingPdf(true);
    try {
      const { exportSalesDocToPdf } = await import('@/lib/salesPdfExport');
      await exportSalesDocToPdf({
        docType: 'refund',
        title: refund.refundNumber || 'Refund',
        recordNumber: refund.refundNumber,
        statusLabel: refund.status,
        customerName: refund.customer.name,
        createdAt: refund.createdAt,
        updatedAt: refund.updatedAt,
        sections: [
          {
            title: 'Primary Information',
            rows: [
              ['Refund Method', refund.method || ''],
              ['Reference #', refund.referenceNumber || ''],
              ['Refund Date', fmtDate(refund.refundDate)],
              ['Reason', refund.reason || ''],
              ['Memo', refund.memo || ''],
              ['Internal Notes', refund.internalNotes || ''],
            ],
          },
          {
            title: 'Applications',
            rows: refund.applications.map((app) => [
              app.paymentNumber ? `Payment ${app.paymentNumber}` : `Credit Memo ${app.creditMemoNumber || '—'}`,
              currency(app.amount),
            ]),
          },
        ],
        totals: [
          { label: 'Amount', value: currency(refund.amount), bold: true },
          { label: 'Applied', value: currency(refund.appliedTotal) },
          { label: 'Unapplied', value: currency(refund.unappliedAmount), bold: true },
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
        backLabel="Refunds"
        onBack={() => navigate('/sales/refund')}
        icon={Undo2}
        title={refund.refundNumber || 'Refund'}
        subtitle={refund.customer.name}
        recordNumber={refund.refundNumber}
        statusBadge={<Badge color={color}>{refund.status}</Badge>}
      />

      {refund.gated && (
        <>
          <ApprovalBanner
            approverNames={refund.approvers.filter((a) => !a.approved).map((a) => a.name)}
            canApprove={refund.canApprove}
            isOverride={refund.isOverride}
            requiredApprovals={refund.requiredApprovals}
            approvedCount={refund.approvedCount}
            callerAlreadyApproved={refund.callerAlreadyApproved}
            onApprove={() => approve.mutate()}
            approving={approve.isPending}
          />
          {approve.isError && (
            <p role="alert" className="px-5 py-1.5 text-2xs text-destructive 3xl:px-12 4xl:px-16">
              {apiErrorMessage(approve.error, 'Failed to approve refund.')}
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
                  <ReadonlyField label="Refund Method" value={refund.method} />
                  <ReadonlyField label="Reference #" value={refund.referenceNumber} />
                  <ReadonlyField label="Refund Date" value={fmtDate(refund.refundDate)} />
                  {refund.reason && <ReadonlyField label="Reason" value={refund.reason} full />}
                  {refund.memo && <ReadonlyField label="Memo" value={refund.memo} full />}
                  {refund.internalNotes && <ReadonlyField label="Internal Notes" value={refund.internalNotes} full />}
                </div>
              </ModernSection>
              {/* Amount / Applied / Unapplied only — a refund is scalar: no line
                  items, so no subtotal or tax to roll up (spec AD-1). */}
              <div className="rounded-lg border border-stone-200 bg-white p-4">
                <div className="grid grid-cols-3 gap-3">
                  <Total label="Amount" value={refund.amount} bold />
                  <Total label="Applied" value={refund.appliedTotal} />
                  <Total label="Unapplied" value={refund.unappliedAmount} bold />
                </div>
              </div>
            </>
          )}

          {activeTab === 'applications' && <RefundApplicationsTab refund={refund} />}
          {activeTab === 'audit' && <RefundAuditTab refundId={id} />}
          {activeTab === 'files' && <FilesContent ref={null} recordId={id} readOnly={!canEdit} />}

          <div className="h-6" />
        </div>

        {/* Right sidebar */}
        <SalesDetailSidebar label="Refund Details">
          <div className="rounded-xl border border-stone-200 bg-white shadow-sm p-4 space-y-3 mb-4">
            <p className="text-xs font-semibold text-stone-400">Quick Actions</p>
            <div className="space-y-0.5">
              {canEdit && (
                <button
                  type="button"
                  onClick={() => navigate(`/sales/refund/${id}/edit`, { state: { initialTab: 'files' } })}
                  className="flex items-center gap-2.5 hover:bg-stone-50 rounded-lg px-3 py-2 cursor-pointer text-xs text-stone-700 w-full transition-colors text-left"
                >
                  <Upload className="size-4 text-stone-400 shrink-0" aria-hidden="true" />
                  Upload file
                </button>
              )}
              {canEdit && (
                <button
                  type="button"
                  onClick={() => navigate(`/sales/refund/${id}/edit`)}
                  className="flex items-center gap-2.5 hover:bg-stone-50 rounded-lg px-3 py-2 cursor-pointer text-xs text-stone-700 w-full transition-colors text-left"
                >
                  <Pencil className="size-4 text-stone-400 shrink-0" aria-hidden="true" />
                  Edit refund
                </button>
              )}
              <button
                type="button"
                onClick={handleExportPdf}
                disabled={exportingPdf}
                className="flex items-center gap-2.5 hover:bg-stone-50 rounded-lg px-3 py-2 cursor-pointer text-xs text-stone-700 w-full transition-colors text-left disabled:opacity-60 disabled:cursor-not-allowed"
                aria-label="Export as PDF"
              >
                {exportingPdf ? <Loader2 className="size-4 text-stone-400 shrink-0 animate-spin" aria-hidden="true" /> : <FileDown className="size-4 text-stone-400 shrink-0" aria-hidden="true" />}
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
              <RefundStatusControl
                refund={refund}
                onChange={(code) => transition.mutate(code)}
                disabled={transition.isPending}
                variant="pill"
              />
            </div>
            <div className="flex justify-between items-center py-2 border-b border-stone-100 text-xs">
              <span className="text-stone-500">Customer</span>
              <span className="text-stone-700 truncate max-w-[140px]">{refund.customer.name}</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-stone-100 text-xs">
              <span className="text-stone-500">Created</span>
              <span className="text-stone-700">{fmtDate(refund.createdAt)}</span>
            </div>
            <div className="flex justify-between items-center py-2 text-xs">
              <span className="text-stone-500">Updated</span>
              <span className="text-stone-700">{fmtDate(refund.updatedAt)}</span>
            </div>
          </div>

          {canDelete && (
            <div className="rounded-xl border border-stone-200 bg-white shadow-sm p-4 space-y-3 mb-4">
              <p className="text-xs font-semibold text-red-400">Danger Zone</p>
              <DeleteRefundDialog
                refundId={id}
                label={`Refund ${refund.refundNumber}`}
                onDeleted={() => {
                  queryClient.invalidateQueries({ queryKey: ['refunds'] });
                  navigate('/sales/refund');
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
