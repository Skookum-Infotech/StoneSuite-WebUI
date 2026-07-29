import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Layers, ArrowLeftRight, Scissors, AlertTriangle, History as HistoryIcon, FileDown, Loader2 } from 'lucide-react';
import { inventoryUnitService } from '@/services/inventoryUnitService';
import { apiErrorMessage } from '@/api/tenantClient';
import { Spinner, ErrorNote, Badge } from '@/components/tenant/ui';
import { ModernSection } from '@/components/crm/FormPrimitives';
import { readonlyCls, fieldLabelCls } from '@/components/crm/formUtils';
import { CrmPageHeader } from '@/pages/crm/components/CrmPageHeader';
import { SalesDetailSidebar } from '@/pages/sales/components/SalesDetailSidebar';
import { useBreadcrumbStore } from '@/store/useBreadcrumbStore';
import { useUserPermissions } from '@/hooks/useUserPermissions';
import { UNIT_STATUS_AVAILABLE, UNIT_STATUS_IN_TRANSIT, type UnitHistoryEntry } from '@/types/inventory';
import { MoveUnitDialog } from './components/MoveUnitDialog';
import { ScrapUnitDialog } from './components/ScrapUnitDialog';
import { CutUnitDialog } from './components/CutUnitDialog';

const STATUS_COLORS: Record<string, string> = {
  available: '#22c55e', reserved: '#f59e0b', consumed: '#64748b', scrapped: '#ef4444', in_transit: '#6366f1',
};

function fmtDateTime(iso?: string): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString();
}

function describeHistoryEntry(h: UnitHistoryEntry): string {
  if (h.fromBin || h.toBin) return `${h.fromBin || '— no bin —'} → ${h.toBin || '— no bin —'}`;
  if (h.reason) return h.note ? `${h.reason} — ${h.note}` : h.reason;
  if (h.note) return h.note;
  if (h.oldValue || h.newValue) return `${h.oldValue || '—'} → ${h.newValue || '—'}`;
  return '';
}

