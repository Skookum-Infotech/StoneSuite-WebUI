import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertCircle, Boxes, Loader2, Save } from 'lucide-react';
import { toast } from 'sonner';
import { inventoryService } from '@/services/inventoryService';
import { apiErrorMessage } from '@/api/tenantClient';
import { FormActionBar } from '@/components/crm/FormPrimitives';
import { CrmPageHeader } from '@/pages/crm/components/CrmPageHeader';
import { UnsavedChangesPrompt } from '@/components/UnsavedChangesPrompt';
import { KitFormBody } from '@/components/inventory/KitFormBody';
import { DangerZoneCard } from '@/components/tenant/DangerZoneCard';
import { Spinner, ErrorNote } from '@/components/tenant/ui';
import { useUnsavedChangesGuard } from '@/hooks/useUnsavedChangesGuard';
import { useScrollToError } from '@/hooks/useScrollToError';
import { useUserPermissions } from '@/hooks/useUserPermissions';
import { useBreadcrumbStore } from '@/store/useBreadcrumbStore';
import { fromKit, toKitPayload, validateKit, type KitFormState } from '@/lib/inventoryKitForm';
import { DeleteKitDialog } from './components/DeleteKitDialog';

const KITS_TAB_PATH = '/inventory/item?tab=kits';

export default function EditKitPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { hasPermission } = useUserPermissions();
  const canDelete = hasPermission('inventory_item', 'delete');

  const { data: kit, isLoading, error: loadError } = useQuery({
    queryKey: ['inventory-kit', id],
    queryFn: () => inventoryService.getKit(id),
    enabled: Boolean(id),
  });

  const mapped = useMemo(() => (kit ? fromKit(kit) : null), [kit]);
  const [localData, setLocalData] = useState<KitFormState | null>(null);
  const [fieldErrors, setFieldErrors] = useState<string[]>([]);
  const data = localData ?? mapped;
  const guard = useUnsavedChangesGuard(data, Boolean(mapped));

  const setLabel = useBreadcrumbStore((s) => s.setLabel);
  const clearLabel = useBreadcrumbStore((s) => s.clearLabel);
  useEffect(() => {
    if (kit?.name) {
      setLabel(id, kit.name);
      return () => clearLabel(id);
    }
  }, [id, kit?.name, setLabel, clearLabel]);

  const { mutate: save, isPending, error: saveError } = useMutation({
    // Whole-object write: the form always sends its full member list.
    mutationFn: () => inventoryService.updateKit(id, toKitPayload(data as KitFormState)),
    onSuccess: () => {
      toast.success('Kit saved.');
      queryClient.invalidateQueries({ queryKey: ['inventory-kits'] });
      queryClient.invalidateQueries({ queryKey: ['inventory-kit', id] });
      queryClient.invalidateQueries({ queryKey: ['inventory-kit-picker'] });
      guard.markClean();
      navigate(KITS_TAB_PATH);
    },
  });
  const errorRef = useScrollToError<HTMLDivElement>(saveError || fieldErrors.length > 0);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!data) return;
    const errors = validateKit(data);
    if (errors.length > 0) {
      setFieldErrors(errors.map((er) => er.label));
      return;
    }
    setFieldErrors([]);
    save();
  }

  if (loadError) return <div className="p-6"><ErrorNote>{apiErrorMessage(loadError, 'Failed to load kit.')}</ErrorNote></div>;
  if (isLoading || !data) return <div className="p-6"><Spinner label="Loading kit…" /></div>;

  return (
    <div className="flex flex-col flex-1 min-h-0 bg-stone-50">
      <UnsavedChangesPrompt guard={guard} />
      <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
        <CrmPageHeader
          backLabel="Kits"
          onBack={() => navigate(KITS_TAB_PATH)}
          icon={Boxes}
          title={kit?.name || 'Edit Kit'}
          subtitle="Fields marked * are required."
          actions={(
            <button type="submit" disabled={isPending}
              className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-3.5 py-1.5 text-xs font-semibold text-stone-900 hover:bg-brand-hover disabled:opacity-50 transition-all shadow-sm">
              {isPending ? <Loader2 className="size-3 animate-spin" /> : <Save className="size-3" />}
              {isPending ? 'Saving…' : 'Save Changes'}
            </button>
          )}
        />

        {(saveError || fieldErrors.length > 0) && (
          <div
            ref={errorRef}
            tabIndex={-1}
            role="alert"
            className="shrink-0 flex items-start gap-3 border-b border-red-200 bg-red-50 px-5 py-2.5 focus-visible:ring-2 focus-visible:ring-red-400 focus-visible:ring-inset"
          >
            <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-red-100">
              <AlertCircle className="size-3 text-red-600" />
            </span>
            <p className="text-xs text-red-700">
              <span className="font-bold">Error: </span>
              {saveError
                ? apiErrorMessage(saveError, 'Failed to save kit.')
                : `Please fix: ${fieldErrors.join(', ')}.`}
            </p>
          </div>
        )}

        <div className="flex-1 overflow-y-auto modal-scrollbar">
          <div className="px-4 py-3 pb-24 space-y-2 3xl:px-10 3xl:py-5 4xl:px-16 4xl:py-8">
            <KitFormBody data={data} onChange={setLocalData} />
            {canDelete && (
              <DangerZoneCard>
                <DeleteKitDialog
                  kitId={id}
                  label={kit?.name ?? 'this kit'}
                  onDeleted={() => {
                    guard.markClean();
                    queryClient.invalidateQueries({ queryKey: ['inventory-kits'] });
                    queryClient.invalidateQueries({ queryKey: ['inventory-kit-picker'] });
                    navigate(KITS_TAB_PATH);
                  }}
                />
              </DangerZoneCard>
            )}
          </div>
        </div>

        <FormActionBar onCancel={() => navigate(KITS_TAB_PATH)} isPending={isPending} submitLabel="Save Changes" />
      </form>
    </div>
  );
}
