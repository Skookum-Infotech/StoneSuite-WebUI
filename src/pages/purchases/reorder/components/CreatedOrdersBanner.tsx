import { Link } from 'react-router-dom';
import { CheckCircle2, X } from 'lucide-react';
import type { CreatedBatch } from '@/lib/replenishment';

/** The draft POs just created from this page, with a link to each, so the
 *  buyer can open them even after the item has dropped off the list. */
export function CreatedOrdersBanner({ batches, onDismiss }: {
  batches: ReadonlyArray<CreatedBatch>;
  onDismiss: (key: string) => void;
}) {
  if (batches.length === 0) return null;
  return (
    <div className="mb-4 space-y-2" aria-live="polite">
      {batches.map((batch) => (
        <div
          key={batch.key}
          className="flex items-start gap-2 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-xs text-green-900"
        >
          <CheckCircle2 className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <p className="min-w-0 flex-1">
            Draft PO created for {batch.itemName}:{' '}
            {batch.orders.map((o, i) => (
              <span key={o.id}>
                {i > 0 && ', '}
                <Link
                  to={`/purchases/purchase_order/${o.id}`}
                  className="font-semibold underline underline-offset-2"
                  aria-label={`Open draft purchase order for ${o.vendorName}`}
                >
                  {o.vendorName}
                </Link>
              </span>
            ))}
          </p>
          <button
            type="button"
            onClick={() => onDismiss(batch.key)}
            aria-label="Dismiss"
            className="rounded p-0.5 text-green-700 hover:bg-green-100"
          >
            <X className="size-3.5" aria-hidden="true" />
          </button>
        </div>
      ))}
    </div>
  );
}
