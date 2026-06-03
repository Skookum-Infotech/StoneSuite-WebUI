import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Settings2 } from 'lucide-react';
import { workflowService } from '@/services/tenantServices';
import { apiErrorMessage } from '@/api/tenantClient';
import { PageHeader, Spinner, Badge, ErrorNote } from '@/components/tenant/ui';
import { RecordsPanel } from '@/components/tenant/RecordsPanel';

/**
 * Daily-use view for a single workflow: a state summary plus the records
 * panel (create / edit fields / transition). Reached from the dynamic
 * sidebar list of enabled workflows. Configuration lives under /config.
 */
export default function WorkflowRecordsPage() {
  const { id = '' } = useParams();
  const { data: def, isLoading, error } = useQuery({
    queryKey: ['workflow', id],
    queryFn: () => workflowService.get(id),
  });

  if (isLoading) return <div className="p-6"><Spinner /></div>;
  if (error || !def) return <div className="p-6"><ErrorNote>{apiErrorMessage(error, 'Failed to load workflow.')}</ErrorNote></div>;

  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title={def.workflow.name}
        subtitle={def.workflow.description || def.workflow.key}
        action={
          <Link
            to={`/config/workflows/${def.workflow.id}`}
            className="flex items-center gap-1 rounded-lg border border-stone-200 px-3 py-1.5 text-xs font-semibold text-stone-600 hover:bg-stone-100 dark:border-stone-700 dark:hover:bg-stone-800"
          >
            <Settings2 className="size-3.5" /> Configure
          </Link>
        }
      />

      {/* State pipeline summary */}
      <section className="rounded-xl border border-stone-200 bg-white p-5 dark:border-stone-800 dark:bg-stone-900">
        <h2 className="mb-3 text-sm font-bold">Pipeline</h2>
        <div className="flex flex-wrap items-center gap-2">
          {def.states.map((s) => (
            <Badge key={s.id} color={s.color || undefined}>
              {s.name}
              {s.isInitial && ' · start'}
              {s.isTerminal && ' · end'}
            </Badge>
          ))}
        </div>
      </section>

      <RecordsPanel def={def} />
    </div>
  );
}
