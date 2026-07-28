import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Package, AlertCircle, Loader2, Save } from 'lucide-react';
import { inventoryService } from '@/services/inventoryService';
import { apiErrorMessage } from '@/api/tenantClient';
import { FormActionBar } from '@/components/crm/FormPrimitives';
import { CrmPageHeader } from '@/pages/crm/components/CrmPageHeader';
import { UnsavedChangesPrompt } from '@/components/UnsavedChangesPrompt';
import { useUnsavedChangesGuard } from '@/hooks/useUnsavedChangesGuard';
import { itemDefaults, toItemPayload, validateItem } from '@/lib/inventoryItemForm';
import { ItemFormBody } from './components/ItemFormBody';

export default function AddItemPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [data, setData] = useState<Record<string, unknown>>(itemDefaults);
  const [fieldErrors, setFieldErrors] = useState<string[]>([]);
  const set = (key: string, value: unknown) => setData((d) => ({ ...d, [key]: value }));

  const guard = useUnsavedChangesGuard(data);

  const { mutate: save, isPending, error: saveError } = useMutation({
    mutationFn: () => inventoryService.createItem(toItemPayload(data)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory-items'] });
      guard.markClean();
      navigate('/inventory/item');
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const errors = validateItem(data);
    if (errors.length > 0) {
      setFieldErrors(errors.map((er) => er.label));
      return;
    }
    setFieldErrors([]);
    save();
  }

  return (
    <div className="flex flex-col flex-1 min-h-0 bg-stone-50">
      <UnsavedChangesPrompt guard={guard} />
      <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
        <CrmPageHeader
          backLabel="Items"
          onBack={() => navigate('/inventory/item')}
          icon={Package}
          title="New Inventory Item"
          subtitle="Fields marked * are required."
          actions={(
            <button type="submit" disabled={isPending}
              className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-3.5 py-1.5 text-xs font-semibold text-stone-900 hover:bg-brand-hover disabled:opacity-50 transition-all shadow-sm">
              {isPending ? <Loader2 className="size-3 animate-spin" /> : <Save className="size-3" />}
              {isPending ? 'Saving…' : 'Save Item'}
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

        <FormActionBar onCancel={() => navigate('/inventory/item')} isPending={isPending} submitLabel="Save Item" />
      </form>
    </div>
  );
}
