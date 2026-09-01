import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { FileCheck, Upload, Pencil, FileDown, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { vendorBillService } from '@/services/vendorBillService';
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
import { VB_STATUS_COLORS, VB_STATUS_CODES, VB_ALLOWED_TRANSITIONS, VB_DELETABLE_STATUSES } from '@/lib/vendorBillForm';
import { statusToastLabel } from '@/lib/statusToast';
import { VendorBillAuditTab } from './components/VendorBillAuditTab';
import { BillPaymentsTab } from './components/BillPaymentsTab';
import { DeleteVendorBillDialog } from './components/DeleteVendorBillDialog';
import { VendorBillTransitionBar } from './components/VendorBillTransitionBar';
import { SalesDetailSidebar } from '@/pages/sales/components/SalesDetailSidebar';

const TABS = [
  { key: 'overview', label: 'Overview' },
  { key: 'items', label: 'Items' },
  { key: 'payments', label: 'Payments' },
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
  return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

function currency(n: number | undefined): string {
  return (n ?? 0).toLocaleString(undefined, { style: 'currency', currency: 'USD' });
}

export default function VendorBillDetailPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [exportingPdf, setExportingPdf] = useState(false);
  const [exportPdfError, setExportPdfError] = useState<string>();

  const { hasPermission, isLoading: permissionsLoading } = useUserPermissions();
  const canEdit = permissionsLoading || hasPermission('vendor_bill', 'update');
  const canDelete = permissionsLoading || hasPermission('vendor_bill', 'delete');
  const canTransition = permissionsLoading || hasPermission('vendor_bill', 'transition');

  const { data: bill, isLoading, error } = useQuery({
    queryKey: ['vendor-bill', id],
    queryFn: () => vendorBillService.getVendorBill(id),
    enabled: Boolean(id),
    refetchInterval: DETAIL_POLL_MS,
  });

  const setLabel = useBreadcrumbStore((s) => s.setLabel);
  const clearLabel = useBreadcrumbStore((s) => s.clearLabel);
  useEffect(() => {
    if (bill?.vendorBillNumber) {
      setLabel(id, bill.vendorBillNumber);
      return () => clearLabel(id);
    }
  }, [id, bill?.vendorBillNumber, setLabel, clearLabel]);

  const transition = useMutation({
    mutationFn: (toStatusCode: string) => vendorBillService.transition(id, toStatusCode),
    onSuccess: (updated, toStatusCode) => {
      queryClient.setQueryData(['vendor-bill', id], updated);
      queryClient.invalidateQueries({ queryKey: ['vendor-bills'] });
      toast.success(`Moved to ${statusToastLabel(VB_STATUS_CODES, toStatusCode)}.`);
    },
  });

  const approve = useMutation({
    mutationFn: () => vendorBillService.approve(id),
    onSuccess: (updated) => {
      queryClient.setQueryData(['vendor-bill', id], updated);
      queryClient.invalidateQueries({ queryKey: ['vendor-bills'] });
      toast.success('Approved.');
    },
  });

  if (isLoading) return <div className="p-6"><Spinner label="Loading vendor bill…" /></div>;
  if (!bill)
    return <div className="p-6"><ErrorNote>{apiErrorMessage(error, 'Failed to load vendor bill.')}</ErrorNote></div>;

  const color = VB_STATUS_COLORS[bill.statusCode] ?? '#a8a29e';
  // The bill API doesn't expose a credit_total field directly — it's derived
  // here as the gap between grandTotal - amountPaid and the server's own
  // balanceDue, which vendorbill.BalanceDue() computes as
  // grand_total - amount_paid - credit_total. Floored at 0 defensively; it
  // should never go negative in practice.
  const creditsApplied = Math.max(0, bill.grandTotal - bill.amountPaid - bill.balanceDue);
  const canDeleteHere = canDelete && VB_DELETABLE_STATUSES.has(bill.statusCode);
  // Terminal statuses (PAID/VOID) have no legal transitions, and a user
  // without `vendor_bill:transition` sees none either — in both cases the
  // bar renders nothing, so the card would be an empty "Actions" header.
  // Hide it unless it has real content (mirrors PurchaseOrderDetailPage).
  const hasTransitions = canTransition && (VB_ALLOWED_TRANSITIONS[bill.statusCode]?.length ?? 0) > 0;
  const showActions = hasTransitions || Boolean(transition.error);

  async function handleExportPdf() {
    if (!bill) return;
    setExportPdfError(undefined);
    setExportingPdf(true);
    try {
      const { exportPurchasesRecordToPdf } = await import('@/lib/purchasesPdfExport');
      await exportPurchasesRecordToPdf({
        recordType: 'vendor_bill',
        title: bill.vendorBillNumber || 'Vendor Bill',
        recordNumber: bill.vendorBillNumber,
        statusLabel: bill.status,
        counterpartyName: bill.vendor.name,
        createdAt: bill.createdAt,
        updatedAt: bill.updatedAt,
        sections: [
          {
            title: 'Primary Information',
            rows: [
              ["Vendor's Invoice #", bill.vendorInvoiceNumber || ''],
              ['Reference #', bill.referenceNumber || ''],
              ['Bill Date', fmtDate(bill.billDate)],
              ['Due Date', bill.dueDate ? fmtDate(bill.dueDate) : ''],
              ['Sales Tax %', `${bill.salesTaxPercent}%`],
              ['Purchase Order', bill.purchaseOrder?.number || ''],
              ['Memo', bill.memo || ''],
              ['Notes', bill.notes || ''],
              ['Terms & Conditions', bill.termsConditions || ''],
            ],
          },
        ],
        itemsTable: {
          head: ['#', 'Item', 'SKU', 'Qty', 'Unit Price', 'Disc %', 'Tax %', 'Total'],
          rows: bill.items.map((line) => [
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
          { label: 'Subtotal', value: currency(bill.subtotal) },
          { label: 'Discount', value: currency(bill.discountTotal) },
          { label: 'Tax', value: currency(bill.taxTotal) },
          { label: 'Adjustment', value: currency(bill.adjustment) },
          { label: 'Grand Total', value: currency(bill.grandTotal), bold: true },
          { label: 'Amount Paid', value: currency(bill.amountPaid) },
          { label: 'Credits Applied', value: currency(creditsApplied) },
          { label: 'Balance Due', value: currency(bill.balanceDue), bold: true },
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
        backLabel="Vendor Bills"
        onBack={() => navigate('/purchases/vendor_bill')}
        icon={FileCheck}
        title={bill.vendorBillNumber || 'Vendor Bill'}
        subtitle={bill.vendor.name}
        recordNumber={bill.vendorBillNumber}
        statusBadge={<Badge color={color}>{bill.status}</Badge>}
      />

      {bill.gated && (
        <>
          <ApprovalBanner
            approverNames={bill.approvers.filter((a) => !a.approved).map((a) => a.name)}
            canApprove={bill.canApprove}
            isOverride={bill.isOverride}
            requiredApprovals={bill.requiredApprovals}
            approvedCount={bill.approvedCount}
            callerAlreadyApproved={bill.callerAlreadyApproved}
            onApprove={() => approve.mutate()}
            approving={approve.isPending}
          />
          {approve.isError && (
            <p role="alert" className="px-5 py-1.5 text-2xs text-destructive 3xl:px-12 4xl:px-16">
              {apiErrorMessage(approve.error, 'Failed to approve vendor bill.')}
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
                  <ReadonlyField label="Vendor's Invoice #" value={bill.vendorInvoiceNumber} />
                  <ReadonlyField label="Reference #" value={bill.referenceNumber} />
                  <ReadonlyField label="Bill Date" value={fmtDate(bill.billDate)} />
                  <ReadonlyField label="Due Date" value={bill.dueDate ? fmtDate(bill.dueDate) : undefined} />
                  <ReadonlyField label="Sales Tax %" value={`${bill.salesTaxPercent}%`} />
                  {bill.purchaseOrder && (
                    <div className="space-y-1">
                      <label className={fieldLabelCls}>Purchase Order</label>
                      <button
                        type="button"
                        onClick={() => navigate(`/purchases/purchase_order/${bill.purchaseOrder!.id}`)}
                        className={cn(readonlyCls, 'text-left text-accent-foreground hover:underline cursor-pointer')}
                      >
                        {bill.purchaseOrder.number}
                      </button>
                    </div>
                  )}
                  {bill.memo && <ReadonlyField label="Memo" value={bill.memo} full />}
                  {bill.notes && <ReadonlyField label="Notes" value={bill.notes} full />}
                  {bill.internalNotes && <ReadonlyField label="Internal Notes" value={bill.internalNotes} full />}
                  {bill.termsConditions && <ReadonlyField label="Terms & Conditions" value={bill.termsConditions} full />}
                </div>
              </ModernSection>
              <div className="rounded-lg border border-stone-200 bg-white p-4">
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-8">
                  <Total label="Subtotal" value={bill.subtotal} />
                  <Total label="Discount" value={bill.discountTotal} />
                  <Total label="Tax" value={bill.taxTotal} />
                  <Total label="Adjustment" value={bill.adjustment} />
                  <Total label="Grand Total" value={bill.grandTotal} bold />
                  <Total label="Amount Paid" value={bill.amountPaid} />
                  <Total label="Credits Applied" value={creditsApplied} />
                  <Total label="Balance Due" value={bill.balanceDue} bold />
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
                      { label: 'Description' },
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
                  {bill.items.map((line) => (
                    <tr key={line.id} className="hover:bg-stone-50/50 divide-x divide-stone-100">
                      <td className="px-3 py-2.5 text-stone-400 tabular-nums">{line.lineNumber}</td>
                      <td className="px-3 py-2.5 font-medium text-stone-800">
                        {line.itemName || line.description || <span className="text-stone-300">—</span>}
                      </td>
                      <td className="px-3 py-2.5 text-stone-500 max-w-[200px] truncate">{line.description || '—'}</td>
                      <td className="px-3 py-2.5 font-mono text-2xs text-stone-500">{line.sku || '—'}</td>
                      <td className="px-3 py-2.5 tabular-nums text-right text-stone-600">{line.quantity}</td>
                      <td className="px-3 py-2.5 tabular-nums text-right text-stone-600">{currency(line.unitPrice)}</td>
                      <td className="px-3 py-2.5 tabular-nums text-right text-stone-500">{line.discountPercent}%</td>
                      <td className="px-3 py-2.5 tabular-nums text-right text-stone-500">{line.taxPercent}%</td>
                      <td className="px-3 py-2.5 tabular-nums text-right text-stone-800 font-semibold">{currency(line.lineTotal)}</td>
                    </tr>
                  ))}
                  {bill.items.length === 0 && (
                    <tr><td colSpan={9} className="py-8 text-center text-stone-400">No line items.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {activeTab === 'payments' && (
            <BillPaymentsTab vendorBillId={id} balanceDue={bill.balanceDue} />
          )}
          {activeTab === 'audit' && <VendorBillAuditTab vendorBillId={id} />}
          {activeTab === 'files' && <FilesContent ref={null} recordId={id} readOnly={false} />}

          <div className="h-6" />
        </div>

        {/* Right sidebar */}
        <SalesDetailSidebar label="Vendor Bill Details">
          <div className="rounded-xl border border-stone-200 bg-white shadow-sm p-4 space-y-3 mb-4">
            <p className="text-xs font-semibold text-stone-400">Quick Actions</p>
            <div className="space-y-0.5">
              <button
                type="button"
                onClick={() => navigate(`/purchases/vendor_bill/${id}/edit`, { state: { initialTab: 'files' } })}
                className="flex items-center gap-2.5 hover:bg-stone-50 rounded-lg px-3 py-2 cursor-pointer text-xs text-stone-700 w-full transition-colors text-left"
              >
                <Upload className="size-4 text-stone-400 shrink-0" />
                Upload file
              </button>
              {canEdit && bill.statusCode === 'DRFT' && (
                <button
                  type="button"
                  onClick={() => navigate(`/purchases/vendor_bill/${id}/edit`)}
                  className="flex items-center gap-2.5 hover:bg-stone-50 rounded-lg px-3 py-2 cursor-pointer text-xs text-stone-700 w-full transition-colors text-left"
                >
                  <Pencil className="size-4 text-stone-400 shrink-0" />
                  Edit vendor bill
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
              <VendorBillTransitionBar
                statusCode={bill.statusCode}
                approvalStatus={bill.approvalStatus}
                gated={bill.gated}
                onTransition={(toCode) => transition.mutate(toCode)}
                isPending={transition.isPending}
              />
              {transition.error && (
                <p role="alert" className="text-2xs text-destructive">{apiErrorMessage(transition.error, 'Failed to change status.')}</p>
              )}
            </div>
          )}

          <div className="rounded-xl border border-stone-200 bg-white shadow-sm p-4 space-y-3 mb-4">
            <p className="text-xs font-semibold text-stone-400">Status</p>
            <div className="flex justify-between items-center py-2 border-b border-stone-100 text-xs">
              <span className="text-stone-500">Status</span>
              <Badge color={color}>{bill.status}</Badge>
            </div>
            {bill.approvalStatus && bill.approvalStatus !== 'none' && (
              <div className="flex justify-between items-center py-2 border-b border-stone-100 text-xs">
                <span className="text-stone-500">Approval</span>
                <span className={cn('font-medium', bill.approvalStatus === 'approved' ? 'text-emerald-600' : 'text-amber-600')}>
                  {bill.approvalStatus === 'approved' ? 'Approved' : 'Pending Approval'}
                </span>
              </div>
            )}
            <div className="flex justify-between items-center py-2 border-b border-stone-100 text-xs">
              <span className="text-stone-500">Vendor</span>
              <button
                type="button"
                onClick={() => navigate(`/purchases/vendor/${bill.vendor.id}`)}
                className="text-stone-700 hover:text-accent-foreground truncate max-w-[140px] transition-colors"
              >
                {bill.vendor.name}
              </button>
            </div>
            {bill.purchaseOrder && (
              <div className="flex justify-between items-center py-2 border-b border-stone-100 text-xs">
                <span className="text-stone-500">Purchase Order</span>
                <button
                  type="button"
                  onClick={() => navigate(`/purchases/purchase_order/${bill.purchaseOrder!.id}`)}
                  className="text-stone-700 hover:text-accent-foreground truncate max-w-[140px] transition-colors"
                >
                  {bill.purchaseOrder.number}
                </button>
              </div>
            )}
            <div className="flex justify-between items-center py-2 border-b border-stone-100 text-xs">
              <span className="text-stone-500">Created</span>
              <span className="text-stone-700">{fmtDate(bill.createdAt)}</span>
            </div>
            <div className="flex justify-between items-center py-2 text-xs">
              <span className="text-stone-500">Updated</span>
              <span className="text-stone-700">{fmtDate(bill.updatedAt)}</span>
            </div>
          </div>

          {canDeleteHere && (
            <div className="rounded-xl border border-stone-200 bg-white shadow-sm p-4 space-y-3 mb-4">
              <p className="text-xs font-semibold text-red-400">Danger Zone</p>
              <DeleteVendorBillDialog
                vendorBillId={id}
                label={`Vendor Bill ${bill.vendorBillNumber}`}
                onDeleted={() => {
                  queryClient.invalidateQueries({ queryKey: ['vendor-bills'] });
                  navigate('/purchases/vendor_bill');
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
