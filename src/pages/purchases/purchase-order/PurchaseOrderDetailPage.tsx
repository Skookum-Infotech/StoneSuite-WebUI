import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { Package, Upload, Pencil, PackagePlus, FileDown, Loader2 } from 'lucide-react';
import { purchaseOrderService } from '@/services/purchaseOrderService';
import { apiErrorMessage } from '@/api/tenantClient';
import { Spinner, ErrorNote, Badge } from '@/components/tenant/ui';
import { ModernSection } from '@/components/crm/FormPrimitives';
import { readonlyCls, fieldLabelCls } from '@/components/crm/formUtils';
import { FilesContent } from '@/components/crm/CrmSubTabsPanel';
import { CrmPageHeader } from '@/pages/crm/components/CrmPageHeader';
import { useBreadcrumbStore } from '@/store/useBreadcrumbStore';
import { useUserPermissions } from '@/hooks/useUserPermissions';
import { cn } from '@/lib/utils';
import { PO_STATUS_COLORS, PO_DELETABLE_STATUSES, PO_ALLOWED_TRANSITIONS } from '@/lib/purchaseOrderForm';
import { isPurchaseOrderReceivable } from '@/lib/itemReceiptForm';
import { PurchaseOrderAuditTab } from './components/PurchaseOrderAuditTab';
import { PurchaseOrderReceiptsTab } from './components/PurchaseOrderReceiptsTab';
import { DeletePurchaseOrderDialog } from './components/DeletePurchaseOrderDialog';
import { PurchaseOrderTransitionBar } from './components/PurchaseOrderTransitionBar';
import { PurchaseOrderApprovalButton } from './components/PurchaseOrderApprovalButton';
import { SalesDetailSidebar } from '@/pages/sales/components/SalesDetailSidebar';

