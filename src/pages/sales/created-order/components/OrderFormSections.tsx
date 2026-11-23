import { stoneSource } from '@/lib/createdOrderForm';
import type { AreaDraft } from '@/lib/createdOrderForm';
import type { CreatedOrderDraft } from '@/hooks/useCreatedOrderDraft';
import { AreaCard } from './AreaCard';
import { AreaPicker } from './AreaPicker';
import { FormSection } from './FormSection';
import { OrderDetailsSection } from './OrderDetailsSection';

interface OrderFormSectionsProps {
  draft: CreatedOrderDraft;
}

// The two steps of the countertop order form — project details, then areas —
// as one block, so the customer's page and the tenant-side modal edit the very
// same fields.
export function OrderFormSections({ draft }: OrderFormSectionsProps) {
  const { form, shownErrors, lastAddedKey, setHeader, addArea, areaActions } = draft;

  return (
    <>
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
    </>
  );
}
