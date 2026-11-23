import { useEffect, useRef } from 'react';
import type { FormEvent } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { apiErrorMessage } from '@/api/tenantClient';
import { ErrorNote } from '@/components/tenant/ui';
import { useCreatedOrderDraft } from '@/hooks/useCreatedOrderDraft';
import { OrderFormSections } from '@/pages/sales/created-order/components/OrderFormSections';
import { salesOrderService } from '@/services/salesOrderService';
import type { CreatedOrder, CreatedOrderInput } from '@/types/createdOrder';

interface CustomerOrderFormEditorProps {
  orderId: string;
  form: CreatedOrder;
  /** Whether the Sales Order is still a Draft, which decides whether a save
   *  reaches its lines. */
  isDraft: boolean;
  onCancel: () => void;
  onSaved: () => void;
}

const DRAFT_NOTE =
  "Saving also updates this sales order's lines to match, keeping what has already been done to them.";
const MOVED_ON_NOTE =
  "This sales order is no longer a draft, so saving changes the customer's order form only. The sales order's own lines are left as they are.";

// The same fields the customer fills in, for a super admin to correct from the
// Sales Order. Saved through the tenant route, which re-checks the role.
export function CustomerOrderFormEditor({ orderId, form, isDraft, onCancel, onSaved }: CustomerOrderFormEditorProps) {
  const queryClient = useQueryClient();
  const formRef = useRef<HTMLFormElement>(null);
  const draft = useCreatedOrderDraft(form);

  const save = useMutation({
    mutationFn: (payload: CreatedOrderInput) => salesOrderService.updateCustomerOrderForm(orderId, payload),
    onSuccess: ({ synced }) => {
      // The order's lines, memo and schedule may all have changed with it.
      void queryClient.invalidateQueries({ queryKey: ['sales-order', orderId] });
      toast.success(
        synced
          ? 'Customer order form saved. The sales order was updated to match.'
          : 'Customer order form saved.',
      );
      onSaved();
    },
  });

  // After a failed Save, take them to the first thing to fix.
  useEffect(() => {
    if (draft.attempts === 0) return;
    const target =
      formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]') ??
      formRef.current?.querySelector<HTMLElement>('[role="alert"]');
    target?.scrollIntoView?.({ block: 'center' });
    target?.focus?.();
  }, [draft.attempts]);

  const handleSubmit = (event: FormEvent): void => {
    event.preventDefault();
    if (save.isPending) return;
    if (!draft.attempt()) return;
    save.mutate(draft.payload());
  };

  return (
    <form
      ref={formRef}
      noValidate
      onSubmit={handleSubmit}
      aria-label="Edit customer order form"
      className="flex min-h-0 flex-1 flex-col"
    >
      <div className="min-h-0 flex-1 space-y-6 overflow-y-auto p-5">
        <p role="note" className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900">
          {isDraft ? DRAFT_NOTE : MOVED_ON_NOTE}
        </p>
        {save.isError && (
          <ErrorNote>{apiErrorMessage(save.error, 'We could not save the customer order form.')}</ErrorNote>
        )}
        <OrderFormSections draft={draft} />
      </div>

      <div className="flex shrink-0 items-center justify-between gap-3 border-t border-stone-200 bg-white px-5 py-3">
        <p role="status" className="text-xs text-stone-500">
          {draft.errorCount === 0
            ? 'Everything required is filled in.'
            : `${draft.errorCount} required ${draft.errorCount === 1 ? 'item' : 'items'} still to fill in.`}
        </p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={save.isPending}
            className="rounded-lg border border-stone-200 bg-white px-3 py-2 text-xs font-medium text-stone-600 hover:bg-stone-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={save.isPending}
            className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-4 py-2 text-xs font-semibold text-stone-950 shadow-sm transition hover:bg-brand-hover active:scale-95 disabled:opacity-60"
          >
            {save.isPending && <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />}
            {save.isPending ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      </div>
    </form>
  );
}
