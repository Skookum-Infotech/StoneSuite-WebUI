import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { Receipt, Upload, Pencil, FileDown, Loader2 } from 'lucide-react';
import { invoiceService } from '@/services/invoiceService';
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
import { INVOICE_STATUS_COLORS } from '@/lib/invoiceForm';
import { InvoiceAuditTab } from './components/InvoiceAuditTab';
import { DeleteInvoiceDialog } from './components/DeleteInvoiceDialog';
import { RecordPaymentDialog } from './components/RecordPaymentDialog';
import { SalesDetailSidebar } from './components/SalesDetailSidebar';
import { InvoiceStatusControl } from './components/InvoiceStatusControl';

const TABS = [
  { key: 'overview', label: 'Overview' },
  { key: 'items', label: 'Items' },
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

export default function InvoiceDetailPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [exportingPdf, setExportingPdf] = useState(false);
  const [exportPdfError, setExportPdfError] = useState<string>();

  const { hasPermission, isLoading: permissionsLoading } = useUserPermissions();
  const canEdit = permissionsLoading || hasPermission('invoice', 'update');
  const canDelete = permissionsLoading || hasPermission('invoice', 'delete');

  const { data: invoice, isLoading, error } = useQuery({
    queryKey: ['invoice', id],
    queryFn: () => invoiceService.getInvoice(id),
    enabled: Boolean(id),
  });

  const setLabel = useBreadcrumbStore((s) => s.setLabel);
  const clearLabel = useBreadcrumbStore((s) => s.clearLabel);
  useEffect(() => {
    if (invoice?.invoiceNumber) {
      setLabel(id, invoice.invoiceNumber);
      return () => clearLabel(id);
    }
  }, [id, invoice?.invoiceNumber, setLabel, clearLabel]);

  // Inline status change from the sidebar's Status row — mirrors the Edit
  // page's transition mutation.
  const transition = useMutation({
    mutationFn: (toStatusCode: string) => invoiceService.transition(id, toStatusCode),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoice', id] });
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
    },
  });

  const approve = useMutation({
    mutationFn: () => invoiceService.approve(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoice', id] });
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
    },
  });

  if (isLoading) return <div className="p-6"><Spinner label="Loading invoice…" /></div>;
  if (error || !invoice)
    return <div className="p-6"><ErrorNote>{apiErrorMessage(error, 'Failed to load invoice.')}</ErrorNote></div>;

  const color = INVOICE_STATUS_COLORS[invoice.status] ?? '#a8a29e';

  async function handleExportPdf() {
    if (!invoice) return;
    setExportPdfError(undefined);
    setExportingPdf(true);
    try {
      const { exportSalesDocToPdf } = await import('@/lib/salesPdfExport');
      await exportSalesDocToPdf({
        docType: 'invoice',
        title: invoice.invoiceNumber || 'Invoice',
        recordNumber: invoice.invoiceNumber,
        statusLabel: invoice.status,
        customerName: invoice.customer.name,
        createdAt: invoice.createdAt,
        updatedAt: invoice.updatedAt,
        sections: [
          {
            title: 'Primary Information',
            rows: [
              ['Invoice Date', fmtDate(invoice.invoiceDate)],
              ['Due Date', invoice.dueDate ? fmtDate(invoice.dueDate) : ''],
              ['PO Number', invoice.poNumber || ''],
              ['Reference #', invoice.referenceNumber || ''],
              ['Sales Tax %', `${invoice.salesTaxPercent}%`],
              ['Memo', invoice.memo || ''],
            ],
          },
          { title: 'Bill To', rows: addressRows(invoice.billing) },
          { title: 'Ship To', rows: invoice.shipSameAsBilling ? [] : addressRows(invoice.shipping) },
        ],
        itemsTable: {
          head: ['#', 'Item', 'SKU', 'Qty', 'Unit Price', 'Disc %', 'Tax %', 'Total'],
          rows: invoice.items.map((line) => [
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
          { label: 'Subtotal', value: currency(invoice.subtotal) },
          { label: 'Discount', value: currency(invoice.discountTotal) },
          { label: 'Tax', value: currency(invoice.taxTotal) },
          { label: 'Grand Total', value: currency(invoice.grandTotal), bold: true },
          { label: 'Amount Paid', value: currency(invoice.amountPaid) },
          { label: 'Balance Due', value: currency(invoice.balanceDue), bold: true },
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
        backLabel="Invoices"
        onBack={() => navigate('/sales/invoice')}
        icon={Receipt}
        title={invoice.invoiceNumber || 'Invoice'}
        subtitle={invoice.customer.name}
        recordNumber={invoice.invoiceNumber}
        statusBadge={<Badge color={color}>{invoice.status}</Badge>}
      />

      {invoice.gated && (
        <>
          <ApprovalBanner
            approverNames={invoice.approvers.filter((a) => !a.approved).map((a) => a.name)}
            canApprove={invoice.canApprove}
            isOverride={invoice.isOverride}
            requiredApprovals={invoice.requiredApprovals}
            approvedCount={invoice.approvedCount}
            callerAlreadyApproved={invoice.callerAlreadyApproved}
            onApprove={() => approve.mutate()}
            approving={approve.isPending}
          />
          {approve.isError && (
            <p role="alert" className="px-5 py-1.5 text-2xs text-destructive 3xl:px-12 4xl:px-16">
              {apiErrorMessage(approve.error, 'Failed to approve invoice.')}
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
                  <ReadonlyField label="Invoice Date" value={fmtDate(invoice.invoiceDate)} />
                  <ReadonlyField label="Due Date" value={invoice.dueDate ? fmtDate(invoice.dueDate) : undefined} />
                  <ReadonlyField label="PO Number" value={invoice.poNumber} />
                  <ReadonlyField label="Reference #" value={invoice.referenceNumber} />
                  <ReadonlyField label="Sales Tax %" value={`${invoice.salesTaxPercent}%`} />
                  {invoice.memo && <ReadonlyField label="Memo" value={invoice.memo} full />}
                </div>
              </ModernSection>
              <ModernSection title="Bill To" index={1}>
                <AddressBlock addr={invoice.billing} />
              </ModernSection>
              <ModernSection title="Ship To" index={2}>
                {invoice.shipSameAsBilling ? (
                  <p className="text-xs text-stone-400 italic">Same as billing customer.</p>
                ) : (
                  <AddressBlock addr={invoice.shipping} />
                )}
              </ModernSection>
              <div className="rounded-lg border border-stone-200 bg-white p-4">
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
                  <Total label="Subtotal" value={invoice.subtotal} />
                  <Total label="Discount" value={invoice.discountTotal} />
                  <Total label="Tax" value={invoice.taxTotal} />
                  <Total label="Grand Total" value={invoice.grandTotal} bold />
                  <Total label="Amount Paid" value={invoice.amountPaid} />
                  <Total label="Balance Due" value={invoice.balanceDue} bold />
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
                  {invoice.items.map((line) => (
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
                  {invoice.items.length === 0 && (
                    <tr><td colSpan={8} className="py-8 text-center text-stone-400">No line items.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {activeTab === 'audit' && <InvoiceAuditTab invoiceId={id} />}
          {activeTab === 'files' && <FilesContent ref={null} recordId={id} readOnly={false} />}

          <div className="h-6" />
        </div>

        {/* Right sidebar */}
        <SalesDetailSidebar label="Invoice Details">
          <div className="rounded-xl border border-stone-200 bg-white shadow-sm p-4 space-y-3 mb-4">
            <p className="text-xs font-semibold text-stone-400">Quick Actions</p>
            <div className="space-y-0.5">
              <button
                type="button"
                onClick={() => navigate(`/sales/invoice/${id}/edit`, { state: { initialTab: 'files' } })}
                className="flex items-center gap-2.5 hover:bg-stone-50 rounded-lg px-3 py-2 cursor-pointer text-xs text-stone-700 w-full transition-colors text-left"
              >
                <Upload className="size-4 text-stone-400 shrink-0" />
                Upload file
              </button>
              {canEdit && (
                <button
                  type="button"
                  onClick={() => navigate(`/sales/invoice/${id}/edit`)}
                  className="flex items-center gap-2.5 hover:bg-stone-50 rounded-lg px-3 py-2 cursor-pointer text-xs text-stone-700 w-full transition-colors text-left"
                >
                  <Pencil className="size-4 text-stone-400 shrink-0" />
                  Edit invoice
                </button>
              )}
              {canEdit && (
                <RecordPaymentDialog
                  invoiceId={id}
                  statusCode={invoice.statusCode}
                  balanceDue={invoice.balanceDue}
                  onRecorded={() => queryClient.invalidateQueries({ queryKey: ['invoice', id] })}
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

          <div className="rounded-xl border border-stone-200 bg-white shadow-sm p-4 space-y-3 mb-4">
            <p className="text-xs font-semibold text-stone-400">Status</p>
            <div className="flex justify-between items-center py-2 border-b border-stone-100 text-xs">
              <span className="text-stone-500">Status</span>
              <InvoiceStatusControl
                invoice={invoice}
                onChange={(code) => transition.mutate(code)}
                disabled={transition.isPending}
                variant="pill"
              />
            </div>
            <div className="flex justify-between items-center py-2 border-b border-stone-100 text-xs">
              <span className="text-stone-500">Customer</span>
              <span className="text-stone-700 truncate max-w-[140px]">{invoice.customer.name}</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-stone-100 text-xs">
              <span className="text-stone-500">Created</span>
              <span className="text-stone-700">{fmtDate(invoice.createdAt)}</span>
            </div>
            <div className="flex justify-between items-center py-2 text-xs">
              <span className="text-stone-500">Updated</span>
              <span className="text-stone-700">{fmtDate(invoice.updatedAt)}</span>
            </div>
          </div>

          {canDelete && (
            <div className="rounded-xl border border-stone-200 bg-white shadow-sm p-4 space-y-3 mb-4">
              <p className="text-xs font-semibold text-red-400">Danger Zone</p>
              <DeleteInvoiceDialog
                invoiceId={id}
                label={`Invoice ${invoice.invoiceNumber}`}
                onDeleted={() => {
                  queryClient.invalidateQueries({ queryKey: ['invoices'] });
                  navigate('/sales/invoice');
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
