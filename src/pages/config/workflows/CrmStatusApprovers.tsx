import { useState } from 'react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { ShieldCheck, ChevronDown } from 'lucide-react';
import { crmService, CRM_RECORD_TYPE_CODES, type CRMWorkflowKey } from '@/services/crmService';
import { crmAdminService, type CrmApprover } from '@/services/crmAdminService';
import { lookupService } from '@/services/lookupService';
import { apiErrorMessage } from '@/api/tenantClient';
import { Badge, Spinner, ErrorNote } from '@/components/tenant/ui';
import { ApproverPicker, MAX_APPROVERS, type ApproverCandidate } from '@/components/tenant/ApproverPicker';
import { useUserPermissions } from '@/hooks/useUserPermissions';
import { cn } from '@/lib/utils';

// Per-status approver config for CRM (lead/prospect/customer) workflows.
// Backed by crm_workflow_approver (crm_status_id scoped), the table that
// actually gates real record transitions — unlike the generic workflow
// engine's workflow_state_approver, which only applies to non-CRM workflows
// (Estimate, Sales/Purchase orders). The wildcard (any-status) approver set
// is managed separately by the "Approval chain" section above this one.
export function CrmStatusApprovers({ workflowKey }: { workflowKey: CRMWorkflowKey }) {
  const { hasPermission, isLoading: permsLoading } = useUserPermissions();
  const canRead = permsLoading || hasPermission('workflow_config', 'read');
  const canConfigure = hasPermission('workflow_config', 'configure');
  const [expandedCode, setExpandedCode] = useState<string | null>(null);
  const recordTypeCode = CRM_RECORD_TYPE_CODES[workflowKey];

  const statusesQ = useQuery({
    queryKey: ['crm-statuses', workflowKey],
    queryFn: () => crmService.getWorkflowStatuses(workflowKey),
    enabled: canRead,
    staleTime: 5 * 60 * 1000,
  });
  const approversQ = useQuery({
    queryKey: ['crm-approvers'],
    queryFn: crmAdminService.listApprovers,
    enabled: canRead,
    staleTime: 60 * 1000,
  });

  const statuses = statusesQ.data?.statuses ?? [];
  const approversByStatus = new Map<string, CrmApprover[]>();
  for (const a of approversQ.data ?? []) {
    if (a.recordTypeCode !== recordTypeCode || a.crmStatusCode === '') continue;
    const list = approversByStatus.get(a.crmStatusCode) ?? [];
    list.push(a);
    approversByStatus.set(a.crmStatusCode, list);
  }

  const loading = statusesQ.isLoading || approversQ.isLoading;
  const loadError = statusesQ.error ?? approversQ.error;

  return (
    <section className="rounded-[10px] border border-stone-200 bg-white p-5 dark:border-stone-800 dark:bg-stone-900">
      <div className="mb-3 flex items-center justify-between gap-3 border-b border-stone-100 pb-3 dark:border-stone-800">
        <div>
          <h2 className="text-sm font-semibold text-stone-950 dark:text-white">Status approvers</h2>
          <p className="mt-1 text-xs text-stone-500">
            Require sign-off before a record can leave <em>this</em> status only — in addition to the approval chain above.
          </p>
        </div>
        <Badge size="sm">Per status</Badge>
      </div>

      {loading ? (
        <Spinner label="Loading statuses…" />
      ) : statuses.length === 0 ? (
        <p className="text-xs text-stone-400">No statuses configured.</p>
      ) : (
        <div className="grid gap-x-8 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
          {statuses.map((s) => {
            const forStatus = approversByStatus.get(s.stateKey) ?? [];
            const gated = forStatus.length > 0;
            const expanded = expandedCode === s.stateKey;
            return (
              <div key={s.stateId}>
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="truncate text-xs font-semibold text-stone-900 dark:text-stone-100">{s.statusLabel}</span>
                  {gated && (
                    <Badge color="#f59e0b" size="sm">
                      Approval required
                    </Badge>
                  )}
                </div>

                {canRead && (
                  <button
                    type="button"
                    aria-expanded={expanded}
                    aria-label={`${expanded ? 'Hide' : 'Show'} approvers for ${s.statusLabel}`}
                    onClick={() => setExpandedCode(expanded ? null : s.stateKey)}
                    className="mt-1.5 flex items-center gap-1 text-2xs font-medium text-stone-400 transition-colors hover:text-stone-600 dark:hover:text-stone-300"
                  >
                    <ShieldCheck className="size-3" />
                    {gated ? `${forStatus.length} approver${forStatus.length > 1 ? 's' : ''}` : 'No approvers'}
                    <ChevronDown className={cn('size-3 transition-transform', expanded && 'rotate-180')} />
                  </button>
                )}

                {expanded && (
                  <StatusApproverEditor
                    recordTypeCode={recordTypeCode}
                    crmStatusCode={s.stateKey}
                    approvers={forStatus}
                    canConfigure={canConfigure}
                  />
                )}
              </div>
            );
          })}
        </div>
      )}

      {loadError && (
        <div className="mt-3">
          <ErrorNote>{apiErrorMessage(loadError, 'Failed to load statuses or approvers.')}</ErrorNote>
        </div>
      )}
    </section>
  );
}

