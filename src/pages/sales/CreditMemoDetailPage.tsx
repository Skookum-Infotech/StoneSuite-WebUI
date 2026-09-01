import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { FileMinus, Upload, Pencil, DollarSign, Unlink, Loader2, FileDown } from 'lucide-react';
import { toast } from 'sonner';
import { creditMemoService } from '@/services/creditMemoService';
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
import { CREDIT_MEMO_STATUS_COLORS, CREDIT_MEMO_READONLY_STATUSES, CREDIT_MEMO_DRAFT_STATUS } from '@/lib/creditMemoForm';
import { CreditMemoAuditTab } from './components/CreditMemoAuditTab';
import { DeleteCreditMemoDialog } from './components/DeleteCreditMemoDialog';
import { VoidCreditMemoDialog } from './components/VoidCreditMemoDialog';
import { ApplyCreditMemoDialog } from './components/ApplyCreditMemoDialog';
import { SalesDetailSidebar } from './components/SalesDetailSidebar';
import type { CreditMemoApplication } from '@/types/creditMemo';

const TABS = [
  { key: 'overview', label: 'Overview' },
  { key: 'items', label: 'Items' },
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

  const unapply = useMutation({
    mutationFn: (invoiceId: string) => creditMemoService.unapply(id, invoiceId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['creditMemo', id] }),
  });

  if (isLoading) return <div className="p-6"><Spinner label="Loading credit memo…" /></div>;
  if (error || !creditMemo)
    return <div className="p-6"><ErrorNote>{apiErrorMessage(error, 'Failed to load credit memo.')}</ErrorNote></div>;

  const color = CREDIT_MEMO_STATUS_COLORS[creditMemo.status] ?? '#a8a29e';
  const isDraft = creditMemo.statusCode === CREDIT_MEMO_DRAFT_STATUS;
  const isReadOnly = CREDIT_MEMO_READONLY_STATUSES.has(creditMemo.statusCode);
  const canVoid = canTransition && (isDraft || creditMemo.statusCode === 'APPV');
  const canApply = canUpdate && creditMemo.statusCode === 'APPV';

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
        createdAt: creditMemo.createdAt,
        updatedAt: creditMemo.updatedAt,
        sections: [
          {
            title: 'Primary Information',
            rows: [
              ['Credit Memo Date', fmtDate(creditMemo.creditMemoDate)],
              ['Reference #', creditMemo.referenceNumber || ''],
              ['Reason', creditMemo.reason || ''],
              ['Invoice', creditMemo.invoice?.number || ''],
              ['Sales Order', creditMemo.salesOrder?.number || ''],
              ['Sales Tax %', `${creditMemo.salesTaxPercent}%`],
              ['Memo', creditMemo.memo || ''],
              ['Notes', creditMemo.notes || ''],
              ['Internal Notes', creditMemo.internalNotes || ''],
            ],
          },
          { title: 'Billing Address', rows: addressRows(creditMemo.billing ?? {}) },
        ],
        itemsTable: {
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
          numericFrom: 3,
        },
        totals: [
          { label: 'Subtotal', value: currency(creditMemo.subtotal) },
          { label: 'Discount', value: currency(creditMemo.discountTotal) },
          { label: 'Tax', value: currency(creditMemo.taxTotal) },
          { label: 'Adjustment', value: currency(creditMemo.adjustment) },
          { label: 'Grand Total', value: currency(creditMemo.grandTotal), bold: true },
          { label: 'Applied Total', value: currency(creditMemo.appliedTotal) },
          { label: 'Unapplied Amount', value: currency(creditMemo.unappliedAmount), bold: true },
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

      {creditMemo.gated && (
        <>
          <ApprovalBanner
            approverNames={creditMemo.approvers.filter((a) => !a.approved).map((a) => a.name)}
            canApprove={creditMemo.canApprove}
            isOverride={creditMemo.isOverride}
            requiredApprovals={creditMemo.requiredApprovals}
            approvedCount={creditMemo.approvedCount}
            callerAlreadyApproved={creditMemo.callerAlreadyApproved}
            onApprove={() => approve.mutate()}
            approving={approve.isPending}
          />
          {approve.isError && (
            <p role="alert" className="px-5 py-1.5 text-2xs text-destructive 3xl:px-12 4xl:px-16">
              {apiErrorMessage(approve.error, 'Failed to approve credit memo.')}
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
                  <ReadonlyField label="Credit Memo Date" value={fmtDate(creditMemo.creditMemoDate)} />
                  <ReadonlyField label="Reference #" value={creditMemo.referenceNumber} />
                  <ReadonlyField label="Reason" value={creditMemo.reason} />
                  <ReadonlyField label="Invoice" value={creditMemo.invoice?.number} />
                  <ReadonlyField label="Sales Order" value={creditMemo.salesOrder?.number} />
                  <ReadonlyField label="Sales Tax %" value={`${creditMemo.salesTaxPercent}%`} />
                  {creditMemo.memo && <ReadonlyField label="Memo" value={creditMemo.memo} full />}
                  {creditMemo.notes && <ReadonlyField label="Notes" value={creditMemo.notes} full />}
                  {creditMemo.internalNotes && <ReadonlyField label="Internal Notes" value={creditMemo.internalNotes} full />}
                </div>
              </ModernSection>
              <ModernSection title="Billing Address" index={1}>
                <AddressBlock addr={creditMemo.billing ?? {}} />
              </ModernSection>
              <div className="rounded-lg border border-stone-200 bg-white p-4">
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
                  <Total label="Subtotal" value={creditMemo.subtotal} />
                  <Total label="Discount" value={creditMemo.discountTotal} />
                  <Total label="Tax" value={creditMemo.taxTotal} />
                  <Total label="Adjustment" value={creditMemo.adjustment} />
                  <Total label="Grand Total" value={creditMemo.grandTotal} bold />
                  <Total label="Applied Total" value={creditMemo.appliedTotal} />
                  <Total label="Unapplied Amount" value={creditMemo.unappliedAmount} bold />
                </div>
              </div>
            </>
          )}

          {activeTab === 'items' && (
            <div className="overflow-x-auto modal-scrollbar rounded-lg border border-stone-200 bg-white">
              <table className="w-full text-left text-xs">
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
                      <th key={h.label} className={cn('px-3 py-2.5 text-2xs font-semibold uppercase tracking-wide text-stone-500 whitespace-nowrap', h.right && 'text-right')}>{h.label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {creditMemo.lines.map((line) => (
                    <tr key={line.id} className="hover:bg-stone-50/50 divide-x divide-stone-100">
                      <td className="px-3 py-2.5 text-stone-400 tabular-nums">{line.lineNumber}</td>
                      <td className="px-3 py-2.5 font-medium text-stone-800">
                        {line.itemName || line.description || <span className="text-stone-300">—</span>}
                      </td>
                      <td className="px-3 py-2.5 font-mono text-2xs text-stone-500">{line.sku || '—'}</td>
                      <td className="px-3 py-2.5 tabular-nums text-right text-stone-600">{line.quantity}</td>
                      <td className="px-3 py-2.5 tabular-nums text-right text-stone-600">{currency(line.unitPrice)}</td>
                      <td className="px-3 py-2.5 tabular-nums text-right text-stone-500">{line.discountPercent}%</td>
                      <td className="px-3 py-2.5 tabular-nums text-right text-stone-500">{line.taxPercent}%</td>
                      <td className="px-3 py-2.5 tabular-nums text-right text-stone-800 font-semibold">{currency(line.lineTotal)}</td>
                    </tr>
                  ))}
                  {creditMemo.lines.length === 0 && (
                    <tr><td colSpan={8} className="py-8 text-center text-stone-400">No line items.</td></tr>
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
                    className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-3 py-1.5 text-xs font-semibold text-stone-900 hover:bg-brand-hover disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                  >
                    <DollarSign className="size-3.5" />
                    Apply Credit
                  </button>
                </div>
              )}

              <div className="overflow-x-auto modal-scrollbar rounded-lg border border-stone-200 bg-white">
                <table className="w-full text-left text-xs">
                  <thead className="bg-stone-50 border-b border-stone-200">
                    <tr className="divide-x divide-stone-200">
                      {['Invoice', 'Amount', 'Date', ''].map((h) => (
                        <th key={h} className="px-3 py-2.5 text-2xs font-semibold uppercase tracking-wide text-stone-500 whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100">
                    {creditMemo.applications.map((app: CreditMemoApplication) => (
                      <tr key={app.id} className="hover:bg-stone-50/50 divide-x divide-stone-100">
                        <td className="px-3 py-2.5 font-medium text-stone-800">
                          <button type="button" onClick={() => navigate(`/sales/invoice/${app.invoiceId}`)} className="hover:text-accent-foreground transition-colors">
                            {app.invoiceNumber || '—'}
                          </button>
                        </td>
                        <td className="px-3 py-2.5 tabular-nums text-stone-700">{currency(app.amount)}</td>
                        <td className="px-3 py-2.5 tabular-nums text-stone-400">{fmtDate(app.createdAt)}</td>
                        <td className="px-3 py-2.5 text-right">
                          {canApply && (
                            <button
                              type="button"
                              onClick={() => unapply.mutate(app.invoiceId)}
                              disabled={unapply.isPending}
                              aria-label={`Unapply credit memo from invoice ${app.invoiceNumber}`}
                              className="inline-flex items-center gap-1 rounded-lg border border-stone-200 bg-white px-2 py-1 text-2xs font-medium text-stone-500 hover:bg-stone-50 disabled:opacity-40 transition-colors"
                            >
                              <Unlink className="size-3" />
                              Unapply
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                    {creditMemo.applications.length === 0 && (
                      <tr><td colSpan={4} className="py-8 text-center text-stone-400">Not applied to any invoices yet.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
              {unapply.error && (
                <p className="text-xs text-destructive">{apiErrorMessage(unapply.error, 'Failed to unapply credit memo.')}</p>
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
              <p className="text-xs font-semibold text-stone-400">Quick Actions</p>
              <div className="space-y-0.5">
                <button
                  type="button"
                  onClick={() => navigate(`/sales/credit_memo/${id}/edit`, { state: { initialTab: 'files' } })}
                  className="flex items-center gap-2.5 hover:bg-stone-50 rounded-lg px-3 py-2 cursor-pointer text-xs text-stone-700 w-full transition-colors text-left"
                >
                  <Upload className="size-4 text-stone-400 shrink-0" />
                  Upload file
                </button>
                {isDraft && canUpdate && (
                  <button
                    type="button"
                    onClick={() => navigate(`/sales/credit_memo/${id}/edit`)}
                    className="flex items-center gap-2.5 hover:bg-stone-50 rounded-lg px-3 py-2 cursor-pointer text-xs text-stone-700 w-full transition-colors text-left"
                  >
                    <Pencil className="size-4 text-stone-400 shrink-0" />
                    Edit credit memo
                  </button>
                )}
                {canApply && (
                  <button
                    type="button"
                    onClick={() => setApplyOpen(true)}
                    disabled={creditMemo.unappliedAmount <= 0}
                    title={creditMemo.unappliedAmount <= 0 ? 'No unapplied balance remaining.' : undefined}
                    className="flex items-center gap-2.5 hover:bg-stone-50 rounded-lg px-3 py-2 cursor-pointer text-xs text-stone-700 w-full transition-colors text-left disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent"
                  >
                    <DollarSign className="size-4 text-stone-400 shrink-0" />
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
          )}

          <div className="rounded-xl border border-stone-200 bg-white shadow-sm p-4 space-y-3 mb-4">
            <p className="text-xs font-semibold text-stone-400">Status</p>
            <div className="flex justify-between items-center py-2 border-b border-stone-100 text-xs">
              <span className="text-stone-500">Status</span>
              <Badge color={color}>{creditMemo.status}</Badge>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-stone-100 text-xs">
              <span className="text-stone-500">Customer</span>
              <span className="text-stone-700 truncate max-w-[140px]">{creditMemo.customer.name}</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-stone-100 text-xs">
              <span className="text-stone-500">Created</span>
              <span className="text-stone-700">{fmtDate(creditMemo.createdAt)}</span>
            </div>
            <div className="flex justify-between items-center py-2 text-xs">
              <span className="text-stone-500">Updated</span>
              <span className="text-stone-700">{fmtDate(creditMemo.updatedAt)}</span>
            </div>
          </div>

          {isDraft && canDelete && (
            <div className="rounded-xl border border-stone-200 bg-white shadow-sm p-4 space-y-3 mb-4">
              <p className="text-xs font-semibold text-red-400">Danger Zone</p>
              <DeleteCreditMemoDialog
                creditMemoId={id}
                label={`Credit Memo ${creditMemo.creditMemoNumber}`}
                onDeleted={() => {
                  queryClient.invalidateQueries({ queryKey: ['creditMemos'] });
                  navigate('/sales/credit_memo');
                }}
              />
            </div>
          )}
        </SalesDetailSidebar>
      </div>

      {applyOpen && (
        <ApplyCreditMemoDialog
          creditMemoId={id}
          customer={creditMemo.customer}
          unappliedAmount={creditMemo.unappliedAmount}
          excludeIds={creditMemo.applications.map((a) => a.invoiceId)}
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
      <div className={readonlyCls}>{value || <span className="text-stone-400">—</span>}</div>
    </div>
  );
}

function addressRows(addr: { customerName?: string; attention?: string; addrLine1?: string; addrLine2?: string; suiteUnit?: string; city?: string; zip?: string; phone?: string; fax?: string; email?: string }): Array<[string, string]> {
  return [
    ['Name', addr.customerName || ''],
    ['Attention', addr.attention || ''],
    ['Address', [addr.addrLine1, addr.addrLine2].filter(Boolean).join(', ')],
    ['City/Zip', [addr.suiteUnit, addr.city, addr.zip].filter(Boolean).join(', ')],
    ['Phone', addr.phone || ''],
    ['Email', addr.email || ''],
  ];
}

function AddressBlock({ addr }: { addr: { customerName?: string; attention?: string; addrLine1?: string; addrLine2?: string; suiteUnit?: string; city?: string; zip?: string; phone?: string; fax?: string; email?: string } }) {
  const lines = [
    addr.attention,
    [addr.addrLine1, addr.addrLine2].filter(Boolean).join(', '),
    [addr.suiteUnit, addr.city, addr.zip].filter(Boolean).join(', '),
    addr.phone && `Phone: ${addr.phone}`,
    addr.email && `Email: ${addr.email}`,
  ].filter(Boolean);

  if (lines.length === 0) {
    return <p className="text-xs text-stone-400 italic">No address on file.</p>;
  }
  return (
    <div className="space-y-1 text-xs text-stone-700">
      {addr.customerName && <p className="font-semibold text-stone-900">{addr.customerName}</p>}
      {lines.map((line, i) => <p key={i} className="text-stone-600">{line}</p>)}
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
