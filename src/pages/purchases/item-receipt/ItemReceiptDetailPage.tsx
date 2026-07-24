import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Inbox, Upload, Pencil, Package } from 'lucide-react';
import { itemReceiptService } from '@/services/itemReceiptService';
import { apiErrorMessage } from '@/api/tenantClient';
import { Spinner, ErrorNote, Badge } from '@/components/tenant/ui';
import { ModernSection } from '@/components/crm/FormPrimitives';
import { readonlyCls, fieldLabelCls } from '@/components/crm/formUtils';
import { FilesContent } from '@/components/crm/CrmSubTabsPanel';
import { CrmPageHeader } from '@/pages/crm/components/CrmPageHeader';
import { useBreadcrumbStore } from '@/store/useBreadcrumbStore';
import { useUserPermissions } from '@/hooks/useUserPermissions';
import { cn } from '@/lib/utils';
import { IR_STATUS_COLORS, IR_EDITABLE_STATUSES, IR_POSTABLE_STATUSES, IR_VOIDABLE_STATUSES, IR_DELETABLE_STATUSES } from '@/lib/itemReceiptForm';
import { ItemReceiptAuditTab } from './components/ItemReceiptAuditTab';
import { DeleteItemReceiptDialog } from './components/DeleteItemReceiptDialog';
import { PostReceiptDialog } from './components/PostReceiptDialog';
import { VoidReceiptDialog } from './components/VoidReceiptDialog';
import { SalesDetailSidebar } from '@/pages/sales/components/SalesDetailSidebar';

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

function fmtDateTime(iso?: string): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString();
}

