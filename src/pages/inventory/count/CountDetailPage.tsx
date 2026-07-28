import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { ClipboardCheck, PackagePlus, Snowflake } from 'lucide-react';
import { inventoryCountService } from '@/services/inventoryCountService';
import { apiErrorMessage } from '@/api/tenantClient';
import { Spinner, ErrorNote, Badge } from '@/components/tenant/ui';
import { ModernSection } from '@/components/crm/FormPrimitives';
import { readonlyCls, fieldLabelCls } from '@/components/crm/formUtils';
import { CrmPageHeader } from '@/pages/crm/components/CrmPageHeader';
import { SalesDetailSidebar } from '@/pages/sales/components/SalesDetailSidebar';
import { useUserPermissions } from '@/hooks/useUserPermissions';
import { useInventoryLookups } from '@/hooks/useInventoryLookups';
import { DocumentStatusBar } from '@/components/inventory/DocumentStatusBar';
import { docStatusLabel, DOC_STATUS_COLORS } from '@/lib/inventoryDocumentStatus';
import { CountLinesGrid } from './components/CountLinesGrid';
import { AddUnexpectedDialog } from './components/AddUnexpectedDialog';

export default function CountDetailPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [actionError, setActionError] = useState<string | null>(null);
  const [showUnexpected, setShowUnexpected] = useState(false);

  const { hasPermission, isLoading: permsLoading } = useUserPermissions();
  const canTransition = permsLoading || hasPermission('inventory_count', 'transition');
  const canApprove = permsLoading || hasPermission('inventory_count', 'approve');
  const { lookups } = useInventoryLookups();

  const { data, isLoading, error } = useQuery({
    queryKey: ['inventory-count', id],
    queryFn: () => inventoryCountService.get(id),
    enabled: Boolean(id),
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['inventory-count', id] });
    queryClient.invalidateQueries({ queryKey: ['inventory-counts'] });
  };

  const { mutate: freeze, isPending: freezing } = useMutation({
    mutationFn: () => inventoryCountService.freeze(id),
    onSuccess: invalidate,
    onError: (err) => setActionError(apiErrorMessage(err, 'Failed to freeze count.')),
  });

  const { mutate: transition, isPending: transitioning } = useMutation({
    // CNTG and POST are refused through the generic endpoint server-side —
    // route them to freeze/post. Every other move (send to review, recount,
    // approve, cancel) goes through the generic transition.
    mutationFn: (to: string) => {
      if (to === 'POST') return inventoryCountService.post(id);
      return inventoryCountService.transition(id, to);
    },
    onSuccess: invalidate,
    onError: (err) => setActionError(apiErrorMessage(err, 'Failed to change status.')),
  });

  if (isLoading) return <div className="p-6"><Spinner label="Loading count…" /></div>;
  if (error || !data) return <div className="p-6"><ErrorNote>{apiErrorMessage(error, 'Failed to load count.')}</ErrorNote></div>;

  const { count: c, nextStatuses } = data;
  const isDraft = c.statusCode === 'DRFT';
  const isCounting = c.statusCode === 'CNTG';
  const remaining = c.lineCount - c.countedCount;

  // DRFT -> CNTG is refused through the generic transition (it's the freeze),
  // so filter it out of the server-driven button list and show a dedicated
  // "Freeze & Start Counting" action instead.
  const barStatuses = nextStatuses.filter((s) => !(isDraft && s === 'CNTG'));

  const warehouseUuid = lookups?.warehouses.find((w) => w.name === c.warehouseName)?.id ?? '';

  return (
    <div className="flex flex-col flex-1 min-h-0 bg-stone-50">
      <CrmPageHeader
        backLabel="Counts"
        onBack={() => navigate('/inventory/count')}
        icon={ClipboardCheck}
        title={c.number || 'Count'}
        subtitle={c.warehouseName}
        statusBadge={<Badge color={DOC_STATUS_COLORS[c.statusCode] ?? '#a8a29e'}>{docStatusLabel(c.statusCode)}</Badge>}
      />

      {actionError && <p className="px-5 py-2 text-xs text-destructive border-b border-red-100 bg-red-50">{actionError}</p>}

      <div className="flex flex-col lg:flex-row gap-6 px-4 py-4 sm:px-5 sm:py-5 3xl:px-12 3xl:py-8 3xl:gap-10 4xl:px-16 4xl:py-10 4xl:gap-14">
        <div className="flex-1 space-y-3 min-w-0">
          <ModernSection title="Progress" index={0}>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <ProgressStat label="Lines" value={c.lineCount} />
              <ProgressStat label="Counted" value={c.countedCount} highlight={remaining === 0 && c.lineCount > 0} />
              <ProgressStat label="Variances" value={c.varianceCount} warn={c.varianceCount > 0} />
              <ProgressStat label="Net Variance" value={c.netVariance} decimal />
            </div>
          </ModernSection>

          <ModernSection title="Header" index={1}>
            <div className="grid grid-cols-1 gap-x-5 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
              <ReadonlyField label="Warehouse" value={c.warehouseName} />
              <ReadonlyField label="Bin Scope" value={c.binPath || 'Whole warehouse'} />
              <ReadonlyField label="Date" value={c.date} />
              <ReadonlyField label="Frozen" value={c.frozenAt ? new Date(c.frozenAt).toLocaleString() : undefined} />
              {c.notes && <ReadonlyField label="Notes" value={c.notes} />}
            </div>
          </ModernSection>

          <ModernSection title={`Lines (${c.lines.length})`} index={2}>
            <div className="space-y-3">
              {isCounting && (
                <button type="button" onClick={() => setShowUnexpected(true)} className="flex items-center gap-1.5 rounded-lg border border-dashed border-stone-300 px-3 py-1.5 text-xs font-medium text-stone-500 hover:bg-stone-50">
                  <PackagePlus className="size-3.5" /> Add Unexpected Unit
                </button>
              )}
              <CountLinesGrid count={c} editable={isCounting} />
            </div>
          </ModernSection>
        </div>

        <SalesDetailSidebar label="Count Actions">
          {canTransition && isDraft && (
            <div className="rounded-xl border border-stone-200 bg-white shadow-sm p-4 mb-4">
              <button type="button" disabled={freezing} onClick={() => freeze()} className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-semibold text-stone-700 hover:bg-stone-50 disabled:opacity-50">
                <Snowflake className="size-4 text-stone-400" /> {freezing ? 'Freezing…' : 'Freeze & Start Counting'}
              </button>
            </div>
          )}

          {canTransition && !isDraft && (
            <div className="rounded-xl border border-stone-200 bg-white shadow-sm p-4 mb-4">
              {isCounting && remaining > 0 && (
                <p className="mb-2 text-2xs text-stone-400">{remaining} line(s) have not been counted yet.</p>
              )}
              <DocumentStatusBar
                statusCode={c.statusCode}
                nextStatuses={barStatuses}
                onTransition={transition}
                canTransition={canTransition}
                canApprove={canApprove}
                isPending={transitioning}
              />
            </div>
          )}
        </SalesDetailSidebar>
      </div>

      {showUnexpected && <AddUnexpectedDialog countId={id} warehouseId={warehouseUuid} onClose={() => setShowUnexpected(false)} onAdded={invalidate} />}
    </div>
  );
}

function ProgressStat({ label, value, highlight, warn, decimal }: { label: string; value: number; highlight?: boolean; warn?: boolean; decimal?: boolean }) {
  return (
    <div className="rounded-lg border border-stone-200 bg-white p-3">
      <p className="text-2xs font-semibold uppercase tracking-wide text-stone-400">{label}</p>
      <p className={`mt-1 text-lg font-bold tabular-nums ${warn ? 'text-amber-600' : highlight ? 'text-emerald-600' : 'text-stone-900'}`}>
        {decimal ? value.toFixed(2) : value}
      </p>
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
