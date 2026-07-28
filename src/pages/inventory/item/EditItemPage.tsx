import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Package, AlertCircle, Loader2, Save } from 'lucide-react';
import { inventoryService } from '@/services/inventoryService';
import { apiErrorMessage } from '@/api/tenantClient';
import { FormActionBar } from '@/components/crm/FormPrimitives';
import { CrmPageHeader } from '@/pages/crm/components/CrmPageHeader';
import { UnsavedChangesPrompt } from '@/components/UnsavedChangesPrompt';
import { useUnsavedChangesGuard } from '@/hooks/useUnsavedChangesGuard';
import { Spinner, ErrorNote } from '@/components/tenant/ui';
import { useBreadcrumbStore } from '@/store/useBreadcrumbStore';
import { fromItem, toItemPayload, validateItem } from '@/lib/inventoryItemForm';
import { ItemFormBody } from './components/ItemFormBody';

export default function EditItemPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: item, isLoading, error: loadError } = useQuery({
    queryKey: ['inventory-item', id],
    queryFn: () => inventoryService.getItem(id),
    enabled: Boolean(id),
  });

  const mapped = useMemo(() => (item ? fromItem(item) : null), [item]);
  const [localData, setLocalData] = useState<Record<string, unknown> | null>(null);
  const [fieldErrors, setFieldErrors] = useState<string[]>([]);
  const data = localData ?? mapped;

  const set = useCallback(
    (key: string, value: unknown) => setLocalData((prev) => ({ ...(prev ?? mapped ?? {}), [key]: value })),
    [mapped],
  );

  const guard = useUnsavedChangesGuard(data, Boolean(mapped));

  const setLabel = useBreadcrumbStore((s) => s.setLabel);
  const clearLabel = useBreadcrumbStore((s) => s.clearLabel);
  useEffect(() => {
    if (item?.name) {
      setLabel(id, item.name);
      return () => clearLabel(id);
    }
  }, [id, item?.name, setLabel, clearLabel]);

  const { mutate: save, isPending, error: saveError } = useMutation({
    // PATCH has PUT semantics server-side — toItemPayload always builds the
    // whole object, so nothing an earlier form section touched gets cleared.
    mutationFn: () => inventoryService.updateItem(id, toItemPayload(data ?? {})),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory-items'] });
      queryClient.invalidateQueries({ queryKey: ['inventory-item', id] });
      guard.markClean();
      navigate(`/inventory/item/${id}`);
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!data) return;
    const errors = validateItem(data);
    if (errors.length > 0) {
      setFieldErrors(errors.map((er) => er.label));
      return;
    }
    setFieldErrors([]);
    save();
  }

  if (isLoading || !data) return <div className="p-6"><Spinner label="Loading item…" /></div>;
  if (loadError) return <div className="p-6"><ErrorNote>{apiErrorMessage(loadError, 'Failed to load item.')}</ErrorNote></div>;

  return (
    <div className="flex flex-col flex-1 min-h-0 bg-stone-50">
      <UnsavedChangesPrompt guard={guard} />
      <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
        <CrmPageHeader
          backLabel="Items"
          onBack={() => navigate(`/inventory/item/${id}`)}
          icon={Package}
          title={item?.name || 'Edit Item'}
          subtitle="Fields marked * are required."
          recordNumber={item?.sku}
          actions={(
            <button type="submit" disabled={isPending}
              className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-3.5 py-1.5 text-xs font-semibold text-stone-900 hover:bg-brand-hover disabled:opacity-50 transition-all shadow-sm">
              {isPending ? <Loader2 className="size-3 animate-spin" /> : <Save className="size-3" />}
              {isPending ? 'Saving…' : 'Save Changes'}
            </button>
          )}
        />

        {(saveError || fieldErrors.length > 0) && (
          <div className="shrink-0 flex items-start gap-3 border-b border-red-200 bg-red-50 px-5 py-2.5">
            <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-red-100">
              <AlertCircle className="size-3 text-red-600" />
            </span>
            <p className="text-xs text-red-700">
              <span className="font-bold">Error: </span>
              {saveError ? apiErrorMessage(saveError, 'Failed to save item.') : `Missing required field(s): ${fieldErrors.join(', ')}.`}
            </p>
          </div>
        )}

        <div className="flex-1 overflow-y-auto modal-scrollbar">
          <div className="px-4 py-3 pb-24 space-y-2 3xl:px-10 3xl:py-5 4xl:px-16 4xl:py-8">
            <ItemFormBody data={data} set={set} />
          </div>
        </div>

        <FormActionBar onCancel={() => navigate(`/inventory/item/${id}`)} isPending={isPending} submitLabel="Save Changes" />
      </form>
    </div>
  );
}
