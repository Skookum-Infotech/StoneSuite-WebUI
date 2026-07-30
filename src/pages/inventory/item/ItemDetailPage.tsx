import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Package, Pencil, FileDown, Loader2, History as HistoryIcon } from 'lucide-react';
import { inventoryService } from '@/services/inventoryService';
import { lookupService } from '@/services/lookupService';
import { apiErrorMessage } from '@/api/tenantClient';
import { Spinner, ErrorNote, Badge } from '@/components/tenant/ui';
import { ModernSection } from '@/components/crm/FormPrimitives';
import { readonlyCls, fieldLabelCls } from '@/components/crm/formUtils';
import { CrmPageHeader } from '@/pages/crm/components/CrmPageHeader';
import { SalesDetailSidebar } from '@/pages/sales/components/SalesDetailSidebar';
import { useBreadcrumbStore } from '@/store/useBreadcrumbStore';
import { useUserPermissions } from '@/hooks/useUserPermissions';
import { useInventoryLookups } from '@/hooks/useInventoryLookups';
import { cn } from '@/lib/utils';
import { TRACKING_SERIALIZED } from '@/types/inventory';
import { DeleteItemDialog } from './components/DeleteItemDialog';

const TABS = [
  { key: 'overview', label: 'Overview' },
  { key: 'history', label: 'History' },
] as const;
type Tab = (typeof TABS)[number]['key'];

function nameOf(items: { id: number; name: string }[] | undefined, id: number | null | undefined): string | undefined {
  if (id === null || id === undefined) return undefined;
  return items?.find((i) => i.id === id)?.name;
}

function fmtDateTime(iso?: string): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString();
}

