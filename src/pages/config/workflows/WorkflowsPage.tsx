import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Settings2, Building2, Boxes, Workflow } from 'lucide-react';
import { workflowService } from '@/services/tenantServices';
import { apiErrorMessage } from '@/api/tenantClient';
import { Spinner, Badge, ErrorNote, EmptyState } from '@/components/tenant/ui';
import { cn } from '@/lib/utils';
import type { Workflow as WorkflowType } from '@/types/tenant';

// FORM_GROUPS defines how workflows are grouped in the Config UI.
// Add new groups here as new modules are built (e.g. HR, Finance).
const FORM_GROUPS: { label: string; description: string; icon: typeof Building2; keys: string[] }[] = [
  {
    label: 'CRM',
    description: 'Customer relationship management — Leads, Prospects, and Customers.',
    icon: Building2,
    keys: ['lead', 'prospect', 'customer'],
  },
  // Future example:
  // { label: 'HR', description: 'Human resources workflows.', icon: Users, keys: ['employee', 'job'] },
];

export default function ConfigWorkflowsPage() {
  const { data = [], isLoading, error } = useQuery({
    queryKey: ['workflows'],
    queryFn: workflowService.list,
  });

  if (isLoading) return <div className="p-6"><Spinner /></div>;
  if (error) return <div className="p-6"><ErrorNote>{apiErrorMessage(error)}</ErrorNote></div>;

  const byKey = new Map<string, WorkflowType>(data.map((wf) => [wf.key.toLowerCase(), wf]));
  const allGroupedKeys = new Set(FORM_GROUPS.flatMap((g) => g.keys));
  const ungrouped = data.filter((wf) => !allGroupedKeys.has(wf.key.toLowerCase()));

  return (
    <div className="flex flex-1 flex-col min-h-0">
      {/* Page header — consistent with RolesPage */}
      <div className="flex items-center gap-3 border-b border-stone-100 px-4 py-3 sm:px-6 sm:py-4 dark:border-stone-800">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-brand/20 text-brand-dark">
          <Workflow className="size-6" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-stone-900 dark:text-white">
            Configure Forms
          </h1>
          <p className="text-sm text-stone-500">
            Add custom fields to your forms. Each form has built-in base fields plus up to 15 custom fields you define.
          </p>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto modal-scrollbar p-4 sm:p-6 space-y-6">
        {data.length === 0 && <EmptyState>No workflows found.</EmptyState>}

        {FORM_GROUPS.map((group) => {
          const workflows = group.keys
            .map((k) => byKey.get(k))
            .filter((wf): wf is WorkflowType => Boolean(wf));

          if (workflows.length === 0) return null;

          const Icon = group.icon;
          return (
            <section key={group.label}>
              {/* Section label */}
              <div className="mb-1 flex items-center gap-2">
                <Icon className="size-3.5 text-stone-400" />
                <span className="text-xs font-bold uppercase tracking-wider text-stone-500">
                  {group.label}
                </span>
                <span className="rounded-full bg-stone-100 px-1.5 py-0.5 text-2xs font-bold tabular-nums text-stone-400 dark:bg-stone-800 dark:text-stone-500">
                  {workflows.length}
                </span>
              </div>
              <p className="mb-3 pl-5 text-xs text-stone-400">{group.description}</p>

              {/* Grouped list — single rounded container, dividers between rows */}
              <div className="overflow-hidden rounded-xl border border-stone-200 dark:border-stone-800">
                {workflows.map((wf, i) => (
                  <WorkflowRow
                    key={wf.id}
                    wf={wf}
                    isLast={i === workflows.length - 1}
                  />
                ))}
              </div>
            </section>
          );
        })}

        {ungrouped.length > 0 && (
          <section>
            <div className="mb-1 flex items-center gap-2">
              <Boxes className="size-3.5 text-stone-400" />
              <span className="text-xs font-bold uppercase tracking-wider text-stone-500">
                Other Workflows
              </span>
              <span className="rounded-full bg-stone-100 px-1.5 py-0.5 text-2xs font-bold tabular-nums text-stone-400 dark:bg-stone-800 dark:text-stone-500">
                {ungrouped.length}
              </span>
            </div>
            <p className="mb-3 pl-5 text-xs text-stone-400">
              Custom workflows not assigned to a module group.
            </p>

            <div className="overflow-hidden rounded-xl border border-stone-200 dark:border-stone-800">
              {ungrouped.map((wf, i) => (
                <WorkflowRow
                  key={wf.id}
                  wf={wf}
                  isLast={i === ungrouped.length - 1}
                />
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

function WorkflowRow({ wf, isLast }: { wf: WorkflowType; isLast: boolean }) {
  return (
    <div
      className={cn(
        'flex items-center justify-between bg-white px-4 py-3.5 transition-colors hover:bg-stone-50/60 dark:bg-stone-900 dark:hover:bg-stone-800/50',
        !isLast && 'border-b border-stone-100 dark:border-stone-800',
      )}
    >
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-semibold text-stone-800 dark:text-white">{wf.name}</p>
          <span className='text-sm'>{wf.isDefault && <Badge>default</Badge>}</span>
        </div>
        <p className="mt-0.5 text-xs text-stone-400 truncate">{wf.description || wf.key}</p>
      </div>

      <Link
        to={`/config/workflows/${wf.id}`}
        className="ml-4 flex shrink-0 items-center gap-1.5 rounded-lg bg-brand px-3 py-1.5 text-xs font-semibold text-stone-950 transition-colors hover:bg-brand-hover"
        aria-label={`Configure ${wf.name}`}
      >
        <Settings2 className="size-3.5" /> Configure
      </Link>
    </div>
  );
}