function StatusApproverEditor({
  recordTypeCode,
  crmStatusCode,
  approvers,
  canConfigure,
}: {
  recordTypeCode: string;
  crmStatusCode: string;
  approvers: CrmApprover[];
  canConfigure: boolean;
}) {
  const qc = useQueryClient();
  const employeesQ = useQuery({
    queryKey: ['crm-lookups'],
    queryFn: lookupService.getCrmLookups,
    staleTime: 5 * 60 * 1000,
  });
  const [error, setError] = useState<string | null>(null);

  const employees: ApproverCandidate[] = (employeesQ.data?.employees ?? []).map((e) => ({
    id: String(e.id),
    fullName: e.name,
    email: '',
  }));
  const selected = approvers.map((a) => String(a.approverEmployeeId));
  const rowByEmployeeId = new Map(approvers.map((a) => [String(a.approverEmployeeId), a]));

  const create = useMutation({
    mutationFn: (employeeId: string) =>
      crmAdminService.createApprover({ recordTypeCode, crmStatusCode, approverEmployeeId: Number(employeeId) }),
    onSuccess: () => {
      setError(null);
      qc.invalidateQueries({ queryKey: ['crm-approvers'] });
    },
    onError: (err: unknown) => setError(apiErrorMessage(err, 'Failed to add approver.')),
  });
  const remove = useMutation({
    mutationFn: (approverId: number) => crmAdminService.deleteApprover(approverId),
    onSuccess: () => {
      setError(null);
      qc.invalidateQueries({ queryKey: ['crm-approvers'] });
    },
    onError: (err: unknown) => setError(apiErrorMessage(err, 'Failed to remove approver.')),
  });

  const wrapCls = 'mt-2 rounded-lg border border-stone-100 bg-stone-50 p-2.5 dark:border-stone-800 dark:bg-stone-950/30';

  if (!canConfigure) {
    return (
      <div className={wrapCls}>
        {approvers.length === 0 ? (
          <p className="text-2xs text-stone-400">No approvers configured for this status.</p>
        ) : (
          <p className="text-2xs text-stone-600 dark:text-stone-300">{approvers.map((a) => a.approverName).join(', ')}</p>
        )}
      </div>
    );
  }

  return (
    <div className={wrapCls}>
      {employeesQ.isLoading ? (
        <Spinner label="Loading employees…" />
      ) : (
        <ApproverPicker
          users={employees}
          selected={selected}
          onAdd={(employeeId) => {
            if (selected.length >= MAX_APPROVERS || selected.includes(employeeId)) return;
            create.mutate(employeeId);
          }}
          onRemove={(employeeId) => {
            const row = rowByEmployeeId.get(employeeId);
            if (row) remove.mutate(row.id);
          }}
          disabled={create.isPending || remove.isPending}
        />
      )}
      {error && (
        <div className="mt-2">
          <ErrorNote>{error}</ErrorNote>
        </div>
      )}
    </div>
  );
}