export default function ItemDetailPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [exportingPdf, setExportingPdf] = useState(false);
  const [exportPdfError, setExportPdfError] = useState<string>();

  const { hasPermission, isLoading: permissionsLoading } = useUserPermissions();
  const canEdit = permissionsLoading || hasPermission('inventory_item', 'update');
  const canDelete = permissionsLoading || hasPermission('inventory_item', 'delete');

  const { data: item, isLoading, error } = useQuery({
    queryKey: ['inventory-item', id],
    queryFn: () => inventoryService.getItem(id),
    enabled: Boolean(id),
  });

  const { lookups } = useInventoryLookups();
  const { data: crmLookups } = useQuery({
    queryKey: ['crm-lookups'],
    queryFn: lookupService.getCrmLookups,
    staleTime: 10 * 60 * 1000,
  });

  const { data: history = [] } = useQuery({
    queryKey: ['inventory-item-history', id],
    queryFn: () => inventoryService.getHistory(id),
    enabled: Boolean(id) && activeTab === 'history',
  });

  const setLabel = useBreadcrumbStore((s) => s.setLabel);
  const clearLabel = useBreadcrumbStore((s) => s.clearLabel);
  useEffect(() => {
    if (item?.name) {
      setLabel(id, item.name);
      return () => clearLabel(id);
    }
  }, [id, item?.name, setLabel, clearLabel]);

  if (isLoading) return <div className="p-6"><Spinner label="Loading item…" /></div>;
  if (error || !item) return <div className="p-6"><ErrorNote>{apiErrorMessage(error, 'Failed to load item.')}</ErrorNote></div>;

  async function handleExportPdf() {
    if (!item) return;
    setExportPdfError(undefined);
    setExportingPdf(true);
    try {
      const { exportInventoryRecordToPdf } = await import('@/lib/inventoryPdfExport');
      await exportInventoryRecordToPdf({
        recordType: 'inventory_item',
        title: item.name,
        recordNumber: item.sku,
        statusLabel: item.isActive ? 'Active' : 'Inactive',
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
        sections: [
          {
            title: 'Primary Information',
            rows: [
              ['SKU', item.sku],
              ['Description', item.description || ''],
              ['Unit', nameOf(lookups?.units, item.unitId) || ''],
              ['Unit Price', `$${item.unitPrice.toFixed(2)}`],
              ['Barcode', item.barcode || ''],
              ['Default Warehouse', lookups?.warehouses.find((w) => w.id === String(item.defaultWarehouseId))?.name || ''],
            ],
          },
          {
            title: 'Stone Attributes',
            rows: [
              ['Tracking', item.tracking === TRACKING_SERIALIZED ? 'Serialized' : 'Quantity'],
              ['Material', nameOf(lookups?.materials, item.materialId) || ''],
              ['Color', nameOf(lookups?.colors, item.colorId) || ''],
              ['Finish', nameOf(lookups?.finishes, item.finishId) || ''],
              ['Thickness (mm)', item.thicknessMm ? String(item.thicknessMm) : ''],
              ['Origin Country', nameOf(crmLookups?.countries, item.originCountryId) || ''],
            ],
          },
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
        backLabel="Items"
        onBack={() => navigate('/inventory/item')}
        icon={Package}
        title={item.name}
        subtitle={item.description}
        recordNumber={item.sku}
        statusBadge={<Badge color={item.isActive ? '#22c55e' : '#a8a29e'}>{item.isActive ? 'Active' : 'Inactive'}</Badge>}
      />

      <div className="flex shrink-0 overflow-x-auto overflow-y-hidden border-b border-stone-200 bg-white px-5 3xl:px-12 4xl:px-16 modal-scrollbar">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key)}
            className={cn(
              'px-4 py-3 text-sm font-semibold border-b-2 -mb-px transition-colors duration-150 whitespace-nowrap shrink-0',
              activeTab === tab.key ? 'border-brand text-stone-950' : 'border-transparent text-stone-500 hover:text-stone-700 hover:border-stone-200',
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="flex flex-col lg:flex-row gap-6 px-4 py-4 sm:px-5 sm:py-5 3xl:px-12 3xl:py-8 3xl:gap-10 4xl:px-16 4xl:py-10 4xl:gap-14">
        <div className="flex-1 space-y-3 min-w-0">
          {activeTab === 'overview' && (
            <>
              <ModernSection title="Primary Information" index={0}>
                <div className="grid grid-cols-1 gap-x-5 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
                  <ReadonlyField label="Unit" value={nameOf(lookups?.units, item.unitId)} />
                  <ReadonlyField label="Unit Price" value={`$${item.unitPrice.toFixed(2)}`} />
                  <ReadonlyField label="Currency" value={nameOf(crmLookups?.currencies, item.currencyId)} />
                  <ReadonlyField label="Tax Rate" value={nameOf(lookups?.['tax-rates'], item.taxRateId)} />
                  <ReadonlyField label="Barcode" value={item.barcode} />
                  <ReadonlyField label="Default Warehouse" value={lookups?.warehouses.find((w) => w.id === String(item.defaultWarehouseId))?.name} />
                </div>
              </ModernSection>

              <ModernSection title="Stone Attributes" index={1}>
                <div className="grid grid-cols-1 gap-x-5 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
                  <ReadonlyField label="Tracking" value={item.tracking === TRACKING_SERIALIZED ? 'Serialized' : 'Quantity'} />
                  <ReadonlyField label="Material" value={nameOf(lookups?.materials, item.materialId)} />
                  <ReadonlyField label="Color" value={nameOf(lookups?.colors, item.colorId)} />
                  <ReadonlyField label="Finish" value={nameOf(lookups?.finishes, item.finishId)} />
                  {item.thicknessMm > 0 && <ReadonlyField label="Thickness (mm)" value={String(item.thicknessMm)} />}
                  <ReadonlyField label="Origin Country" value={nameOf(crmLookups?.countries, item.originCountryId)} />
                </div>
              </ModernSection>
            </>
          )}

          {activeTab === 'history' && (
            <div className="rounded-xl border border-stone-200 bg-white p-4">
              {history.length === 0 ? (
                <p className="py-8 text-center text-sm text-stone-400">No history recorded yet.</p>
              ) : (
                <ul className="space-y-3">
                  {history.map((h, i) => (
                    <li key={i} className="flex items-start gap-3 border-b border-stone-100 pb-3 last:border-0 last:pb-0">
                      <HistoryIcon className="mt-0.5 size-3.5 shrink-0 text-stone-400" aria-hidden="true" />
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-stone-800">{h.action}</p>
                        <p className="text-2xs text-stone-400">{fmtDateTime(h.at)} · {h.byName}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          <div className="h-6" />
        </div>

        <SalesDetailSidebar label="Item Details">
          <div className="rounded-xl border border-stone-200 bg-white shadow-sm p-4 space-y-3 mb-4">
            <p className="text-xs font-semibold text-stone-400">Quick Actions</p>
            <div className="space-y-0.5">
              {canEdit && (
                <button
                  type="button"
                  onClick={() => navigate(`/inventory/item/${id}/edit`)}
                  className="flex items-center gap-2.5 hover:bg-stone-50 rounded-lg px-3 py-2 cursor-pointer text-xs text-stone-700 w-full transition-colors text-left"
                >
                  <Pencil className="size-4 text-stone-400 shrink-0" />
                  Edit item
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
            {exportPdfError && <p role="alert" className="text-2xs text-destructive">{exportPdfError}</p>}
          </div>

          <div className="rounded-xl border border-stone-200 bg-white shadow-sm p-4 space-y-3 mb-4">
            <p className="text-xs font-semibold text-stone-400">Status</p>
            <div className="flex justify-between items-center py-2 border-b border-stone-100 text-xs">
              <span className="text-stone-500">Status</span>
              <Badge color={item.isActive ? '#22c55e' : '#a8a29e'}>{item.isActive ? 'Active' : 'Inactive'}</Badge>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-stone-100 text-xs">
              <span className="text-stone-500">Created</span>
              <span className="text-stone-700">{fmtDateTime(item.createdAt)}</span>
            </div>
            <div className="flex justify-between items-center py-2 text-xs">
              <span className="text-stone-500">Updated</span>
              <span className="text-stone-700">{fmtDateTime(item.updatedAt)}</span>
            </div>
          </div>

          {canDelete && (
            <div className="rounded-xl border border-stone-200 bg-white shadow-sm p-4 space-y-3 mb-4">
              <p className="text-xs font-semibold text-red-400">Danger Zone</p>
              <DeleteItemDialog
                itemId={id}
                label={item.name}
                onDeleted={() => {
                  queryClient.invalidateQueries({ queryKey: ['inventory-items'] });
                  navigate('/inventory/item');
                }}
              />
            </div>
          )}
        </SalesDetailSidebar>
      </div>
    </div>
  );
}

function ReadonlyField({ label, value }: { label: string; value?: string }) {
  return (
    <div className="space-y-1">
      <label className={fieldLabelCls}>{label}</label>
      <div className={readonlyCls}>{value || <span className="text-stone-400">—</span>}</div>
    </div>
  );
}
