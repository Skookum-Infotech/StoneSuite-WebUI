import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { ArrowRight, Search, Workflow, X } from 'lucide-react';
import { workflowService } from '@/services/tenantServices';
import { apiErrorMessage } from '@/api/tenantClient';
import { Spinner, Badge, ErrorNote, EmptyState } from '@/components/tenant/ui';
import { filterWorkflows, groupWorkflows } from '@/config/workflowGroups';
import type { WorkflowGroup } from '@/config/workflowGroups';
import { cn } from '@/lib/utils';
import type { Workflow as WorkflowType } from '@/types/tenant';

const WORKFLOWS_STALE_TIME_MS = 10 * 60 * 1000;

export default function ConfigWorkflowsPage() {
  const [query, setQuery] = useState('');

  const { data = [], isLoading, error } = useQuery({
    queryKey: ['workflows'],
    queryFn: workflowService.list,
    staleTime: WORKFLOWS_STALE_TIME_MS,
  });

  const sections = useMemo(
    () => groupWorkflows(filterWorkflows(data, query)),
    [data, query],
  );

  if (isLoading) return <div className="p-6"><Spinner /></div>;
  if (error) return <div className="p-6"><ErrorNote>{apiErrorMessage(error)}</ErrorNote></div>;

  return (
    <div className="flex flex-1 flex-col min-h-0">
      {/* Page header — consistent with RolesPage */}
      <div className="flex flex-wrap items-center gap-3 border-b border-stone-100 px-4 py-3 sm:px-6 sm:py-4 dark:border-stone-800">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-brand/20 text-brand-dark">
          <Workflow className="size-6" />
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-bold tracking-tight text-stone-900 dark:text-white">
            Configure Forms
          </h1>
          <p className="text-sm text-stone-500">
            Add custom fields to your forms. Each form has built-in base fields plus up to 15 custom fields you define.
          </p>
        </div>

        <SearchField value={query} onChange={setQuery} />
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto modal-scrollbar p-4 sm:p-6">
        {sections.length === 0 && (
          <EmptyState>
            {query.trim()
              ? `No forms match “${query.trim()}”.`
              : 'No workflows found.'}
          </EmptyState>
        )}

        <div className="space-y-8">
          {sections.map(({ group, workflows }) => (
            <ModuleSection key={group.id} group={group} workflows={workflows} />
          ))}
        </div>
      </div>
    </div>
  );
}

function SearchField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="relative w-full sm:ml-auto sm:w-64">
      <Search
        className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-stone-400"
        aria-hidden="true"
      />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Search forms…"
        aria-label="Search forms by name"
        className="w-full rounded-lg border border-stone-200 bg-white py-2 pl-8 pr-8 text-sm text-stone-800 placeholder:text-stone-400 focus:border-brand-dark/40 focus:outline-none focus:ring-2 focus:ring-brand/40 dark:border-stone-700 dark:bg-stone-900 dark:text-stone-100"
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange('')}
          aria-label="Clear search"
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-stone-400 transition-colors hover:bg-stone-100 hover:text-stone-600 focus:outline-none focus:ring-2 focus:ring-brand/40 dark:hover:bg-stone-800"
        >
          <X className="size-3" />
        </button>
      )}
    </div>
  );
}

