import { useEffect, useRef } from 'react';
import type { FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ClipboardPlus } from 'lucide-react';
import { toast } from 'sonner';
import { UnsavedChangesPrompt } from '@/components/UnsavedChangesPrompt';
import { ErrorNote } from '@/components/tenant/ui';
import { useCreatedOrderDraft } from '@/hooks/useCreatedOrderDraft';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { useScrollToError } from '@/hooks/useScrollToError';
import { useUnsavedChangesGuard } from '@/hooks/useUnsavedChangesGuard';
import { CREATED_ORDERS_PATH, createdOrderPath } from '@/lib/createdOrderRoutes';
import { createdOrderService, createOrderErrorMessage } from '@/services/createdOrderService';
import type { CreatedOrder, CreatedOrderInput } from '@/types/createdOrder';
import { CrmPageHeader } from '@/pages/crm/components/CrmPageHeader';
import { OrderFormSections } from './OrderFormSections';
import { OrderSummaryPanel } from './OrderSummaryPanel';
import type { SummaryLabels } from './OrderSummaryPanel';

// Tailwind's `xl` breakpoint, in the same rem unit as the page's own classes so
// the summary card and the layout columns flip at exactly the same width.
const WIDE_LAYOUT_QUERY = '(min-width: 80rem)';

const PLACE_LABELS: SummaryLabels = { submit: 'Submit order', submitting: 'Submitting…' };
const CHANGE_LABELS: SummaryLabels = { submit: 'Save changes', submitting: 'Saving…' };

interface CreatedOrderFormProps {
  /** The order being changed; omit it to place a new one. */
  order?: CreatedOrder;
}

// The countertop order form, used to place an order and to change one that is
// still a draft with the fabricator. Changing starts from the saved order and
// sends the whole of it back, as the server replaces the order as a unit.
export function CreatedOrderForm({ order }: CreatedOrderFormProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isWide = useMediaQuery(WIDE_LAYOUT_QUERY);
  const formRef = useRef<HTMLFormElement>(null);
  const changing = order !== undefined;
  // Where Cancel and the back button go: the order itself when changing it.
  const backPath = order ? createdOrderPath(order.id) : CREATED_ORDERS_PATH;

  const draft = useCreatedOrderDraft(order);
  const guard = useUnsavedChangesGuard(draft.form);

  const { mutate: submit, isPending, error: submitError } = useMutation({
    mutationFn: (payload: CreatedOrderInput) =>
      order ? createdOrderService.update(order.id, payload) : createdOrderService.create(payload),
    onSuccess: () => {
      guard.markClean();
      void queryClient.invalidateQueries({ queryKey: ['created-orders'] });
      toast.success(changing ? 'Order updated' : 'Order submitted');
      navigate(backPath);
    },
  });
  const errorBannerRef = useScrollToError(submitError);

  // After a failed Submit, take the customer to the first thing to fix.
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
    if (isPending) return;
    if (!draft.attempt()) return;
    submit(draft.payload());
  };

  return (
    <div className="flex flex-1 flex-col min-h-0">
      <CrmPageHeader
        backLabel={changing ? 'Order' : 'Created Orders'}
        onBack={() => navigate(backPath)}
        icon={ClipboardPlus}
        title={changing ? 'Edit Order' : 'New Order'}
        subtitle="Countertop order form"
      />

      <form
        ref={formRef}
        noValidate
        onSubmit={handleSubmit}
        aria-label={changing ? 'Edit countertop order' : 'New countertop order'}
        className="flex-1 p-4 pb-28 sm:p-6 xl:pb-6 3xl:p-10 4xl:p-14"
      >
        <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
          <div className="space-y-6">
            {submitError && (
              <div ref={errorBannerRef} tabIndex={-1} className="outline-none">
                <ErrorNote>{createOrderErrorMessage(submitError, changing)}</ErrorNote>
              </div>
            )}
            <OrderFormSections draft={draft} />
          </div>

          <OrderSummaryPanel
            form={draft.form}
            status={{ errorCount: draft.errorCount, isSubmitting: isPending }}
            layout={isWide ? 'card' : 'bar'}
            labels={changing ? CHANGE_LABELS : PLACE_LABELS}
            onCancel={() => navigate(backPath)}
          />
        </div>
      </form>

      <UnsavedChangesPrompt guard={guard} />
    </div>
  );
}
