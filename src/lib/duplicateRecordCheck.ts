// Shared exact-name duplicate check for the Add Customer/Vendor/Item pages.
// Given candidates from a broad, all-status name search, decides whether the
// typed name already belongs to an existing record — and if so, whether that
// record is already usable ('active') or would need a status change before it
// could be used ('reactivatable'). Mirrors the case/whitespace-insensitive
// exact-match rule already used by hasExactName/hasExactItemName (which only
// gate the picker's "Create X" button and don't classify status).

export type DuplicateMatchStatus = 'active' | 'reactivatable';

export interface DuplicateCandidate {
  id: string;
  name: string;
  isUsable: boolean;
}

export interface DuplicateMatch<T extends DuplicateCandidate> {
  status: DuplicateMatchStatus;
  candidate: T;
}

export function findDuplicateMatch<T extends DuplicateCandidate>(
  candidates: T[],
  enteredName: string,
): DuplicateMatch<T> | null {
  const needle = enteredName.trim().toLowerCase();
  if (!needle) return null;
  const candidate = candidates.find((c) => c.name.trim().toLowerCase() === needle);
  if (!candidate) return null;
  return { status: candidate.isUsable ? 'active' : 'reactivatable', candidate };
}

export type DuplicateDialogEntity = 'customer' | 'vendor' | 'item';

export interface DuplicateDialogCopy {
  title: string;
  body: string;
  /** Whether to render the "Activate & Use" action — false renders a single
   *  acknowledge-only button instead. */
  showActivate: boolean;
}

const ENTITY_LABEL: Record<DuplicateDialogEntity, string> = {
  customer: 'customer', vendor: 'vendor', item: 'item',
};

/** Copy + whether to offer reactivation, for the Add Customer/Vendor/Item
 *  pages' duplicate-name dialog. Items never offer reactivation: the backend
 *  has no endpoint to flip an item's isActive flag today (its PATCH handler's
 *  request struct omits the field), unlike Customer (crmService.transitionRecord)
 *  and Vendor (vendorService.transition), which already have one. */
export function duplicateDialogCopy(
  entity: DuplicateDialogEntity,
  status: DuplicateMatchStatus,
  name: string,
  statusLabel: string,
): DuplicateDialogCopy {
  const label = ENTITY_LABEL[entity];
  const title = entity === 'item' && status === 'reactivatable'
    ? 'This item already exists'
    : `A ${label} with this name already exists`;

  if (status === 'reactivatable' && entity !== 'item') {
    return {
      title,
      showActivate: true,
      body: `A ${label} named "${name}" already exists but is currently ${statusLabel}. `
        + 'Activate it and use it instead of creating a new one?',
    };
  }
  if (status === 'reactivatable') {
    return {
      title,
      showActivate: false,
      body: `An item named "${name}" already exists but is currently ${statusLabel}. `
        + "Reactivating items from here isn't available yet — choose a different name, "
        + 'or ask an admin to reactivate the existing item.',
    };
  }
  return {
    title,
    showActivate: false,
    body: `A ${label} named "${name}" already exists and is ${statusLabel}. `
      + 'Choose a different name, or search for it to use the existing one.',
  };
}
