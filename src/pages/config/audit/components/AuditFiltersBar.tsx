import type { ReactNode } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { AUDIT_RESOURCES, KNOWN_AUDIT_ACTIONS, hasActiveFilters } from '@/lib/auditLog';
import type { AuditFilters } from '@/types/audit';

type ActorOption = { id: string; label: string };

interface Props {
  filters: AuditFilters;
  actorOptions: ActorOption[];
  onChange: (patch: Partial<AuditFilters>) => void;
  onClear: () => void;
}

const inputClass =
  'h-8 w-full rounded-lg border border-stone-200 bg-white px-3 text-xs text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand transition-all duration-150';

// All filters are server-side (resource/action/actor/from/to on GET
// /api/tenant/audit) — there is no client-side narrowing here. Resource,
// action and actor are free-text inputs backed by a <datalist> of
// suggestions rather than a strict <select>, so filtering still works for a
// value the suggestion list doesn't know about (a newer resource/action, or
// an actor this caller can't resolve to a name — see AUDIT_RESOURCES).
export function AuditFiltersBar({ filters, actorOptions, onChange, onClear }: Props) {
  return (
    <div className="flex flex-wrap items-end gap-2">
      <Field label="Resource" htmlFor="audit-filter-resource">
        <input
          id="audit-filter-resource"
          list="audit-resource-options"
          aria-label="Filter by resource"
          value={filters.resource}
          onChange={(e) => onChange({ resource: e.target.value })}
          placeholder="All resources"
          className={cn(inputClass, 'sm:w-40')}
        />
        <datalist id="audit-resource-options">
          {AUDIT_RESOURCES.map((r) => (
            <option key={r.value} value={r.value}>
              {r.label}
            </option>
          ))}
        </datalist>
      </Field>

      <Field label="Action" htmlFor="audit-filter-action">
        <input
          id="audit-filter-action"
          list="audit-action-options"
          aria-label="Filter by action"
          value={filters.action}
          onChange={(e) => onChange({ action: e.target.value })}
          placeholder="All actions"
          className={cn(inputClass, 'sm:w-36')}
        />
        <datalist id="audit-action-options">
          {KNOWN_AUDIT_ACTIONS.map((a) => (
            <option key={a} value={a} />
          ))}
        </datalist>
      </Field>

      <Field label="Actor" htmlFor="audit-filter-actor">
        <input
          id="audit-filter-actor"
          list="audit-actor-options"
          aria-label="Filter by actor"
          value={filters.actor}
          onChange={(e) => onChange({ actor: e.target.value })}
          placeholder="All actors"
          className={cn(inputClass, 'sm:w-48')}
        />
        <datalist id="audit-actor-options">
          {actorOptions.map((u) => (
            <option key={u.id} value={u.id}>
              {u.label}
            </option>
          ))}
        </datalist>
      </Field>

      <Field label="From" htmlFor="audit-filter-from">
        <input
          id="audit-filter-from"
          type="date"
          aria-label="Filter from date"
          value={filters.from}
          max={filters.to || undefined}
          onChange={(e) => onChange({ from: e.target.value })}
          className={cn(inputClass, 'sm:w-36')}
        />
      </Field>

      <Field label="To" htmlFor="audit-filter-to">
        <input
          id="audit-filter-to"
          type="date"
          aria-label="Filter to date"
          value={filters.to}
          min={filters.from || undefined}
          onChange={(e) => onChange({ to: e.target.value })}
          className={cn(inputClass, 'sm:w-36')}
        />
      </Field>

      {hasActiveFilters(filters) && (
        <button
          type="button"
          onClick={onClear}
          aria-label="Clear audit log filters"
          className="flex items-center gap-1 rounded-lg border border-stone-200 bg-white px-2.5 h-8 text-xs text-stone-500 hover:bg-stone-50 transition-colors"
        >
          <X className="size-3" />
          Clear
        </button>
      )}
    </div>
  );
}

function Field({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label
        htmlFor={htmlFor}
        className="text-2xs font-semibold uppercase tracking-wider text-stone-400"
      >
        {label}
      </label>
      {children}
    </div>
  );
}
