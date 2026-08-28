import { X } from 'lucide-react';
import { fieldCls } from '@/components/crm/formUtils';
import { cn } from '@/lib/utils';
import { FEEDBACK_CATEGORY_OPTIONS, FEEDBACK_PRIORITY_LABELS, FEEDBACK_STATUS_LABELS } from '@/lib/feedback';
import type { FeedbackAdminFilters } from '@/types/feedback';
import type { Tenant } from '@/types/tenant';

interface Props {
  filters: FeedbackAdminFilters;
  tenants: Tenant[];
  onChange: (patch: Partial<FeedbackAdminFilters>) => void;
  onClear: () => void;
}

const selectCls = cn(fieldCls, 'h-8 py-1');

function hasActiveFilters(f: FeedbackAdminFilters): boolean {
  return Boolean(f.status || f.category || f.priority || f.tenantId || f.search);
}

// All filters are server-side (status/category/priority/tenantId/search on
// GET /api/platform/feedback) — there is no client-side narrowing here.
export function FeedbackFiltersBar({ filters, tenants, onChange, onClear }: Props) {
  return (
    <div className="flex flex-wrap items-end gap-2">
      <Field label="Status" htmlFor="fb-filter-status">
        <select
          id="fb-filter-status"
          value={filters.status ?? ''}
          onChange={(e) => onChange({ status: e.target.value as FeedbackAdminFilters['status'] })}
          className={cn(selectCls, 'sm:w-36')}
        >
          <option value="">All statuses</option>
          {Object.entries(FEEDBACK_STATUS_LABELS).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
      </Field>

      <Field label="Category" htmlFor="fb-filter-category">
        <select
          id="fb-filter-category"
          value={filters.category ?? ''}
          onChange={(e) => onChange({ category: e.target.value as FeedbackAdminFilters['category'] })}
          className={cn(selectCls, 'sm:w-44')}
        >
          <option value="">All categories</option>
          {FEEDBACK_CATEGORY_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </Field>

      <Field label="Priority" htmlFor="fb-filter-priority">
        <select
          id="fb-filter-priority"
          value={filters.priority ?? ''}
          onChange={(e) => onChange({ priority: e.target.value as FeedbackAdminFilters['priority'] })}
          className={cn(selectCls, 'sm:w-32')}
        >
          <option value="">All priorities</option>
          {Object.entries(FEEDBACK_PRIORITY_LABELS).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
      </Field>

      <Field label="Tenant" htmlFor="fb-filter-tenant">
        <select
          id="fb-filter-tenant"
          value={filters.tenantId ?? ''}
          onChange={(e) => onChange({ tenantId: e.target.value })}
          className={cn(selectCls, 'sm:w-44')}
        >
          <option value="">All tenants</option>
          {tenants.map((t) => (
            <option key={t.id} value={t.id}>{t.displayName}</option>
          ))}
        </select>
      </Field>

      <Field label="Search" htmlFor="fb-filter-search">
        <input
          id="fb-filter-search"
          type="text"
          value={filters.search ?? ''}
          onChange={(e) => onChange({ search: e.target.value })}
          placeholder="Search description…"
          className={cn(selectCls, 'sm:w-56')}
        />
      </Field>

      {hasActiveFilters(filters) && (
        <button
          type="button"
          onClick={onClear}
          aria-label="Clear feedback filters"
          className="flex h-8 items-center gap-1 rounded-lg border border-stone-200 bg-white px-2.5 text-xs text-stone-500 transition-colors hover:bg-stone-50 dark:border-white/10 dark:bg-transparent dark:hover:bg-white/[0.06]"
        >
          <X className="size-3" />
          Clear
        </button>
      )}
    </div>
  );
}

function Field({ label, htmlFor, children }: { label: string; htmlFor: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={htmlFor} className="text-2xs font-semibold uppercase tracking-wider text-stone-400">
        {label}
      </label>
      {children}
    </div>
  );
}
