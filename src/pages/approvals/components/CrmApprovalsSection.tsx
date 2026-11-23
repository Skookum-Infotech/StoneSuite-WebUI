import { Link } from 'react-router-dom';
import { useQueries } from '@tanstack/react-query';
import { approvalInboxService } from '@/services/approvalInboxService';
import { useUserPermissions } from '@/hooks/useUserPermissions';
import { useWorkflows } from '@/hooks/useWorkflows';
import { APPROVALS_INBOX_KEY } from '@/hooks/useApprovalInboxSummary';
import { crmRecordTitle, readableCrmApprovalWorkflows } from '@/lib/crmApproval';
import { recordRoute } from '@/lib/recentRecordRoute';

/** "Lead, prospect and customer approvals" -- one pending list per CRM workflow
 *  the caller can read. Renders nothing while loading, on error, or when empty. */
export function CrmApprovalsSection() {
  const { hasPermission } = useUserPermissions();
  const { isWorkflowEnabled } = useWorkflows();
  const workflows = readableCrmApprovalWorkflows(hasPermission, isWorkflowEnabled);

  const results = useQueries({
    queries: workflows.map((w) => ({
      queryKey: [APPROVALS_INBOX_KEY, 'crm', w.key],
      queryFn: () => approvalInboxService.listCrmPending(w.key),
      retry: false,
    })),
  });

  const rows = workflows.flatMap((w, i) =>
    (results[i]?.data ?? []).map((record) => ({ workflow: w, record })),
  );
  if (rows.length === 0) return null;

  return (
    <section aria-labelledby="crm-approvals-heading" className="mt-8">
      <h2 id="crm-approvals-heading" className="text-sm font-semibold text-stone-900">
        Lead, prospect and customer approvals
      </h2>
      <ul className="mt-2 divide-y divide-stone-200 rounded-xl border border-stone-200 bg-white">
        {rows.map(({ workflow, record }) => {
          const href = recordRoute('crm', workflow.key, record.id);
          const title = crmRecordTitle(record);
          return (
            <li key={`${workflow.key}:${record.id}`} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
              <span className="min-w-0 truncate">
                <span className="text-stone-500">{workflow.label}</span>{' '}
                <Link to={href} className="font-semibold text-stone-900 underline-offset-2 hover:underline">
                  {title}
                </Link>
              </span>
              <Link
                to={href}
                aria-label={`Review ${workflow.label} ${title}`}
                className="inline-flex h-8 shrink-0 items-center rounded-lg bg-stone-900 px-3 text-xs font-medium text-white hover:bg-stone-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-400"
              >
                Review
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