export default function UnitDetailPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'overview' | 'history'>('overview');
  const [dialog, setDialog] = useState<'move' | 'scrap' | 'cut' | null>(null);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [exportPdfError, setExportPdfError] = useState<string>();
  const [cutMessage, setCutMessage] = useState<string | null>(null);

  const { hasPermission, isLoading: permissionsLoading } = useUserPermissions();
  const canUpdate = permissionsLoading || hasPermission('inventory_unit', 'update');

  const { data: unit, isLoading, error } = useQuery({
    queryKey: ['inventory-unit', id],
    queryFn: () => inventoryUnitService.getUnit(id),
    enabled: Boolean(id),
  });

  const { data: history = [] } = useQuery({
    queryKey: ['inventory-unit-history', id],
    queryFn: () => inventoryUnitService.getHistory(id),
    enabled: Boolean(id) && activeTab === 'history',
  });

  function invalidateUnit() {
    queryClient.invalidateQueries({ queryKey: ['inventory-unit', id] });
    queryClient.invalidateQueries({ queryKey: ['inventory-unit-history', id] });
  }

  const setLabel = useBreadcrumbStore((s) => s.setLabel);
  const clearLabel = useBreadcrumbStore((s) => s.clearLabel);
  useEffect(() => {
    if (unit?.serial) {
      setLabel(id, unit.serial);
      return () => clearLabel(id);
    }
  }, [id, unit?.serial, setLabel, clearLabel]);

  if (isLoading) return <div className="p-6"><Spinner label="Loading unit…" /></div>;
  if (error || !unit) return <div className="p-6"><ErrorNote>{apiErrorMessage(error, 'Failed to load unit.')}</ErrorNote></div>;

  const inTransit = unit.status === UNIT_STATUS_IN_TRANSIT;
  const actionable = unit.status === UNIT_STATUS_AVAILABLE;
  const disabledReason = inTransit
    ? 'This unit is in transit between warehouses — refuses bin moves, cuts and scraps until received.'
    : !actionable ? `Unit is ${unit.status.replace('_', ' ')}.` : undefined;

  async function handleExportPdf() {
    if (!unit) return;
    setExportPdfError(undefined);
    setExportingPdf(true);
    try {
      const { exportInventoryRecordToPdf } = await import('@/lib/inventoryPdfExport');
      await exportInventoryRecordToPdf({
        recordType: 'inventory_unit',
        title: unit.serial,
        statusLabel: unit.status.replace('_', ' '),
        createdAt: unit.createdAt,
        updatedAt: unit.updatedAt,
        sections: [
          {
            title: 'Unit Information',
            rows: [
              ['Item', unit.inventoryItemName || ''],
              ['Kind', unit.kind],
              ['Form', unit.form],
              ['Area', `${unit.area.toFixed(2)} sq`],
              ['Dimensions (mm)', `${unit.lengthMm} × ${unit.widthMm} × ${unit.thicknessMm}`],
              ['Grade', unit.grade || ''],
              ['Finish', unit.finish || ''],
              ['Warehouse', unit.warehouseName || ''],
              ['Bin', unit.binPath || ''],
              ['Lot', unit.lot || ''],
              ['Block ID', unit.blockId || ''],
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
        backLabel="Units"
        onBack={() => navigate('/inventory/unit')}
        icon={Layers}
        title={unit.serial}
        subtitle={unit.inventoryItemName}
        statusBadge={<Badge color={STATUS_COLORS[unit.status] ?? '#a8a29e'}>{unit.status.replace('_', ' ')}</Badge>}
      />

      <div className="flex shrink-0 overflow-x-auto border-b border-stone-200 bg-white px-5 3xl:px-12 4xl:px-16 modal-scrollbar">
        {(['overview', 'history'] as const).map((t) => (
          <button key={t} type="button" onClick={() => setActiveTab(t)} className={`px-4 py-3 text-sm font-semibold border-b-2 -mb-px transition-colors capitalize ${activeTab === t ? 'border-brand text-stone-950' : 'border-transparent text-stone-500 hover:text-stone-700'}`}>
            {t}
          </button>
        ))}
      </div>

      <div className="flex flex-col lg:flex-row gap-6 px-4 py-4 sm:px-5 sm:py-5 3xl:px-12 3xl:py-8 3xl:gap-10 4xl:px-16 4xl:py-10 4xl:gap-14">
        <div className="flex-1 space-y-3 min-w-0">
          {activeTab === 'overview' && (
            <>
              {inTransit && (
                <div className="flex items-start gap-3 rounded-lg border border-indigo-200 bg-indigo-50 px-4 py-3">
                  <ArrowLeftRight className="mt-0.5 size-4 shrink-0 text-indigo-500" />
                  <p className="text-xs text-indigo-700">This unit is on a truck between warehouses. Receive the transfer to bring it back into stock before moving, cutting or scrapping it.</p>
                </div>
              )}
              {cutMessage && <p className="text-xs text-emerald-600">{cutMessage}</p>}
              <ModernSection title="Unit Information" index={0}>
                <div className="grid grid-cols-1 gap-x-5 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
                  <ReadonlyField label="Item" value={unit.inventoryItemName} />
                  <ReadonlyField label="Kind" value={unit.kind} />
                  <ReadonlyField label="Form" value={unit.form} />
                  <ReadonlyField label="Area" value={`${unit.area.toFixed(2)} sq`} />
                  <ReadonlyField label="Dimensions (mm)" value={`${unit.lengthMm} × ${unit.widthMm} × ${unit.thicknessMm}`} />
                  <ReadonlyField label="Grade" value={unit.grade} />
                  <ReadonlyField label="Finish" value={unit.finish} />
                  <ReadonlyField label="Warehouse" value={unit.warehouseName} />
                  <ReadonlyField label="Bin" value={unit.binPath} />
                  <ReadonlyField label="Lot" value={unit.lot} />
                  <ReadonlyField label="Block ID" value={unit.blockId} />
                  <ReadonlyField label="Barcode" value={unit.barcode} />
                </div>
              </ModernSection>

              {(unit.parentUnitId || unit.rootUnitId) && (
                <ModernSection title="Lineage" index={1}>
                  <div className="grid grid-cols-1 gap-x-5 gap-y-4 sm:grid-cols-2">
                    {unit.parentUnitId && (
                      <div className="space-y-1">
                        <label className={fieldLabelCls}>Parent Unit</label>
                        <button type="button" onClick={() => navigate(`/inventory/unit/${unit.parentUnitId}`)} className={`${readonlyCls} block text-left hover:bg-stone-100 transition-colors`}>
                          {unit.parentUnitId}
                        </button>
                      </div>
                    )}
                    {unit.rootUnitId && (
                      <div className="space-y-1">
                        <label className={fieldLabelCls}>Root Unit</label>
                        <button type="button" onClick={() => navigate(`/inventory/unit/${unit.rootUnitId}`)} className={`${readonlyCls} block text-left hover:bg-stone-100 transition-colors`}>
                          {unit.rootUnitId}
                        </button>
                      </div>
                    )}
                  </div>
                </ModernSection>
              )}
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
                        {describeHistoryEntry(h) && <p className="text-2xs text-stone-500">{describeHistoryEntry(h)}</p>}
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

        <SalesDetailSidebar label="Unit Details">
          <div className="rounded-xl border border-stone-200 bg-white shadow-sm p-4 space-y-3 mb-4">
            <p className="text-xs font-semibold text-stone-400">Quick Actions</p>
            <div className="space-y-0.5">
              <button type="button" onClick={handleExportPdf} disabled={exportingPdf} className="flex items-center gap-2.5 hover:bg-stone-50 rounded-lg px-3 py-2 cursor-pointer text-xs text-stone-700 w-full transition-colors text-left disabled:opacity-60 disabled:cursor-not-allowed" aria-label="Export as PDF">
                {exportingPdf ? <Loader2 className="size-4 text-stone-400 shrink-0 animate-spin" /> : <FileDown className="size-4 text-stone-400 shrink-0" />}
                {exportingPdf ? 'Exporting…' : 'Export PDF'}
              </button>
            </div>
            {exportPdfError && <p role="alert" className="text-2xs text-destructive">{exportPdfError}</p>}
          </div>

          {canUpdate && (
            <div className="rounded-xl border border-stone-200 bg-white shadow-sm p-4 space-y-0.5 mb-4" title={disabledReason}>
              <p className="text-xs font-semibold text-stone-400 mb-2">Actions</p>
              <button type="button" disabled={Boolean(disabledReason)} onClick={() => setDialog('move')} className="flex items-center gap-2.5 hover:bg-stone-50 rounded-lg px-3 py-2 text-xs text-stone-700 w-full transition-colors text-left disabled:opacity-40 disabled:cursor-not-allowed">
                <ArrowLeftRight className="size-4 text-stone-400 shrink-0" /> Move Bin
              </button>
              <button type="button" disabled={Boolean(disabledReason)} onClick={() => setDialog('cut')} className="flex items-center gap-2.5 hover:bg-stone-50 rounded-lg px-3 py-2 text-xs text-stone-700 w-full transition-colors text-left disabled:opacity-40 disabled:cursor-not-allowed">
                <Scissors className="size-4 text-stone-400 shrink-0" /> Cut
              </button>
              <button type="button" disabled={Boolean(disabledReason)} onClick={() => setDialog('scrap')} className="flex items-center gap-2.5 hover:bg-destructive/5 rounded-lg px-3 py-2 text-xs text-destructive w-full transition-colors text-left disabled:opacity-40 disabled:cursor-not-allowed">
                <AlertTriangle className="size-4 shrink-0" /> Scrap
              </button>
              {disabledReason && <p className="px-3 pt-1 text-2xs text-stone-400">{disabledReason}</p>}
            </div>
          )}

          <div className="rounded-xl border border-stone-200 bg-white shadow-sm p-4 space-y-3 mb-4">
            <p className="text-xs font-semibold text-stone-400">Status</p>
            <div className="flex justify-between items-center py-2 border-b border-stone-100 text-xs">
              <span className="text-stone-500">Created</span>
              <span className="text-stone-700">{fmtDateTime(unit.createdAt)}</span>
            </div>
            <div className="flex justify-between items-center py-2 text-xs">
              <span className="text-stone-500">Updated</span>
              <span className="text-stone-700">{fmtDateTime(unit.updatedAt)}</span>
            </div>
          </div>
        </SalesDetailSidebar>
      </div>

      {dialog === 'move' && <MoveUnitDialog unit={unit} onClose={() => setDialog(null)} onMoved={invalidateUnit} />}
      {dialog === 'scrap' && <ScrapUnitDialog unit={unit} onClose={() => setDialog(null)} onScrapped={invalidateUnit} />}
      {dialog === 'cut' && (
        <CutUnitDialog
          unit={unit}
          onClose={() => setDialog(null)}
          onCut={(result) => {
            setCutMessage(`Cut complete: ${result.remnants.length} offcut(s) kept, ${result.lostArea.toFixed(2)} sq lost to kerf/product.`);
            invalidateUnit();
          }}
        />
      )}
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
