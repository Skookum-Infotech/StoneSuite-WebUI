import { cityZipLabel } from '@/lib/createdOrderDisplay';
import { formatDateValue, LIST_DATE_OPTIONS } from '@/lib/dateUtils';
import type { CreatedOrder } from '@/types/createdOrder';
import { AreaDetailCard } from './AreaDetailCard';
import { DetailField } from './DetailField';

const DATE_LOCALE = 'en-US';

function shownDate(value: string): string {
  return formatDateValue(value, DATE_LOCALE, LIST_DATE_OPTIONS) || '—';
}

interface CreatedOrderDetailsProps {
  order: CreatedOrder;
}

// A filed order, read-only: the project details and every area exactly as the
// customer filed them. One component, so the customer's own detail page and the
// tenant-side Sales Order modal can never show different things.
export function CreatedOrderDetails({ order }: CreatedOrderDetailsProps) {
  const address = [order.installAddress, cityZipLabel(order.city, order.zip)].filter(Boolean).join(', ');

  return (
    <>
      <section
        aria-labelledby="order-project-details"
        className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm sm:p-6"
      >
        <h2 id="order-project-details" className="text-base font-semibold text-stone-900">
          Project details
        </h2>
        <dl className="mt-4 grid gap-x-6 gap-y-4 sm:grid-cols-2 xl:grid-cols-3">
          <DetailField label="Builder">{order.builder}</DetailField>
          <DetailField label="Community">{order.community}</DetailField>
          <DetailField label="Plan">{order.plan || '—'}</DetailField>
          <DetailField label="Phone">{order.phone}</DetailField>
          <DetailField label="Email">{order.email}</DetailField>
          <DetailField label="Submitted">{shownDate(order.createdAt)}</DetailField>
          {order.updatedAt && <DetailField label="Last changed">{shownDate(order.updatedAt)}</DetailField>}
          <DetailField label="Install address">{address}</DetailField>
          <DetailField label="Measure date">{shownDate(order.measureDate)}</DetailField>
          <DetailField label="Install date">{shownDate(order.installDate)}</DetailField>
        </dl>
        {order.specialInstructions.trim() && (
          <div className="mt-5 border-t border-stone-100 pt-4">
            <p className="text-label font-semibold uppercase tracking-wide text-stone-500">
              Special instructions
            </p>
            <p className="mt-0.5 whitespace-pre-wrap break-words text-sm text-stone-800">
              {order.specialInstructions}
            </p>
          </div>
        )}
      </section>

      <section aria-labelledby="order-areas" className="space-y-3">
        <h2 id="order-areas" className="text-base font-semibold text-stone-900">
          Areas ({order.areas.length})
        </h2>
        {order.areas.map((area) => (
          <AreaDetailCard key={area.name} area={area} />
        ))}
      </section>
    </>
  );
}
