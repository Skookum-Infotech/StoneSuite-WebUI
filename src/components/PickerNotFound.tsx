import { AlertTriangle, Plus } from 'lucide-react';

export interface PickerExistingRecord {
  name: string;
  /** Why it isn't in the list above — "Inactive", "Active, but not eligible
   *  for this field"… Shown in parentheses after the name. */
  statusLabel?: string;
  /** Detail page of the record, opened in a new tab. */
  href: string;
}

// The footer of a picker's dropdown when what the user typed isn't among the
// selectable results. Three outcomes, so a picker never offers to create a
// record that already exists:
//   - `existing` — a record with that name/code is already in the system,
//     possibly Inactive or otherwise filtered out of this list. Blocks create
//     and points at it instead.
//   - `createHref` — genuinely not there: offer to create it in a new tab.
//   - neither — not there, and this user can't create it: say who can.
// Both links open in a new tab, so the half-filled form the picker lives in is
// never left behind; the picker refetches when the tab regains focus.
export function PickerNotFound({ entity, term, existing, createHref }: {
  /** Singular noun for the record type: "item", "account". */
  entity: string;
  term: string;
  existing?: PickerExistingRecord | null;
  createHref?: string;
}) {
  if (existing) {
    const article = /^[aeiou]/i.test(entity) ? 'An' : 'A';
    return (
      <div role="status" className="border-t border-stone-100 px-3 py-2">
        <p className="flex items-start gap-1.5 text-xs font-medium text-amber-700">
          <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
          <span className="min-w-0 break-words">
            {article} {entity} named “{existing.name}” already exists{existing.statusLabel ? ` (${existing.statusLabel})` : ''}.
          </span>
        </p>
        <a
          href={existing.href}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`Open “${existing.name}” — opens in a new tab`}
          className="mt-1 flex items-center gap-1.5 pl-5 text-2xs font-semibold text-stone-700 transition-colors hover:text-stone-900"
        >
          Open it
        </a>
      </div>
    );
  }

  return (
    <div role="status" className="border-t border-stone-100 px-3 py-2">
      <p className="flex items-start gap-1.5 text-xs font-medium text-amber-700">
        <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
        <span className="min-w-0 break-words">“{term}” isn't an existing {entity}.</span>
      </p>
      {createHref ? (
        <a
          href={createHref}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`Create “${term}” as a new ${entity} — opens in a new tab`}
          className="mt-1.5 flex items-center gap-2 rounded px-1 py-1 text-xs font-semibold text-stone-800 transition-colors hover:bg-accent/10"
        >
          <Plus className="size-3.5 shrink-0 text-stone-500" aria-hidden="true" />
          <span className="truncate">Create “{term}” as a new {entity}</span>
        </a>
      ) : (
        <p className="mt-0.5 pl-5 text-2xs text-stone-500">
          Ask someone with {entity} access to add it first.
        </p>
      )}
    </div>
  );
}
