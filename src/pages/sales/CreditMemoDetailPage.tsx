import { useState, useEffect } from 'react';
import { AddressGeoLine } from '@/components/tenant/AddressGeoLine';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { lookupService } from '@/services/lookupService';
import { currencyCodeFor } from '@/lib/formatMoney';
import { FileMinus, Upload, Pencil, DollarSign, Unlink, Loader2, FileDown, CreditCard } from 'lucide-react';
import { toast } from 'sonner';
import { creditMemoService } from '@/services/creditMemoService';
import { apiErrorMessage } from '@/api/tenantClient';
import { Spinner, ErrorNote, Badge } from '@/components/tenant/ui';
import { ModernSection } from '@/components/crm/FormPrimitives';
import { readonlyCls, fieldLabelCls } from '@/components/crm/formUtils';
import { FilesContent } from '@/components/crm/CrmSubTabsPanel';
import { CrmPageHeader } from '@/pages/crm/components/CrmPageHeader';
import { RecordApprovalBanner } from '@/components/tenant/RecordApprovalBanner';
import { useBreadcrumbStore } from '@/store/useBreadcrumbStore';
import { useUserPermissions } from '@/hooks/useUserPermissions';
import { cn } from '@/lib/utils';
import { TAB_LIST_CLASS, tabClass } from '@/components/ui/tabStyles';
import { CREDIT_MEMO_STATUS_COLORS, CREDIT_MEMO_READONLY_STATUSES, CREDIT_MEMO_DRAFT_STATUS } from '@/lib/creditMemoForm';
import { CreditMemoAuditTab } from './components/CreditMemoAuditTab';
import { DeleteCreditMemoDialog } from './components/DeleteCreditMemoDialog';
import { DangerZoneCard } from '@/components/tenant/DangerZoneCard';
import { VoidCreditMemoDialog } from './components/VoidCreditMemoDialog';
import { ApplyCreditMemoDialog } from './components/ApplyCreditMemoDialog';
import { SalesDetailSidebar } from './components/SalesDetailSidebar';
import { AmountsStrip } from './components/AmountsStrip';
import type { CreditMemoApplication } from '@/types/creditMemo';
import { formatDateValue } from '@/lib/dateUtils';
import { CustomerLink } from '@/components/crm/CustomerLink';

import { buttonVariants } from '@/components/ui/button';
const TABS = [
  { key: 'overview', label: 'Overview' },
  { key: 'items', label: 'Items' },
  { key: 'applications', label: 'Applications' },
  { key: 'audit', label: 'Audit' },
  { key: 'files', label: 'Files' },
] as const;

// Poll the primary record so status/approval changes made by another user or
// tab show up without a manual reload — same cadence as NotificationBell's
// unread poll.
const DETAIL_POLL_MS = 60_000;
type Tab = (typeof TABS)[number]['key'];

