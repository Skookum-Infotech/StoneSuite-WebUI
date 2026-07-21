import type { ReactNode } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { AUDIT_RESOURCES, AUDIT_ACTIONS, hasActiveFilters } from '@/lib/auditLog';
import type { AuditFilters } from '@/types/audit';
import { FilterDropdown } from './FilterDropdown';

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
// action and actor all use FilterDropdown (a custom listbox, not a native
// <select>) so the closed control always shows a resolved name rather than
// a raw value, and a long option list (Resource has 26 entries) scrolls with
// the app's own scrollbar instead of the browser's native popup chrome.
export function AuditFiltersBar({ filters, actorOptions, onChange, onClear }: Props) {
  return (
    <div className="flex flex-wrap items-end gap-2">
      <FilterDropdown
        label="Resource"
        value={filters.resource}
        onChange={(v) => onChange({ resource: v })}
        allLabel="All resources"
        options={AUDIT_RESOURCES}
      />

      <FilterDropdown
        label="Action"
        value={filters.action}
        onChange={(v) => onChange({ action: v })}
        allLabel="All actions"
        options={AUDIT_ACTIONS}
      />

      <FilterDropdown
        label="Actor"
        value={filters.actor}
        onChange={(v) => onChange({ actor: v })}
        allLabel="All actors"
        options={actorOptions.map((u) => ({ value: u.id, label: u.label }))}
      />

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
