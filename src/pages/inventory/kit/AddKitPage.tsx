import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { AlertCircle, Boxes, Loader2, Save } from 'lucide-react';
import { toast } from 'sonner';
import { inventoryService } from '@/services/inventoryService';
import { apiErrorMessage } from '@/api/tenantClient';
import { FormActionBar } from '@/components/crm/FormPrimitives';
import { CrmPageHeader } from '@/pages/crm/components/CrmPageHeader';
import { UnsavedChangesPrompt } from '@/components/UnsavedChangesPrompt';
import { KitFormBody } from '@/components/inventory/KitFormBody';
import { useUnsavedChangesGuard } from '@/hooks/useUnsavedChangesGuard';
import { useScrollToError } from '@/hooks/useScrollToError';
import { kitDefaults, toKitPayload, validateKit } from '@/lib/inventoryKitForm';
import {
  ITEM_NAME_PARAM, RETURN_TO_PARAM, isSafeReturnPath, kitReturnRouterState,
} from '@/lib/inventoryItemReturn';
import type { InventoryKit } from '@/types/inventory';

const KITS_TAB_PATH = '/inventory/item?tab=kits';

export default function AddKitPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Opened from a document line's picker ("Add as a Kit"): the typed name is
  // prefilled, and saving or cancelling returns to that document, which adds
  // the kit's lines (see lib/inventoryItemReturn.ts).
  const [searchParams] = useSearchParams();
  const returnParam = searchParams.get(RETURN_TO_PARAM);
  const returnTo = isSafeReturnPath(returnParam) ? returnParam : null;

  const [data, setData] = useState(() => kitDefaults(searchParams.get(ITEM_NAME_PARAM) ?? ''));
  const [fieldErrors, setFieldErrors] = useState<string[]>([]);
  const guard = useUnsavedChangesGuard(data);

  const leave = (created: InventoryKit | null) => {
    if (returnTo) navigate(returnTo, { state: kitReturnRouterState(created) });
    else navigate(KITS_TAB_PATH);
  };

  const { mutate: save, isPending, error: saveError } = useMutation({
    mutationFn: () => inventoryService.createKit(toKitPayload(data)),
    onSuccess: (kit) => {
      toast.success(returnTo ? 'Kit created. Its items are being added to your document.' : 'Kit created.');
      queryClient.invalidateQueries({ queryKey: ['inventory-kits'] });
      queryClient.invalidateQueries({ queryKey: ['inventory-kit-picker'] });
      guard.markClean();
      leave(kit);
    },
  });
  const errorRef = useScrollToError<HTMLDivElement>(saveError || fieldErrors.length > 0);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const errors = validateKit(data);
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
          backLabel={returnTo ? 'Back' : 'Kits'}
          onBack={() => leave(null)}
          icon={Boxes}
          title="New Kit"
          subtitle={returnTo
            ? "Fields marked * are required. You'll go back to your document after saving."
            : 'Fields marked * are required.'}
          actions={(
            <button type="submit" disabled={isPending}
              className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-3.5 py-1.5 text-xs font-semibold text-stone-900 hover:bg-brand-hover disabled:opacity-50 transition-all shadow-sm">
              {isPending ? <Loader2 className="size-3 animate-spin" /> : <Save className="size-3" />}
              {isPending ? 'Saving…' : 'Save Kit'}
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
            <KitFormBody data={data} onChange={setData} />
          </div>
        </div>

        <FormActionBar onCancel={() => leave(null)} isPending={isPending} submitLabel="Save Kit" />
      </form>
    </div>
  );
}