const TABS = [
  { key: 'overview', label: 'Overview' },
  { key: 'items', label: 'Items' },
  { key: 'receipts', label: 'Receipts' },
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

export default function PurchaseOrderDetailPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [exportingPdf, setExportingPdf] = useState(false);
  const [exportPdfError, setExportPdfError] = useState<string>();

  const { hasPermission, isLoading: permissionsLoading } = useUserPermissions();
  const canEdit = permissionsLoading || hasPermission('purchase_order', 'update');
  const canDelete = permissionsLoading || hasPermission('purchase_order', 'delete');
  const canReceive = permissionsLoading || hasPermission('item_receipt', 'create');
  const canTransition = permissionsLoading || hasPermission('purchase_order', 'transition');

  const { data: po, isLoading, error } = useQuery({
    queryKey: ['purchase-order', id],
    queryFn: () => purchaseOrderService.getPurchaseOrder(id),
    enabled: Boolean(id),
  });

  const setLabel = useBreadcrumbStore((s) => s.setLabel);
  const clearLabel = useBreadcrumbStore((s) => s.clearLabel);
  useEffect(() => {
    if (po?.purchaseOrderNumber) {
      setLabel(id, po.purchaseOrderNumber);
      return () => clearLabel(id);
    }
  }, [id, po?.purchaseOrderNumber, setLabel, clearLabel]);

  const transition = useMutation({
    mutationFn: (toStatusCode: string) => purchaseOrderService.transition(id, toStatusCode),
    onSuccess: (updated) => {
      queryClient.setQueryData(['purchase-order', id], updated);
      queryClient.invalidateQueries({ queryKey: ['purchase-orders'] });
    },
  });

  if (isLoading) return <div className="p-6"><Spinner label="Loading purchase order…" /></div>;
  if (error || !po)
    return <div className="p-6"><ErrorNote>{apiErrorMessage(error, 'Failed to load purchase order.')}</ErrorNote></div>;

  const color = PO_STATUS_COLORS[po.statusCode] ?? '#a8a29e';
  const canDeleteHere = canDelete && PO_DELETABLE_STATUSES.has(po.statusCode);
  // Terminal statuses (CLSD/CANC) have no legal transitions, and a user without
  // `purchase_order:transition` sees none either — in both cases the bar renders
  // nothing, so the card would be an empty "Actions" header. Hide it unless it
  // has real content (a transition, an approval gate, or a failed transition).
  const hasTransitions = canTransition && (PO_ALLOWED_TRANSITIONS[po.statusCode]?.length ?? 0) > 0;
  const isApprovalPending = po.approvalStatus === 'pending';
  const showActions = hasTransitions || isApprovalPending || Boolean(transition.error);

  async function handleExportPdf() {
    if (!po) return;
    setExportPdfError(undefined);
    setExportingPdf(true);
    try {
      const { exportPurchasesRecordToPdf } = await import('@/lib/purchasesPdfExport');
      await exportPurchasesRecordToPdf({
        recordType: 'purchase_order',
        title: po.purchaseOrderNumber || 'Purchase Order',
        recordNumber: po.purchaseOrderNumber,
        statusLabel: po.status,
        counterpartyName: po.vendor.name,
        createdAt: po.createdAt,
        updatedAt: po.updatedAt,
        sections: [
          {
            title: 'Primary Information',
            rows: [
              ['Order Date', fmtDate(po.orderDate)],
              ['Expected Date', po.expectedDate ? fmtDate(po.expectedDate) : ''],
              ['Reference #', po.referenceNumber || ''],
              ['Sales Tax %', `${po.salesTaxPercent}%`],
              ['Memo', po.memo || ''],
              ['Notes', po.notes || ''],
              ['Terms & Conditions', po.termsConditions || ''],
            ],
          },
          { title: 'Ship To', rows: addressRows(po.shipTo) },
        ],
        itemsTable: {
          head: ['#', 'Item', 'SKU', 'Qty', 'Received', 'Unit Price', 'Disc %', 'Tax %', 'Total'],
          rows: po.items.map((line) => [
            String(line.lineNumber),
            line.itemName || line.description || '—',
            line.sku || '—',
            String(line.quantity),
            String(line.qtyReceived),
            currency(line.unitPrice),
            `${line.discountPercent}%`,
            `${line.taxPercent}%`,
            currency(line.lineTotal),
          ]),
          numericFrom: 3,
        },
        totals: [
          { label: 'Subtotal', value: currency(po.subtotal) },
          { label: 'Discount', value: currency(po.discountTotal) },
          { label: 'Tax', value: currency(po.taxTotal) },
          { label: 'Shipping', value: currency(po.shippingCharge) },
          { label: 'Adjustment', value: currency(po.adjustment) },
          { label: 'Grand Total', value: currency(po.grandTotal), bold: true },
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
        backLabel="Purchase Orders"
        onBack={() => navigate('/purchases/purchase_order')}
        icon={Package}
        title={po.purchaseOrderNumber || 'Purchase Order'}
        subtitle={po.vendor.name}
        recordNumber={po.purchaseOrderNumber}
        statusBadge={<Badge color={color}>{po.status}</Badge>}
      />

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
                  <ReadonlyField label="Order Date" value={fmtDate(po.orderDate)} />
                  <ReadonlyField label="Expected Date" value={po.expectedDate ? fmtDate(po.expectedDate) : undefined} />
                  <ReadonlyField label="Reference #" value={po.referenceNumber} />
                  <ReadonlyField label="Sales Tax %" value={`${po.salesTaxPercent}%`} />
                  {po.memo && <ReadonlyField label="Memo" value={po.memo} full />}
                  {po.notes && <ReadonlyField label="Notes" value={po.notes} full />}
                  {po.internalNotes && <ReadonlyField label="Internal Notes" value={po.internalNotes} full />}
                  {po.termsConditions && <ReadonlyField label="Terms & Conditions" value={po.termsConditions} full />}
                </div>
              </ModernSection>
              <ModernSection title="Ship To" index={1}>
                <AddressBlock addr={po.shipTo} />
              </ModernSection>
              <div className="rounded-lg border border-stone-200 bg-white p-4">
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
                  <Total label="Subtotal" value={po.subtotal} />
                  <Total label="Discount" value={po.discountTotal} />
                  <Total label="Tax" value={po.taxTotal} />
                  <Total label="Shipping" value={po.shippingCharge} />
                  <Total label="Adjustment" value={po.adjustment} />
                  <Total label="Grand Total" value={po.grandTotal} bold />
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
                      { label: 'Received' },
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
                  {po.items.map((line) => (
                    <tr key={line.id} className="hover:bg-stone-50/50 divide-x divide-stone-100">
                      <td className="px-3 py-2.5 text-stone-400 tabular-nums">{line.lineNumber}</td>
                      <td className="px-3 py-2.5 font-medium text-stone-800">
                        {line.itemName || line.description || <span className="text-stone-300">—</span>}
                      </td>
                      <td className="px-3 py-2.5 text-stone-500 max-w-[200px] truncate">{line.description || '—'}</td>
                      <td className="px-3 py-2.5 font-mono text-2xs text-stone-500">{line.sku || '—'}</td>
                      <td className="px-3 py-2.5 tabular-nums text-right text-stone-600">{line.quantity}</td>
                      <td className="px-3 py-2.5">
                        <ReceiptProgress received={line.qtyReceived} ordered={line.quantity} />
                      </td>
                      <td className="px-3 py-2.5 tabular-nums text-right text-stone-600">{currency(line.unitPrice)}</td>
                      <td className="px-3 py-2.5 tabular-nums text-right text-stone-500">{line.discountPercent}%</td>
                      <td className="px-3 py-2.5 tabular-nums text-right text-stone-500">{line.taxPercent}%</td>
                      <td className="px-3 py-2.5 tabular-nums text-right text-stone-800 font-semibold">{currency(line.lineTotal)}</td>
                    </tr>
                  ))}
                  {po.items.length === 0 && (
                    <tr><td colSpan={10} className="py-8 text-center text-stone-400">No line items.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {activeTab === 'receipts' && <PurchaseOrderReceiptsTab purchaseOrderId={id} />}
          {activeTab === 'audit' && <PurchaseOrderAuditTab purchaseOrderId={id} />}
          {activeTab === 'files' && <FilesContent ref={null} recordId={id} readOnly={false} />}

          <div className="h-6" />
        </div>

        {/* Right sidebar */}
        <SalesDetailSidebar label="Purchase Order Details">
          <div className="rounded-xl border border-stone-200 bg-white shadow-sm p-4 space-y-3 mb-4">
            <p className="text-xs font-semibold text-stone-400">Quick Actions</p>
            <div className="space-y-0.5">
              <button
                type="button"
                onClick={() => navigate(`/purchases/purchase_order/${id}/edit`, { state: { initialTab: 'files' } })}
                className="flex items-center gap-2.5 hover:bg-stone-50 rounded-lg px-3 py-2 cursor-pointer text-xs text-stone-700 w-full transition-colors text-left"
              >
                <Upload className="size-4 text-stone-400 shrink-0" />
                Upload file
              </button>
              {canReceive && isPurchaseOrderReceivable(po) && (
                <button
                  type="button"
                  onClick={() => navigate(`/purchases/item_receipt/new?po=${id}`)}
                  className="flex items-center gap-2.5 hover:bg-stone-50 rounded-lg px-3 py-2 cursor-pointer text-xs text-stone-700 w-full transition-colors text-left"
                >
                  <PackagePlus className="size-4 text-stone-400 shrink-0" />
                  Receive items
                </button>
              )}
              {canEdit && po.statusCode === 'DRFT' && (
                <button
                  type="button"
                  onClick={() => navigate(`/purchases/purchase_order/${id}/edit`)}
                  className="flex items-center gap-2.5 hover:bg-stone-50 rounded-lg px-3 py-2 cursor-pointer text-xs text-stone-700 w-full transition-colors text-left"
                >
                  <Pencil className="size-4 text-stone-400 shrink-0" />
                  Edit purchase order
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
              <PurchaseOrderTransitionBar
                statusCode={po.statusCode}
                approvalStatus={po.approvalStatus}
                onTransition={(toCode) => transition.mutate(toCode)}
                isPending={transition.isPending}
              />
              {isApprovalPending && (
                <PurchaseOrderApprovalButton
                  purchaseOrderId={id}
                  onApproved={(updated) => {
                    queryClient.setQueryData(['purchase-order', id], updated);
                    queryClient.invalidateQueries({ queryKey: ['purchase-orders'] });
                  }}
                />
              )}
              {transition.error && (
                <p role="alert" className="text-2xs text-destructive">{apiErrorMessage(transition.error, 'Failed to change status.')}</p>
              )}
            </div>
          )}

          <div className="rounded-xl border border-stone-200 bg-white shadow-sm p-4 space-y-3 mb-4">
            <p className="text-xs font-semibold text-stone-400">Status</p>
            <div className="flex justify-between items-center py-2 border-b border-stone-100 text-xs">
              <span className="text-stone-500">Status</span>
              <Badge color={color}>{po.status}</Badge>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-stone-100 text-xs">
              <span className="text-stone-500">Vendor</span>
              <button
                type="button"
                onClick={() => navigate(`/purchases/vendor/${po.vendor.id}`)}
                className="text-stone-700 hover:text-accent-foreground truncate max-w-[140px] transition-colors"
              >
                {po.vendor.name}
              </button>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-stone-100 text-xs">
              <span className="text-stone-500">Created</span>
              <span className="text-stone-700">{fmtDate(po.createdAt)}</span>
            </div>
            <div className="flex justify-between items-center py-2 text-xs">
              <span className="text-stone-500">Updated</span>
              <span className="text-stone-700">{fmtDate(po.updatedAt)}</span>
            </div>
          </div>

          {canDeleteHere && (
            <div className="rounded-xl border border-stone-200 bg-white shadow-sm p-4 space-y-3 mb-4">
              <p className="text-xs font-semibold text-red-400">Danger Zone</p>
              <DeletePurchaseOrderDialog
                purchaseOrderId={id}
                label={`Purchase Order ${po.purchaseOrderNumber}`}
                onDeleted={() => {
                  queryClient.invalidateQueries({ queryKey: ['purchase-orders'] });
                  navigate('/purchases/purchase_order');
                }}
              />
            </div>
          )}
        </SalesDetailSidebar>
      </div>
    </div>
  );
}

function ReceiptProgress({ received, ordered }: { received: number; ordered: number }) {
  const pct = ordered > 0 ? Math.min(100, Math.round((received / ordered) * 100)) : 0;
  const complete = ordered > 0 && received >= ordered;
  return (
    <div className="flex items-center gap-2 min-w-[100px]">
      <div className="h-1.5 flex-1 rounded-full bg-stone-100 overflow-hidden">
        <div
          className={cn('h-full rounded-full transition-all', complete ? 'bg-emerald-500' : received > 0 ? 'bg-amber-400' : 'bg-stone-200')}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="shrink-0 text-2xs tabular-nums text-stone-500">{received}/{ordered}</span>
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

function addressRows(addr: { name?: string; attention?: string; addrLine1?: string; addrLine2?: string; suiteUnit?: string; city?: string; zip?: string; phone?: string; email?: string }): Array<[string, string]> {
  return [
    ['Name', addr.name || ''],
    ['Attention', addr.attention || ''],
    ['Address', [addr.addrLine1, addr.addrLine2].filter(Boolean).join(', ')],
    ['City/Zip', [addr.suiteUnit, addr.city, addr.zip].filter(Boolean).join(', ')],
    ['Phone', addr.phone || ''],
    ['Email', addr.email || ''],
  ];
}

function AddressBlock({ addr }: { addr: { name?: string; attention?: string; addrLine1?: string; addrLine2?: string; suiteUnit?: string; city?: string; zip?: string; phone?: string; fax?: string; email?: string } }) {
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
      {addr.name && <p className="font-semibold text-stone-900">{addr.name}</p>}
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