function ModuleSection({
  group,
  workflows,
}: {
  group: WorkflowGroup;
  workflows: WorkflowType[];
}) {
  const Icon = group.icon;
  const disabledCount = workflows.filter((wf) => !wf.enabled).length;

  return (
    <section aria-labelledby={`module-${group.id}`}>
      {/* Module header — the icon chip and rail carry the module's accent. */}
      <div className="flex items-start gap-3">
        <div
          className={cn(
            'flex size-8 shrink-0 items-center justify-center rounded-lg',
            group.accent.chip,
          )}
        >
          <Icon className="size-4" aria-hidden="true" />
        </div>
        <div className="min-w-0 pt-0.5">
          <div className="flex items-center gap-2">
            <h2
              id={`module-${group.id}`}
              className="text-xs font-bold uppercase tracking-wider text-stone-600 dark:text-stone-300"
            >
              {group.label}
            </h2>
            <span
              className={cn(
                'rounded-full px-1.5 py-0.5 text-2xs font-bold tabular-nums',
                group.accent.count,
              )}
            >
              {workflows.length}
            </span>
            {disabledCount > 0 && (
              <span className="flex items-center gap-1 text-2xs font-semibold text-stone-400">
                <span
                  className="size-1.5 rounded-full border border-stone-400 dark:border-stone-500"
                  aria-hidden="true"
                />
                {disabledCount} disabled
              </span>
            )}
          </div>
          <p className="mt-0.5 text-xs text-stone-400">{group.description}</p>
        </div>
      </div>

      {/* Rail aligns under the icon chip and visually owns the cards beside it. */}
      <div className="mt-3 flex gap-3">
        <div className={cn('ml-3.5 w-px shrink-0 rounded-full', group.accent.rail)} aria-hidden="true" />
        <div className="grid flex-1 gap-2.5 sm:grid-cols-2 2xl:grid-cols-3">
          {workflows.map((wf) => (
            <WorkflowCard key={wf.id} wf={wf} />
          ))}
        </div>
      </div>
    </section>
  );
}

/**
 * A disabled workflow stays configurable — you edit it before switching it on —
 * so the card keeps its link and signals the state three non-colour ways: a
 * hollow rather than filled status dot, a dashed border, and a "Disabled" chip.
 * The wording matches the Enabled/Disabled switch on the builder page.
 */
function WorkflowCard({ wf }: { wf: WorkflowType }) {
  const { enabled } = wf;

  return (
    <Link
      to={`/config/workflows/${wf.id}`}
      aria-label={`Configure ${wf.name} — ${enabled ? 'enabled' : 'disabled'}`}
      className={cn(
        'group flex flex-col rounded-xl border p-3.5 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/50',
        enabled
          ? 'border-stone-200 bg-white hover:-translate-y-px hover:border-brand-dark/40 hover:shadow-sm dark:border-stone-800 dark:bg-stone-900 dark:hover:border-brand-dark/60'
          : 'border-dashed border-stone-300 bg-stone-50/70 hover:border-stone-400 hover:bg-stone-50 dark:border-stone-700 dark:bg-stone-900/40 dark:hover:border-stone-600',
      )}
    >
      <div className="flex items-start gap-2">
        <span
          className={cn(
            'mt-1 size-2 shrink-0 rounded-full',
            enabled
              ? 'bg-emerald-500'
              : 'border border-stone-400 bg-transparent dark:border-stone-500',
          )}
          aria-hidden="true"
        />
        <p
          className={cn(
            'min-w-0 flex-1 truncate text-sm font-semibold',
            enabled ? 'text-stone-800 dark:text-white' : 'text-stone-500 dark:text-stone-400',
          )}
        >
          {wf.name}
        </p>
        {!enabled && <Badge size="sm">Disabled</Badge>}
        {wf.isDefault && <Badge size="sm">default</Badge>}
      </div>

      {/* Absorbs the slack so the action row sits on the card's bottom edge
          whatever length the description runs to — including none at all. */}
      <div className="flex-1">
        {wf.description && (
          <p className={cn('mt-1 line-clamp-2 text-xs', enabled ? 'text-stone-400' : 'text-stone-400/70')}>
            {wf.description}
          </p>
        )}
      </div>

      <div
        className={cn(
          'mt-3 flex items-center justify-end gap-2 border-t pt-2.5',
          enabled ? 'border-stone-100 dark:border-stone-800' : 'border-stone-200/70 dark:border-stone-800/70',
        )}
      >
        <span className="flex shrink-0 items-center gap-1 text-xs font-semibold text-stone-400 transition-colors group-hover:text-brand-dark dark:group-hover:text-brand">
          Configure
          <ArrowRight className="size-3 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
        </span>
      </div>
    </Link>
  );
}
