import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Settings2, Building2, Boxes } from 'lucide-react';
import { workflowService } from '@/services/tenantServices';
import { apiErrorMessage } from '@/api/tenantClient';
import { PageHeader, Spinner, Badge, ErrorNote, EmptyState } from '@/components/tenant/ui';
import type { Workflow } from '@/types/tenant';

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

  // Group workflows by their key.
  const byKey = new Map<string, Workflow>(data.map((wf) => [wf.key.toLowerCase(), wf]));

  // Workflows that don't belong to any named group.
  const allGroupedKeys = new Set(FORM_GROUPS.flatMap((g) => g.keys));
  const ungrouped = data.filter((wf) => !allGroupedKeys.has(wf.key.toLowerCase()));

  return (
    <div className="p-6 space-y-8">
      <PageHeader
        title="Configure Forms"
        subtitle="Add custom fields to your forms. Each form has built-in base fields plus up to 15 custom fields you define."
      />

      {data.length === 0 && <EmptyState>No workflows found.</EmptyState>}

      {/* Named module groups */}
      {FORM_GROUPS.map((group) => {
        const workflows = group.keys
          .map((k) => byKey.get(k))
          .filter((wf): wf is Workflow => Boolean(wf));

        if (workflows.length === 0) return null;

        const Icon = group.icon;
        return (
          <section key={group.label}>
            <div className="mb-3 flex items-center gap-2.5">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand/20 text-brand-dark">
                <Icon className="size-4" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-stone-800 dark:text-white">{group.label}</h2>
                <p className="text-xs text-stone-500">{group.description}</p>
              </div>
            </div>

            <div className="space-y-2 pl-9">
              {workflows.map((wf) => (
                <WorkflowCard key={wf.id} wf={wf} />
              ))}
            </div>
          </section>
        );
      })}

      {/* Ungrouped / custom workflows */}
      {ungrouped.length > 0 && (
        <section>
          <div className="mb-3 flex items-center gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-stone-100 text-stone-500">
              <Boxes className="size-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-stone-800 dark:text-white">Other Workflows</h2>
              <p className="text-xs text-stone-500">Custom workflows not assigned to a module group.</p>
            </div>
          </div>
          <div className="space-y-2 pl-9">
            {ungrouped.map((wf) => (
              <WorkflowCard key={wf.id} wf={wf} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function WorkflowCard({ wf }: { wf: Workflow }) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-stone-200 bg-white p-4 dark:border-stone-800 dark:bg-stone-900">
      <div>
        <div className="flex items-center gap-2">
          <p className="text-sm font-bold text-stone-800 dark:text-white">{wf.name}</p>
          {wf.isDefault && <Badge>default</Badge>}
        </div>
        <p className="mt-0.5 text-xs text-stone-500">{wf.description || wf.key}</p>
      </div>

      <Link
        to={`/config/workflows/${wf.id}`}
        className="flex items-center gap-1.5 rounded-lg bg-brand px-3 py-1.5 text-xs font-semibold text-stone-950 transition-colors hover:bg-brand/70"
        aria-label={`Configure ${wf.name}`}
      >
        <Settings2 className="size-3.5" /> Configure
      </Link>
    </div>
  );
}
