import { useState } from 'react';
import { Building2, Phone, MapPin, Star, Pencil, Trash2 } from 'lucide-react';
import type { CompanyLocation } from '@/types/companyProfile';

import { buttonVariants } from '@/components/ui/button';
export interface LocationCardActions {
  onEdit: () => void;
  onDelete: () => void;
  onSetDefault: () => void;
  /** Fires a screen-reader-only announcement — the confirm-delete swap below
   *  unmounts the clicked button and drops keyboard focus to <body> (same
   *  failure mode AccountDetailPage.tsx's own status region works around),
   *  so this is how a screen-reader user learns the prompt appeared. */
  onAnnounce: (message: string) => void;
}

function formatAddress(location: CompanyLocation): string {
  const { address } = location;
  const line2 = [address.line2, address.suite].filter(Boolean).join(', ');
  const cityState = [address.city, address.state, address.zip].filter(Boolean).join(', ');
  return [address.line1, line2, cityState, address.country].filter(Boolean).join(' · ') || 'No address on file';
}

// One saved Location, display mode — a card with Edit/Delete/"Set as default"
// actions. Delete asks for confirmation inline (swapping its own action row)
// rather than via a separate dialog, matching this card's otherwise-inline
// interaction style. Without `canConfigure` (the default) it is purely
// read-only and shows no actions, which is how Inventory → Locations lists the
// same locations: they are only ever changed from Company Info.
export function LocationCard({
  location, canConfigure = false, isBusy = false, actions,
}: {
  location: CompanyLocation;
  canConfigure?: boolean;
  isBusy?: boolean;
  actions?: LocationCardActions;
}) {
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  return (
    <div className="w-full rounded-2xl border border-stone-200 bg-white shadow-sm overflow-hidden">
      <div className="px-5 py-4 sm:px-6 sm:py-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <Building2 className="size-4 text-ink-faint" />
            <h3 className="type-card-title">{location.name}</h3>
            {location.isDefault && (
              <span className="inline-flex items-center gap-1 rounded-full bg-brand/15 px-2 py-0.5 text-link type-overline">
                <Star className="size-3" strokeWidth={2.5} />
                Default
              </span>
            )}
          </div>

          {canConfigure && !confirmingDelete && (
            <div className="flex items-center gap-1 shrink-0">
              {!location.isDefault && (
                <button
                  type="button"
                  onClick={actions?.onSetDefault}
                  disabled={isBusy}
                  aria-label={`Set ${location.name} as default location`}
                  className={buttonVariants({ variant: 'ghost' })}
                >
                  Set as default
                </button>
              )}
              <button
                type="button"
                onClick={actions?.onEdit}
                disabled={isBusy}
                aria-label={`Edit ${location.name}`}
                className="rounded-lg p-2 text-ink-muted hover:bg-stone-100 hover:text-ink disabled:opacity-50 transition-colors"
              >
                <Pencil className="size-4" />
              </button>
              <button
                type="button"
                onClick={() => {
                  setConfirmingDelete(true);
                  actions?.onAnnounce(`Confirm deleting ${location.name}.`);
                }}
                disabled={isBusy}
                aria-label={`Delete ${location.name}`}
                className="rounded-lg p-2 text-ink-muted hover:bg-red-50 hover:text-danger-ink disabled:opacity-50 transition-colors"
              >
                <Trash2 className="size-4" />
              </button>
            </div>
          )}

          {canConfigure && confirmingDelete && (
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-xs font-semibold text-ink">Delete this location?</span>
              <button
                type="button"
                onClick={() => {
                  setConfirmingDelete(false);
                  actions?.onAnnounce('Delete cancelled.');
                }}
                disabled={isBusy}
                aria-label="Cancel delete"
                className={buttonVariants({ variant: 'ghost' })}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={actions?.onDelete}
                disabled={isBusy}
                aria-label={`Confirm delete ${location.name}`}
                className={buttonVariants({ variant: 'destructive' })}
              >
                {isBusy ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          )}
        </div>

        <div className="mt-2 flex items-start gap-1.5 text-xs text-ink-muted">
          <MapPin className="size-3.5 shrink-0 mt-0.5 text-ink-faint" />
          <span>{formatAddress(location)}</span>
        </div>
        {location.phone && (
          <div className="mt-1 flex items-center gap-1.5 text-xs text-ink-muted">
            <Phone className="size-3.5 shrink-0 text-ink-faint" />
            <span>{location.phone}</span>
          </div>
        )}
      </div>
    </div>
  );
}
