import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ClipboardPlus } from 'lucide-react';
import { toast } from 'sonner';
import { UnsavedChangesPrompt } from '@/components/UnsavedChangesPrompt';
import { ErrorNote } from '@/components/tenant/ui';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { useScrollToError } from '@/hooks/useScrollToError';
import { useUnsavedChangesGuard } from '@/hooks/useUnsavedChangesGuard';
import {
  copyStone,
  countErrors,
  createdOrderDefaults,
  newAreaDraft,
  stoneSource,
  toCreatePayload,
  validateCreatedOrder,
} from '@/lib/createdOrderForm';
import type { AreaDraft, CreatedOrderErrors, CreatedOrderFormState, HeaderField } from '@/lib/createdOrderForm';
import { CREATED_ORDERS_PATH } from '@/lib/createdOrderRoutes';
import { createdOrderService, createOrderErrorMessage } from '@/services/createdOrderService';
import type { AreaKind } from '@/types/createdOrder';
import { CrmPageHeader } from '@/pages/crm/components/CrmPageHeader';
import { AreaCard } from './components/AreaCard';
import type { AreaCardActions } from './components/AreaCard';
import { AreaPicker } from './components/AreaPicker';
import { FormSection } from './components/FormSection';
import { OrderDetailsSection } from './components/OrderDetailsSection';
import { OrderSummaryPanel } from './components/OrderSummaryPanel';

// Tailwind's `xl` breakpoint, in the same rem unit as the page's own classes so
// the summary card and the layout columns flip at exactly the same width.
const WIDE_LAYOUT_QUERY = '(min-width: 80rem)';

const NO_ERRORS: CreatedOrderErrors = { header: {}, areas: {} };

export default function AddCreatedOrderPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isWide = useMediaQuery(WIDE_LAYOUT_QUERY);
  const formRef = useRef<HTMLFormElement>(null);
  const areaKeySeq = useRef(0);

  const [form, setForm] = useState<CreatedOrderFormState>(createdOrderDefaults);
  const [lastAddedKey, setLastAddedKey] = useState<string | null>(null);
  // Errors stay hidden until the first Submit press, then track live — a blank
  // form should not open covered in red.
  const [submitAttempts, setSubmitAttempts] = useState(0);

  const guard = useUnsavedChangesGuard(form);
  const errors = useMemo(() => validateCreatedOrder(form), [form]);
  const errorCount = countErrors(errors);
  const shownErrors = submitAttempts > 0 ? errors : NO_ERRORS;

  const { mutate: submit, isPending, error: submitError } = useMutation({
    mutationFn: createdOrderService.create,
    onSuccess: () => {
      guard.markClean();
      void queryClient.invalidateQueries({ queryKey: ['created-orders'] });
      toast.success('Order submitted');
      navigate(CREATED_ORDERS_PATH);
    },
  });
  const errorBannerRef = useScrollToError(submitError);

  // After a failed Submit, take the customer to the first thing to fix.
  useEffect(() => {
    if (submitAttempts === 0) return;
    const target =
      formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]') ??
      formRef.current?.querySelector<HTMLElement>('[role="alert"]');
    target?.scrollIntoView?.({ block: 'center' });
    target?.focus?.();
  }, [submitAttempts]);

  const setHeader = useCallback((field: HeaderField, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  }, []);

  const addArea = useCallback((kind: AreaKind) => {
    areaKeySeq.current += 1;
    const key = `area-${areaKeySeq.current}`;
    setForm((prev) => ({ ...prev, areas: [...prev.areas, newAreaDraft(kind, key, prev.areas)] }));
    setLastAddedKey(key);
  }, []);

  const areaActions: AreaCardActions = useMemo(
    () => ({
      onFieldChange: (areaKey, field, value) =>
        setForm((prev) => ({
          ...prev,
          areas: prev.areas.map((area) => (area.key === areaKey ? { ...area, [field]: value } : area)),
        })),
      onRemove: (areaKey) =>
        setForm((prev) => ({ ...prev, areas: prev.areas.filter((area) => area.key !== areaKey) })),
      onCopyStone: (areaKey) =>
        setForm((prev) => {
          const source = stoneSource(prev.areas, areaKey);
          if (!source) return prev;
          return { ...prev, areas: prev.areas.map((area) => (area.key === areaKey ? copyStone(source, area) : area)) };
        }),
    }),
    [],
  );

  const handleSubmit = (event: FormEvent): void => {
    event.preventDefault();
    if (isPending) return;
    setSubmitAttempts((n) => n + 1);
    if (errorCount > 0) return;
    submit(toCreatePayload(form));
  };

  const summary = (
    <OrderSummaryPanel
      form={form}
      errorCount={errorCount}
      isSubmitting={isPending}
      layout={isWide ? 'card' : 'bar'}
      onCancel={() => navigate(CREATED_ORDERS_PATH)}
    />
  );

  return (
    <div className="flex flex-1 flex-col min-h-0">
      <CrmPageHeader
        backLabel="Created Orders"
        onBack={() => navigate(CREATED_ORDERS_PATH)}
        icon={ClipboardPlus}
        title="New Order"
        subtitle="Countertop order form"
      />

      <form
        ref={formRef}
        noValidate
        onSubmit={handleSubmit}
        aria-label="New countertop order"
        className="flex-1 p-4 pb-28 sm:p-6 xl:pb-6 3xl:p-10 4xl:p-14"
      >
        <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
          <div className="space-y-6">
            {submitError && (
              <div ref={errorBannerRef} tabIndex={-1} className="outline-none">
                <ErrorNote>{createOrderErrorMessage(submitError)}</ErrorNote>
              </div>
            )}

            <FormSection
              step={1}
              title="Project details"
              description="Who the order is for and where and when the work happens."
            >
              <OrderDetailsSection form={form} errors={shownErrors.header} onChange={setHeader} />
            </FormSection>

            <FormSection
              step={2}
              title="Areas"
              description="Add each area of the house this order covers — only the ones you need."
            >
              <div className="space-y-5">
                <AreaPicker areas={form.areas} onAdd={addArea} />
                {shownErrors.noAreas && (
                  <p role="alert" className="text-xs font-medium text-red-600">
                    {shownErrors.noAreas}
                  </p>
                )}
                {form.areas.length > 0 && (
                  <div className="space-y-3">
                    {form.areas.map((area: AreaDraft) => (
                      <AreaCard
                        key={area.key}
                        area={area}
                        errors={shownErrors.areas[area.key]}
                        copyFromName={stoneSource(form.areas, area.key)?.name}
                        actions={areaActions}
                        isNew={area.key === lastAddedKey}
                      />
                    ))}
                  </div>
                )}
              </div>
            </FormSection>
          </div>

          {summary}
        </div>
      </form>

      <UnsavedChangesPrompt guard={guard} />
    </div>
  );
}
