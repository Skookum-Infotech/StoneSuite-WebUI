import { useState } from 'react';
import { Building2, Phone, MapPin, Star, Pencil, Trash2 } from 'lucide-react';
import type { CompanyLocation } from '@/types/companyProfile';
import { cn } from '@/lib/utils';

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

// One saved Location, display mode — a read-only card with Edit/Delete/
// "Set as default" actions. Delete asks for confirmation inline (swapping
// its own action row) rather than via a separate dialog, matching this
// card's otherwise-inline interaction style.
export function LocationCard({
  location, canConfigure, isBusy, actions,
}: {
  location: CompanyLocation;
  canConfigure: boolean;
  isBusy: boolean;
  actions: LocationCardActions;
}) {
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  return (
    <div className="w-full rounded-2xl border border-stone-200 bg-white shadow-sm overflow-hidden">
      <div className="px-5 py-4 sm:px-6 sm:py-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <Building2 className="size-4 text-stone-400" />
            <h3 className="text-sm font-bold text-stone-900">{location.name}</h3>
            {location.isDefault && (
              <span className="inline-flex items-center gap-1 rounded-full bg-brand/15 px-2 py-0.5 text-2xs font-bold uppercase tracking-wide text-brand-dark">
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
                  onClick={actions.onSetDefault}
                  disabled={isBusy}
                  aria-label={`Set ${location.name} as default location`}
                  className="rounded-lg px-2.5 py-1.5 text-xs font-semibold text-stone-600 hover:bg-stone-100 disabled:opacity-50 transition-colors"
                >
                  Set as default
                </button>
              )}
              <button
                type="button"
                onClick={actions.onEdit}
                disabled={isBusy}
                aria-label={`Edit ${location.name}`}
                className="rounded-lg p-2 text-stone-500 hover:bg-stone-100 hover:text-stone-700 disabled:opacity-50 transition-colors"
              >
                <Pencil className="size-4" />
              </button>
              <button
                type="button"
                onClick={() => {
                  setConfirmingDelete(true);
                  actions.onAnnounce(`Confirm deleting ${location.name}.`);
                }}
                disabled={isBusy}
                aria-label={`Delete ${location.name}`}
                className="rounded-lg p-2 text-stone-500 hover:bg-red-50 hover:text-red-600 disabled:opacity-50 transition-colors"
              >
                <Trash2 className="size-4" />
              </button>
            </div>
          )}

          {canConfigure && confirmingDelete && (
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-xs font-semibold text-stone-600">Delete this location?</span>
              <button
                type="button"
                onClick={() => {
                  setConfirmingDelete(false);
                  actions.onAnnounce('Delete cancelled.');
                }}
                disabled={isBusy}
                aria-label="Cancel delete"
                className="rounded-lg px-2.5 py-1.5 text-xs font-semibold text-stone-600 hover:bg-stone-100 disabled:opacity-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={actions.onDelete}
                disabled={isBusy}
                aria-label={`Confirm delete ${location.name}`}
                className={cn(
                  'rounded-lg px-2.5 py-1.5 text-xs font-bold text-white bg-red-600 hover:bg-red-700 disabled:opacity-50 transition-colors',
                )}
              >
                {isBusy ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          )}
        </div>

        <div className="mt-2 flex items-start gap-1.5 text-xs text-stone-500">
          <MapPin className="size-3.5 shrink-0 mt-0.5 text-stone-400" />
          <span>{formatAddress(location)}</span>
        </div>
        {location.phone && (
          <div className="mt-1 flex items-center gap-1.5 text-xs text-stone-500">
            <Phone className="size-3.5 shrink-0 text-stone-400" />
            <span>{location.phone}</span>
          </div>
        )}
      </div>
    </div>
  );
}
