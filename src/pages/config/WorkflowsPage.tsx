import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Settings2 } from 'lucide-react';
import { workflowService } from '@/services/tenantServices';
import { apiErrorMessage } from '@/api/tenantClient';
import { PageHeader, Spinner, Badge, ErrorNote, EmptyState } from '@/components/tenant/ui';
import type { Workflow } from '@/types/tenant';

export default function ConfigWorkflowsPage() {
  const qc = useQueryClient();
  const { data, isLoading, error } = useQuery({ queryKey: ['workflows'], queryFn: workflowService.list });

  const toggle = useMutation({
    mutationFn: ({ id, enabled }: { id: string; enabled: boolean }) =>
      workflowService.setEnabled(id, enabled),
    // Enabled workflows drive the dynamic sidebar, so refresh both queries.
    onSuccess: () => qc.invalidateQueries({ queryKey: ['workflows'] }),
  });

  return (
    <div className="p-6">
      <PageHeader
        title="Workflows"
        subtitle="Configure your record state machines. Enabled workflows appear in the workspace sidebar for daily use."
      />

      {isLoading && <Spinner />}
      {error && <ErrorNote>{apiErrorMessage(error)}</ErrorNote>}
      {toggle.error && <ErrorNote>{apiErrorMessage(toggle.error)}</ErrorNote>}

      {data && data.length === 0 && <EmptyState>No workflows yet.</EmptyState>}

      <div className="space-y-2">
        {data?.map((wf: Workflow) => (
          <div
            key={wf.id}
            className="flex items-center justify-between rounded-xl border border-stone-200 bg-white p-4 dark:border-stone-800 dark:bg-stone-900"
          >
            <div className="flex items-center gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-sm font-bold">{wf.name}</p>
                  {wf.isDefault && <Badge>default</Badge>}
                  <Badge color={wf.enabled ? '#22c55e' : '#a8a29e'}>{wf.enabled ? 'enabled' : 'disabled'}</Badge>
                </div>
                <p className="mt-0.5 text-xs text-stone-500">{wf.description || wf.key}</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                aria-label={wf.enabled ? `Disable ${wf.name}` : `Enable ${wf.name}`}
                onClick={() => toggle.mutate({ id: wf.id, enabled: !wf.enabled })}
                disabled={toggle.isPending}
                className="rounded-lg border border-stone-200 px-3 py-1.5 text-xs font-semibold text-stone-600 transition-colors hover:bg-stone-100 disabled:opacity-50 dark:border-stone-700 dark:hover:bg-stone-800"
              >
                {wf.enabled ? 'Disable' : 'Enable'}
              </button>
              <Link
                to={`/config/workflows/${wf.id}`}
                className="flex items-center gap-1 rounded-lg bg-brand px-3 py-1.5 text-xs font-semibold text-stone-950"
              >
                <Settings2 className="size-3.5" /> Configure
              </Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