function fmtDate(iso?: string): string {
  if (!iso) return '—';
  return formatDateValue(iso, undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

function currency(n: number | undefined): string {
  return (n ?? 0).toLocaleString(undefined, { style: 'currency', currency: 'USD' });
}

export default function CreditMemoDetailPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [applyOpen, setApplyOpen] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [exportPdfError, setExportPdfError] = useState<string>();

  const { hasPermission, isLoading: permissionsLoading } = useUserPermissions();
  const canUpdate = permissionsLoading || hasPermission('credit_memo', 'update');
  const canDelete = permissionsLoading || hasPermission('credit_memo', 'delete');
  const canTransition = permissionsLoading || hasPermission('credit_memo', 'transition');

  const { data: creditMemo, isLoading, error } = useQuery({
    queryKey: ['creditMemo', id],
    queryFn: () => creditMemoService.getCreditMemo(id),
    enabled: Boolean(id),
    refetchInterval: DETAIL_POLL_MS,
  });

  const { data: lookups } = useQuery({
    queryKey: ['crm-lookups'],
    queryFn: lookupService.getCrmLookups,
    staleTime: 10 * 60 * 1000,
  });

  const setLabel = useBreadcrumbStore((s) => s.setLabel);
  const clearLabel = useBreadcrumbStore((s) => s.clearLabel);
  useEffect(() => {
    if (creditMemo?.creditMemoNumber) {
      setLabel(id, creditMemo.creditMemoNumber);
      return () => clearLabel(id);
    }
  }, [id, creditMemo?.creditMemoNumber, setLabel, clearLabel]);

  // Records this caller's sign-off on the memo's current gate (DRFT, AD-8)
  // via the shared approvalchain engine -- NOT a direct transition(id,
  // 'APPV'), which the backend now blocks with a 409 once real approvers
  // are configured for DRFT (ErrApprovalRequired).
  const approve = useMutation({
    mutationFn: () => creditMemoService.approve(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['creditMemo', id] });
      queryClient.invalidateQueries({ queryKey: ['creditMemos'] });
      toast.success('Approved.');
    },
  });

  // An approver rejected it. The POST response carries no approval overlay, so refetch
  // to show the rejection banner and drop it from the list's pending view.
  const handleRejected = () => {
    queryClient.invalidateQueries({ queryKey: ['creditMemo', id] });
    queryClient.invalidateQueries({ queryKey: ['creditMemos'] });
    toast.success('Rejected — edit it to resubmit for approval.');
  };

  const unapply = useMutation({
    mutationFn: (invoiceId: string) => creditMemoService.unapply(id, invoiceId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['creditMemo', id] }),
  });

  if (isLoading) return <div className="p-6"><Spinner label="Loading credit memo…" /></div>;
  if (!creditMemo)
    return <div className="p-6"><ErrorNote>{apiErrorMessage(error, 'Failed to load credit memo.')}</ErrorNote></div>;

  const color = CREDIT_MEMO_STATUS_COLORS[creditMemo.status] ?? '#a8a29e';
  const isDraft = creditMemo.statusCode === CREDIT_MEMO_DRAFT_STATUS;
  const isReadOnly = CREDIT_MEMO_READONLY_STATUSES.has(creditMemo.statusCode);
  const canVoid = canTransition && (isDraft || creditMemo.statusCode === 'APPV');
  const canApply = canUpdate && creditMemo.statusCode === 'APPV';
  // A credit memo is one Amount, so it has no line items to show. Memos entered
  // before that (which do have lines) keep a read-only Items tab.
  const visibleTabs = TABS.filter((tab) => tab.key !== 'items' || creditMemo.lines.length > 0);

  async function handleExportPdf() {
    if (!creditMemo) return;
    setExportPdfError(undefined);
    setExportingPdf(true);
    try {
      const { exportSalesDocToPdf } = await import('@/lib/salesPdfExport');
      await exportSalesDocToPdf({
        docType: 'credit_memo',
        title: creditMemo.creditMemoNumber || 'Credit Memo',
        recordNumber: creditMemo.creditMemoNumber,
        statusLabel: creditMemo.status,
        customerName: creditMemo.customer.name,
        issueDate: fmtDate(creditMemo.creditMemoDate),
        keyAmount: { label: 'Unapplied Amount', value: currency(creditMemo.unappliedAmount) },
        billTo: creditMemo.billing,
        notesText: creditMemo.notes || undefined,
        sections: [],
        itemsTable: creditMemo.lines.length > 0 ? {
          head: ['#', 'Item', 'SKU', 'Qty', 'Unit Price', 'Disc %', 'Tax %', 'Total'],
          rows: creditMemo.lines.map((line) => [
            String(line.lineNumber),
            line.itemName || line.description || '—',
            line.sku || '—',
            String(line.quantity),
            currency(line.unitPrice),
            `${line.discountPercent}%`,
            `${line.taxPercent}%`,
            currency(line.lineTotal),
          ]),
          descriptions: creditMemo.lines.map((line) => line.description || undefined),
          numericFrom: 3,
        } : undefined,
        totals: [
          { label: 'Subtotal', value: currency(creditMemo.subtotal) },
          ...(creditMemo.discountTotal > 0 ? [{ label: 'Discount', value: currency(creditMemo.discountTotal) }] : []),
          { label: 'Tax', value: currency(creditMemo.taxTotal) },
          { label: 'Adjustment', value: currency(creditMemo.adjustment) },
          { label: 'Grand Total', value: currency(creditMemo.grandTotal), bold: true },
          { label: 'Applied Total', value: currency(creditMemo.appliedTotal) },
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
        backLabel="Credit Memos"
        onBack={() => navigate('/sales/credit_memo')}
        icon={FileMinus}
        title={creditMemo.creditMemoNumber || 'Credit Memo'}
        subtitle={creditMemo.customer.name}
        recordNumber={creditMemo.creditMemoNumber}
        statusBadge={<Badge color={color}>{creditMemo.status}</Badge>}
      />

      <RecordApprovalBanner
        record={creditMemo}
        onApprove={() => approve.mutate()}
        approving={approve.isPending}
        reject={{ noun: 'credit memo', run: (reason) => creditMemoService.reject(id, reason), onRejected: handleRejected }}
      />
      {creditMemo.gated && approve.isError && (
        <p role="alert" className="px-5 py-1.5 3xl:px-12 4xl:px-16 type-error">
          {apiErrorMessage(approve.error, 'Failed to approve credit memo.')}
        </p>
      )}

      {/* Tab bar */}
      <div className="flex shrink-0 overflow-x-auto overflow-y-hidden border-b border-stone-200 bg-white px-5 3xl:px-12 4xl:px-16 modal-scrollbar py-2.5">
        <div role="tablist" className={TAB_LIST_CLASS}>
          {visibleTabs.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={tabClass(activeTab === tab.key)}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-6 px-4 py-4 sm:px-5 sm:py-5 3xl:px-12 3xl:py-8 3xl:gap-10 4xl:px-16 4xl:py-10 4xl:gap-14">
        {/* Left column */}
        <div className="flex-1 space-y-3 min-w-0">
          {activeTab === 'overview' && (
            <>
              <AmountsStrip
                items={[
                  { label: 'Subtotal', value: creditMemo.subtotal },
                  ...(creditMemo.discountTotal > 0 ? [{ label: 'Discount', value: creditMemo.discountTotal }] : []),
                  { label: 'Tax', value: creditMemo.taxTotal },
                  { label: 'Adjustment', value: creditMemo.adjustment },
                  { label: 'Grand Total', value: creditMemo.grandTotal, emphasis: 'strong' },
                  { label: 'Applied Total', value: creditMemo.appliedTotal },
                  { label: 'Unapplied Amount', value: creditMemo.unappliedAmount, emphasis: 'key' },
                ]}
              />
              <ModernSection title="Primary Information" index={0}>
                <div className="grid grid-cols-1 gap-x-5 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
                  <ReadonlyField label="Credit Memo Date" value={fmtDate(creditMemo.creditMemoDate)} />
                  <ReadonlyField label="Reference #" value={creditMemo.referenceNumber} />
                  <ReadonlyField label="Reason" value={creditMemo.reason} />
                  <ReadonlyField label="Invoice" value={creditMemo.invoice?.number} />
                  <ReadonlyField label="Sales Order" value={creditMemo.salesOrder?.number} />
                  {creditMemo.sourcePayment && (
                    <div className="space-y-1">
                      <label className={fieldLabelCls}>Source Payment</label>
                      <Link
                        to={`/sales/payment/${creditMemo.sourcePayment.id}`}
                        aria-label={`View payment ${creditMemo.sourcePayment.number}`}
                        className="inline-flex items-center gap-1.5 rounded-[10px] border border-stone-300 bg-stone-50 px-3.5 py-2.5 text-xs font-semibold text-accent-foreground hover:bg-stone-100 transition-colors"
                      >
                        <CreditCard className="size-3.5" />
                        {creditMemo.sourcePayment.number}
                      </Link>
                    </div>
                  )}
                  <ReadonlyField label="Sales Tax %" value={`${creditMemo.salesTaxPercent}%`} />
                  {creditMemo.memo && <ReadonlyField label="Memo" value={creditMemo.memo} full />}
                  {creditMemo.notes && <ReadonlyField label="Notes" value={creditMemo.notes} full />}
                  {creditMemo.internalNotes && <ReadonlyField label="Internal Notes" value={creditMemo.internalNotes} full />}
                </div>
              </ModernSection>
              <ModernSection title="Billing Address" index={1}>
                <AddressBlock addr={creditMemo.billing ?? {}} />
              </ModernSection>
            </>
          )}

          {activeTab === 'items' && (
            <div className="overflow-x-auto modal-scrollbar rounded-lg border border-stone-200 bg-white">
              <table className="w-full text-left type-cell">
                <thead className="bg-stone-50 border-b border-stone-200">
                  <tr className="divide-x divide-stone-200">
                    {[
                      { label: '#' },
                      { label: 'Item' },
                      { label: 'SKU' },
                      { label: 'Qty', right: true },
                      { label: 'Unit Price', right: true },
                      { label: 'Disc %', right: true },
                      { label: 'Tax %', right: true },
                      { label: 'Total', right: true },
                    ].map((h) => (
                      <th key={h.label} className={cn('px-3 py-2.5 whitespace-nowrap type-th', h.right && 'text-right')}>{h.label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {creditMemo.lines.map((line) => (
                    <tr key={line.id} className="hover:bg-stone-50/50 divide-x divide-stone-100">
                      <td className="type-cell px-3 py-2.5 tabular-nums">{line.lineNumber}</td>
                      <td className="type-cell px-3 py-2.5 font-medium">
                        {line.itemName || line.description || <span className="text-ink-muted">—</span>}
                      </td>
                      <td className="px-3 py-2.5 type-record-id">{line.sku || '—'}</td>
                      <td className="type-cell px-3 py-2.5 tabular-nums text-right">{line.quantity}</td>
                      <td className="type-cell px-3 py-2.5 tabular-nums text-right">{currency(line.unitPrice)}</td>
                      <td className="type-cell px-3 py-2.5 tabular-nums text-right">{line.discountPercent}%</td>
                      <td className="type-cell px-3 py-2.5 tabular-nums text-right">{line.taxPercent}%</td>
                      <td className="type-cell-strong px-3 py-2.5 tabular-nums text-right">{currency(line.lineTotal)}</td>
                    </tr>
                  ))}
                  {creditMemo.lines.length === 0 && (
                    <tr><td colSpan={8} className="type-cell py-8 text-center">No line items.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {activeTab === 'applications' && (
            <div className="space-y-3">
              {canApply && (
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => setApplyOpen(true)}
                    disabled={creditMemo.unappliedAmount <= 0}
                    title={creditMemo.unappliedAmount <= 0 ? 'No unapplied balance remaining.' : undefined}
                    className={buttonVariants()}
                  >
                    <DollarSign className="size-3.5" />
                    Apply Credit
                  </button>
                </div>
              )}

              <div className="overflow-x-auto modal-scrollbar rounded-lg border border-stone-200 bg-white">
                <table className="w-full text-left type-cell">
                  <thead className="bg-stone-50 border-b border-stone-200">
                    <tr className="divide-x divide-stone-200">
                      {['Invoice', 'Amount', 'Date', ''].map((h) => (
                        <th key={h} className="px-3 py-2.5 whitespace-nowrap type-th">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100">
                    {creditMemo.applications.map((app: CreditMemoApplication) => (
                      <tr key={app.id} className="hover:bg-stone-50/50 divide-x divide-stone-100">
                        <td className="type-cell px-3 py-2.5 font-medium">
                          <button type="button" onClick={() => navigate(`/sales/invoice/${app.invoiceId}`)} className="hover:text-accent-foreground transition-colors">
                            {app.invoiceNumber || '—'}
                          </button>
                        </td>
                        <td className="type-cell px-3 py-2.5 tabular-nums">{currency(app.amount)}</td>
                        <td className="type-cell px-3 py-2.5 tabular-nums">{fmtDate(app.createdAt)}</td>
                        <td className="px-3 py-2.5 text-right">
                          {canApply && (
                            <button
                              type="button"
                              onClick={() => unapply.mutate(app.invoiceId)}
                              disabled={unapply.isPending}
                              aria-label={`Unapply credit memo from invoice ${app.invoiceNumber}`}
                              className={buttonVariants({ variant: 'outline', size: 'sm' })}
                            >
                              <Unlink className="size-3" />
                              Unapply
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                    {creditMemo.applications.length === 0 && (
                      <tr><td colSpan={4} className="type-cell py-8 text-center">Not applied to any invoices yet.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
              {unapply.error && (
                <p className="type-error">{apiErrorMessage(unapply.error, 'Failed to unapply credit memo.')}</p>
              )}
            </div>
          )}

          {activeTab === 'audit' && <CreditMemoAuditTab creditMemoId={id} />}
          {activeTab === 'files' && <FilesContent ref={null} recordId={id} readOnly={false} />}

          <div className="h-6" />
        </div>

        {/* Right sidebar */}
        <SalesDetailSidebar label="Credit Memo Details">
          {!isReadOnly && (
            <div className="rounded-xl border border-stone-200 bg-white shadow-sm p-4 space-y-3 mb-4">
              <p className="type-card-title">Quick Actions</p>
              <div className="space-y-0.5">
                <button
                  type="button"
                  onClick={() => navigate(`/sales/credit_memo/${id}/edit`, { state: { initialTab: 'files' } })}
                  className="flex items-center gap-2.5 hover:bg-stone-50 rounded-lg px-3 py-2 cursor-pointer text-button text-ink w-full transition-colors text-left"
                >
                  <Upload className="size-4 text-ink-faint shrink-0" />
                  Upload file
                </button>
                {isDraft && canUpdate && (
                  <button
                    type="button"
                    onClick={() => navigate(`/sales/credit_memo/${id}/edit`)}
                    className="flex items-center gap-2.5 hover:bg-stone-50 rounded-lg px-3 py-2 cursor-pointer text-button text-ink w-full transition-colors text-left"
                  >
                    <Pencil className="size-4 text-ink-faint shrink-0" />
                    Edit credit memo
                  </button>
                )}
                {canApply && (
                  <button
                    type="button"
                    onClick={() => setApplyOpen(true)}
                    disabled={creditMemo.unappliedAmount <= 0}
                    title={creditMemo.unappliedAmount <= 0 ? 'No unapplied balance remaining.' : undefined}
                    className="flex items-center gap-2.5 hover:bg-stone-50 rounded-lg px-3 py-2 cursor-pointer text-button text-ink w-full transition-colors text-left disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent"
                  >
                    <DollarSign className="size-4 text-ink-faint shrink-0" />
                    Apply Credit
                  </button>
                )}
                {canVoid && (
                  <VoidCreditMemoDialog
                    creditMemoId={id}
                    label={`Credit Memo ${creditMemo.creditMemoNumber}`}
                    onVoided={() => queryClient.invalidateQueries({ queryKey: ['creditMemo', id] })}
                  />
                )}
                <button
                  type="button"
                  onClick={handleExportPdf}
                  disabled={exportingPdf}
                  className="flex items-center gap-2.5 hover:bg-stone-50 rounded-lg px-3 py-2 cursor-pointer text-button text-ink w-full transition-colors text-left disabled:opacity-60 disabled:cursor-not-allowed"
                  aria-label="Export as PDF"
                >
                  {exportingPdf ? <Loader2 className="size-4 text-ink-faint shrink-0 animate-spin" /> : <FileDown className="size-4 text-ink-faint shrink-0" />}
                  {exportingPdf ? 'Exporting…' : 'Export PDF'}
                </button>
              </div>
              {exportPdfError && (
                <p role="alert" className="type-error">{exportPdfError}</p>
              )}
            </div>
          )}

          <div className="rounded-xl border border-stone-200 bg-white shadow-sm p-4 space-y-3 mb-4">
            <p className="type-card-title">Status</p>
            <div className="flex justify-between items-center py-2 border-b border-stone-100 text-xs">
              <span className="text-ink-muted">Status</span>
              <Badge color={color}>{creditMemo.status}</Badge>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-stone-100 text-xs">
              <span className="text-ink-muted">Customer</span>
              <CustomerLink id={creditMemo.customer.id} name={creditMemo.customer.name} className="text-ink truncate max-w-[140px] hover:text-accent-foreground hover:underline" />
            </div>
            <div className="flex justify-between items-center py-2 border-b border-stone-100 text-xs">
              <span className="text-ink-muted">Created</span>
              <span className="text-ink">{fmtDate(creditMemo.createdAt)}</span>
            </div>
            <div className="flex justify-between items-center py-2 text-xs">
              <span className="text-ink-muted">Updated</span>
              <span className="text-ink">{fmtDate(creditMemo.updatedAt)}</span>
            </div>
          </div>

          {isDraft && canDelete && (
            <DangerZoneCard>
              <DeleteCreditMemoDialog
                creditMemoId={id}
                label={`Credit Memo ${creditMemo.creditMemoNumber}`}
                onDeleted={() => {
                  queryClient.invalidateQueries({ queryKey: ['creditMemos'] });
                  navigate('/sales/credit_memo');
                }}
              />
            </DangerZoneCard>
          )}
        </SalesDetailSidebar>
      </div>

      {applyOpen && (
        <ApplyCreditMemoDialog
          creditMemoId={id}
          customer={creditMemo.customer}
          unappliedAmount={creditMemo.unappliedAmount}
          excludeIds={creditMemo.applications.map((a) => a.invoiceId)}
          currencyCode={currencyCodeFor(lookups, creditMemo.currencyId)}
          onClose={() => setApplyOpen(false)}
          onApplied={() => {
            setApplyOpen(false);
            queryClient.invalidateQueries({ queryKey: ['creditMemo', id] });
          }}
        />
      )}
    </div>
  );
}

function ReadonlyField({ label, value, full }: { label: string; value?: string; full?: boolean }) {
  return (
    <div className={cn('space-y-1', full && 'col-span-full')}>
      <label className={fieldLabelCls}>{label}</label>
      <div className={readonlyCls}>{value || <span className="text-ink-muted">—</span>}</div>
    </div>
  );
}

function AddressBlock({ addr }: { addr: { customerName?: string; attention?: string; addrLine1?: string; addrLine2?: string; suiteUnit?: string; city?: string; stateId?: number | null; countryId?: number | null; zip?: string; phone?: string; fax?: string; email?: string } }) {
  const lines = [
    addr.attention,
    [addr.addrLine1, addr.addrLine2].filter(Boolean).join(', '),
    [addr.suiteUnit, addr.city, addr.zip].filter(Boolean).join(', '),
    addr.phone && `Phone: ${addr.phone}`,
    addr.email && `Email: ${addr.email}`,
  ].filter(Boolean);

  if (lines.length === 0 && !addr.stateId && !addr.countryId) {
    return <p className="italic type-helper">No address on file.</p>;
  }
  return (
    <div className="space-y-1 text-xs text-ink">
      {addr.customerName && <p className="font-semibold text-ink-strong">{addr.customerName}</p>}
      {lines.map((line, i) => <p key={i} className="text-ink">{line}</p>)}
      <AddressGeoLine stateId={addr.stateId} countryId={addr.countryId} />
    </div>
  );
}