export default function ItemReceiptDetailPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<Tab>('overview');

  const { hasPermission, isLoading: permissionsLoading } = useUserPermissions();
  const canEdit = permissionsLoading || hasPermission('item_receipt', 'update');
  const canDelete = permissionsLoading || hasPermission('item_receipt', 'delete');
  const canTransition = permissionsLoading || hasPermission('item_receipt', 'transition');

  const { data: ir, isLoading, error } = useQuery({
    queryKey: ['item-receipt', id],
    queryFn: () => itemReceiptService.getItemReceipt(id),
    enabled: Boolean(id),
  });

  const setLabel = useBreadcrumbStore((s) => s.setLabel);
  const clearLabel = useBreadcrumbStore((s) => s.clearLabel);
  useEffect(() => {
    if (ir?.itemReceiptNumber) {
      setLabel(id, ir.itemReceiptNumber);
      return () => clearLabel(id);
    }
  }, [id, ir?.itemReceiptNumber, setLabel, clearLabel]);

  function refresh(updated: { id: string }) {
    queryClient.setQueryData(['item-receipt', id], updated);
    queryClient.invalidateQueries({ queryKey: ['item-receipts'] });
    queryClient.invalidateQueries({ queryKey: ['purchase-order-receipts'] });
    queryClient.invalidateQueries({ queryKey: ['purchase-order'] });
  }

  if (isLoading) return <div className="p-6"><Spinner label="Loading item receipt…" /></div>;
  if (error || !ir)
    return <div className="p-6"><ErrorNote>{apiErrorMessage(error, 'Failed to load item receipt.')}</ErrorNote></div>;

  const color = IR_STATUS_COLORS[ir.statusCode] ?? '#a8a29e';
  const canEditHere = canEdit && IR_EDITABLE_STATUSES.has(ir.statusCode);
  const canPostHere = canTransition && IR_POSTABLE_STATUSES.has(ir.statusCode);
  const canVoidHere = canTransition && IR_VOIDABLE_STATUSES.has(ir.statusCode);
  const canDeleteHere = canDelete && IR_DELETABLE_STATUSES.has(ir.statusCode);
  const items = ir.items ?? [];

  return (
    <div className="flex flex-col flex-1 min-h-0 bg-stone-50">
      <CrmPageHeader
        backLabel="Item Receipts"
        onBack={() => navigate('/purchases/item_receipt')}
        icon={Inbox}
        title={ir.itemReceiptNumber || 'Item Receipt'}
        subtitle={ir.vendor.name}
        recordNumber={ir.itemReceiptNumber}
        statusBadge={<Badge color={color}>{ir.status}</Badge>}
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
              <ModernSection title="Source Purchase Order" index={0}>
                <div className="flex items-center justify-between gap-3 rounded-lg border border-stone-200 bg-stone-50/60 px-4 py-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Package className="size-4 shrink-0 text-stone-400" aria-hidden="true" />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-stone-800">{ir.purchaseOrder.number || '—'}</p>
                      <p className="truncate text-xs text-stone-400">{ir.vendor.name}</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => navigate(`/purchases/purchase_order/${ir.purchaseOrder.id}`)}
                    className="shrink-0 rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-xs font-medium text-stone-600 hover:bg-stone-50 transition-colors"
                  >
                    View order
                  </button>
                </div>
              </ModernSection>

              <ModernSection title="Receipt Information" index={1}>
                <div className="grid grid-cols-1 gap-x-5 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
                  <ReadonlyField label="Receipt Date" value={fmtDate(ir.receiptDate)} />
                  <ReadonlyField label="Warehouse" value={ir.warehouseName} />
                  <ReadonlyField label="Packing Slip #" value={ir.packingSlip} />
                  <ReadonlyField label="Carrier" value={ir.carrier} />
                  <ReadonlyField label="Tracking #" value={ir.trackingNumber} />
                  <ReadonlyField label="Bill of Lading #" value={ir.billOfLading} />
                  {ir.notes && <ReadonlyField label="Notes" value={ir.notes} full />}
                  {ir.internalNotes && <ReadonlyField label="Internal Notes" value={ir.internalNotes} full />}
                  {ir.overReceiptReason && <ReadonlyField label="Over-Receipt Reason" value={ir.overReceiptReason} full />}
                  {ir.voidReason && <ReadonlyField label="Void Reason" value={ir.voidReason} full />}
                </div>
              </ModernSection>
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
                      { label: 'Ordered', right: true },
                      { label: 'Received', right: true },
                      { label: 'Rejected', right: true },
                      { label: 'Notes' },
                    ].map((h) => (
                      <th key={h.label} className={cn('px-3 py-2.5 text-2xs font-semibold uppercase tracking-wide text-stone-500 whitespace-nowrap', h.right && 'text-right')}>{h.label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {items.map((line) => (
                    <tr key={line.id} className="hover:bg-stone-50/50 divide-x divide-stone-100">
                      <td className="px-3 py-2.5 text-stone-400 tabular-nums">{line.lineNumber}</td>
                      <td className="px-3 py-2.5 font-medium text-stone-800">
                        {line.itemName || line.description || <span className="text-stone-300">—</span>}
                      </td>
                      <td className="px-3 py-2.5 font-mono text-2xs text-stone-500">{line.sku || '—'}</td>
                      <td className="px-3 py-2.5 tabular-nums text-right text-stone-600">{line.qtyOrdered}</td>
                      <td className="px-3 py-2.5 tabular-nums text-right text-stone-800 font-semibold">{line.qtyReceived}</td>
                      <td className="px-3 py-2.5 tabular-nums text-right text-stone-500">{line.qtyRejected}</td>
                      <td className="px-3 py-2.5 text-stone-500 max-w-[200px] truncate">{line.lineNotes || '—'}</td>
                    </tr>
                  ))}
                  {items.length === 0 && (
                    <tr><td colSpan={7} className="py-8 text-center text-stone-400">No line items.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {activeTab === 'audit' && <ItemReceiptAuditTab itemReceiptId={id} />}
          {activeTab === 'files' && <FilesContent ref={null} recordId={id} readOnly={false} />}

          <div className="h-6" />
        </div>

        {/* Right sidebar */}
        <SalesDetailSidebar label="Item Receipt Details">
          <div className="rounded-xl border border-stone-200 bg-white shadow-sm p-4 space-y-3 mb-4">
            <p className="text-xs font-semibold text-stone-400">Quick Actions</p>
            <div className="space-y-0.5">
              <button
                type="button"
                onClick={() => navigate(`/purchases/item_receipt/${id}/edit`, { state: { initialTab: 'files' } })}
                className="flex items-center gap-2.5 hover:bg-stone-50 rounded-lg px-3 py-2 cursor-pointer text-xs text-stone-700 w-full transition-colors text-left"
              >
                <Upload className="size-4 text-stone-400 shrink-0" />
                Upload file
              </button>
              {canEditHere && (
                <button
                  type="button"
                  onClick={() => navigate(`/purchases/item_receipt/${id}/edit`)}
                  className="flex items-center gap-2.5 hover:bg-stone-50 rounded-lg px-3 py-2 cursor-pointer text-xs text-stone-700 w-full transition-colors text-left"
                >
                  <Pencil className="size-4 text-stone-400 shrink-0" />
                  Edit item receipt
                </button>
              )}
            </div>
          </div>

          {canPostHere && (
            <div className="rounded-xl border border-stone-200 bg-white shadow-sm p-4 space-y-2.5 mb-4">
              <p className="text-xs font-semibold text-stone-400">Actions</p>
              <PostReceiptDialog itemReceiptId={id} onPosted={refresh} />
            </div>
          )}

          <div className="rounded-xl border border-stone-200 bg-white shadow-sm p-4 space-y-3 mb-4">
            <p className="text-xs font-semibold text-stone-400">Status</p>
            <div className="flex justify-between items-center py-2 border-b border-stone-100 text-xs">
              <span className="text-stone-500">Status</span>
              <Badge color={color}>{ir.status}</Badge>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-stone-100 text-xs">
              <span className="text-stone-500">Vendor</span>
              <button
                type="button"
                onClick={() => navigate(`/purchases/vendor/${ir.vendor.id}`)}
                className="text-stone-700 hover:text-accent-foreground truncate max-w-[140px] transition-colors"
              >
                {ir.vendor.name}
              </button>
            </div>
            {ir.postedAt && (
              <div className="flex justify-between items-center py-2 border-b border-stone-100 text-xs">
                <span className="text-stone-500">Posted</span>
                <span className="text-stone-700">{fmtDateTime(ir.postedAt)}</span>
              </div>
            )}
            {ir.voidedAt && (
              <div className="flex justify-between items-center py-2 border-b border-stone-100 text-xs">
                <span className="text-stone-500">Voided</span>
                <span className="text-stone-700">{fmtDateTime(ir.voidedAt)}</span>
              </div>
            )}
            <div className="flex justify-between items-center py-2 border-b border-stone-100 text-xs">
              <span className="text-stone-500">Created</span>
              <span className="text-stone-700">{fmtDate(ir.createdAt)}</span>
            </div>
            <div className="flex justify-between items-center py-2 text-xs">
              <span className="text-stone-500">Updated</span>
              <span className="text-stone-700">{fmtDate(ir.updatedAt)}</span>
            </div>
          </div>

          {(canDeleteHere || canVoidHere) && (
            <div className="rounded-xl border border-stone-200 bg-white shadow-sm p-4 space-y-3 mb-4">
              <p className="text-xs font-semibold text-red-400">Danger Zone</p>
              {canVoidHere && (
                <VoidReceiptDialog itemReceiptId={id} statusCode={ir.statusCode} onVoided={refresh} />
              )}
              {canDeleteHere && (
                <DeleteItemReceiptDialog
                  itemReceiptId={id}
                  label={`Item Receipt ${ir.itemReceiptNumber}`}
                  onDeleted={() => {
                    queryClient.invalidateQueries({ queryKey: ['item-receipts'] });
                    navigate('/purchases/item_receipt');
                  }}
                />
              )}
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
