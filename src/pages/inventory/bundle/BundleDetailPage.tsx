import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { Boxes, X, Lock, Unlock, ArrowLeftRight } from 'lucide-react';
import { inventoryBundleService } from '@/services/inventoryBundleService';
import { apiErrorMessage } from '@/api/tenantClient';
import { Spinner, ErrorNote, Badge } from '@/components/tenant/ui';
import { ModernSection } from '@/components/crm/FormPrimitives';
import { readonlyCls, fieldLabelCls } from '@/components/crm/formUtils';
import { CrmPageHeader } from '@/pages/crm/components/CrmPageHeader';
import { SalesDetailSidebar } from '@/pages/sales/components/SalesDetailSidebar';
import { useBreadcrumbStore } from '@/store/useBreadcrumbStore';
import { useUserPermissions } from '@/hooks/useUserPermissions';
import { BinPicker } from '@/components/inventory/BinPicker';
import { inventoryBinService } from '@/services/inventoryBinService';
import { BUNDLE_OPEN, BUNDLE_SEALED } from '@/types/inventory';
import { AddBundleMemberPanel } from './components/AddBundleMemberPanel';

const STATUS_COLORS: Record<string, string> = { open: '#22c55e', sealed: '#3b82f6', broken: '#a8a29e' };

export default function BundleDetailPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [showMoveBin, setShowMoveBin] = useState(false);
  const [moveBinId, setMoveBinId] = useState('');

  const { hasPermission, isLoading: permsLoading } = useUserPermissions();
  const canUpdate = permsLoading || hasPermission('inventory_bundle', 'update');

  const { data: bundle, isLoading, error } = useQuery({
    queryKey: ['inventory-bundle', id],
    queryFn: () => inventoryBundleService.getBundle(id),
    enabled: Boolean(id),
  });

  const { data: members = [] } = useQuery({
    queryKey: ['inventory-bundle-members', id],
    queryFn: () => inventoryBundleService.getMembers(id),
    enabled: Boolean(id),
  });

  const { data: bins = [] } = useQuery({ queryKey: ['inventory-bins-tree-all'], queryFn: () => inventoryBinService.getTree() });

  const setLabel = useBreadcrumbStore((s) => s.setLabel);
  const clearLabel = useBreadcrumbStore((s) => s.clearLabel);
  useEffect(() => {
    if (bundle?.code) {
      setLabel(id, bundle.code);
      return () => clearLabel(id);
    }
  }, [id, bundle?.code, setLabel, clearLabel]);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['inventory-bundle', id] });
    queryClient.invalidateQueries({ queryKey: ['inventory-bundle-members', id] });
  };

  const { mutate: removeMember, error: removeError } = useMutation({
    mutationFn: (unitId: string) => inventoryBundleService.removeMembers(id, { memberIds: [unitId] }),
    onSuccess: invalidate,
  });
  const { mutate: seal, isPending: sealing, error: sealError } = useMutation({
    mutationFn: () => inventoryBundleService.seal(id),
    onSuccess: invalidate,
  });
  const { mutate: breakBundle, isPending: breaking, error: breakError } = useMutation({
    mutationFn: () => inventoryBundleService.break(id),
    onSuccess: invalidate,
  });
  const { mutate: moveBin, isPending: moving, error: moveError } = useMutation({
    mutationFn: () => inventoryBundleService.moveBin(id, { binId: moveBinId || null }),
    onSuccess: () => { invalidate(); setShowMoveBin(false); },
  });

  if (isLoading) return <div className="p-6"><Spinner label="Loading bundle…" /></div>;
  if (error || !bundle) return <div className="p-6"><ErrorNote>{apiErrorMessage(error, 'Failed to load bundle.')}</ErrorNote></div>;

  const isOpen = bundle.status === BUNDLE_OPEN;
  const isSealed = bundle.status === BUNDLE_SEALED;

  return (
    <div className="flex flex-col flex-1 min-h-0 bg-stone-50">
      <CrmPageHeader
        backLabel="Bundles"
        onBack={() => navigate('/inventory/bundle')}
        icon={Boxes}
        title={bundle.code}
        subtitle={bundle.inventoryItemName || 'No item adopted yet'}
        statusBadge={<Badge color={STATUS_COLORS[bundle.status] ?? '#a8a29e'}>{bundle.status}</Badge>}
      />

      <div className="flex flex-col lg:flex-row gap-6 px-4 py-4 sm:px-5 sm:py-5 3xl:px-12 3xl:py-8 3xl:gap-10 4xl:px-16 4xl:py-10 4xl:gap-14">
        <div className="flex-1 space-y-3 min-w-0">
          {bundle.status === 'broken' && (
            <div className="flex items-start gap-3 rounded-lg border border-stone-200 bg-stone-100 px-4 py-3">
              <Lock className="mt-0.5 size-4 shrink-0 text-stone-400" />
              <p className="text-xs text-stone-600">This bundle is broken and read-only. Re-banding these slabs means creating a new bundle.</p>
            </div>
          )}

          <ModernSection title="Bundle Information" index={0}>
            <div className="grid grid-cols-1 gap-x-5 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
              <ReadonlyField label="Item" value={bundle.inventoryItemName} />
              <ReadonlyField label="Warehouse" value={bundle.warehouseName} />
              <ReadonlyField label="Bin" value={bundle.binPath} />
              <ReadonlyField label="Block ID" value={bundle.blockId} />
              <ReadonlyField label="Lot" value={bundle.lot} />
              <ReadonlyField label="Total Area" value={`${bundle.totalArea.toFixed(2)} sq`} />
            </div>
          </ModernSection>

          <ModernSection title={`Members (${members.length})`} index={1}>
            <div className="space-y-2">
              {members.length === 0 && <p className="text-xs text-stone-400">No members yet.</p>}
              {members.map((u) => (
                <div key={u.id} className="flex items-center justify-between rounded-lg border border-stone-200 px-3 py-2">
                  <button type="button" onClick={() => navigate(`/inventory/unit/${u.id}`)} className="text-xs font-medium text-stone-800 hover:text-accent-foreground">
                    {u.serial} <span className="text-stone-400">· {u.area.toFixed(2)} sq</span>
                  </button>
                  {isOpen && canUpdate && (
                    <button type="button" onClick={() => removeMember(u.id)} aria-label={`Remove ${u.serial} from bundle`} className="rounded p-1 text-stone-400 hover:bg-destructive/10 hover:text-destructive">
                      <X className="size-3.5" />
                    </button>
                  )}
                </div>
              ))}
              {removeError && <p className="text-2xs text-destructive">{apiErrorMessage(removeError, 'Failed to remove member.')}</p>}
              {isOpen && canUpdate && <AddBundleMemberPanel bundle={bundle} onAdded={invalidate} />}
            </div>
          </ModernSection>

          <div className="h-6" />
        </div>

        <SalesDetailSidebar label="Bundle Actions">
          {canUpdate && (
            <div className="rounded-xl border border-stone-200 bg-white shadow-sm p-4 space-y-2 mb-4">
              <p className="text-xs font-semibold text-stone-400 mb-1">Lifecycle</p>
              {isOpen && (
                <button type="button" disabled={sealing || members.length === 0} onClick={() => seal()} className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-xs text-stone-700 hover:bg-stone-50 disabled:opacity-40 disabled:cursor-not-allowed">
                  <Lock className="size-4 text-stone-400" /> {sealing ? 'Sealing…' : 'Seal'}
                </button>
              )}
              {isSealed && (
                <>
                  <button type="button" disabled={breaking} onClick={() => breakBundle()} className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-xs text-stone-700 hover:bg-stone-50 disabled:opacity-40">
                    <Unlock className="size-4 text-stone-400" /> {breaking ? 'Breaking…' : 'Break'}
                  </button>
                  <button type="button" onClick={() => setShowMoveBin((v) => !v)} className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-xs text-stone-700 hover:bg-stone-50">
                    <ArrowLeftRight className="size-4 text-stone-400" /> Move (whole pallet)
                  </button>
                  {showMoveBin && (
                    <div className="space-y-2 rounded-lg border border-stone-200 p-2.5">
                      <BinPicker bins={bins} value={moveBinId} onChange={setMoveBinId} label="Bin" allowEmpty emptyLabel="— Unbin —" />
                      <button type="button" disabled={moving} onClick={() => moveBin()} className="w-full rounded-lg bg-brand px-3 py-1.5 text-xs font-semibold text-stone-950 hover:bg-brand-hover disabled:opacity-50">
                        {moving ? 'Moving…' : 'Confirm Move'}
                      </button>
                      {moveError && <p className="text-2xs text-destructive">{apiErrorMessage(moveError, 'Failed to move bundle.')}</p>}
                    </div>
                  )}
                </>
              )}
              {sealError && <p className="text-2xs text-destructive">{apiErrorMessage(sealError, 'Failed to seal bundle.')}</p>}
              {breakError && <p className="text-2xs text-destructive">{apiErrorMessage(breakError, 'Failed to break bundle.')}</p>}
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
