import { useEffect, useState } from 'react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { workflowService } from '@/services/tenantServices';
import { apiErrorMessage } from '@/api/tenantClient';
import { Badge, Spinner, ErrorNote } from '@/components/tenant/ui';
import { ApproverPicker, MAX_APPROVERS, type ApproverCandidate } from '@/components/tenant/ApproverPicker';
import { useUserPermissions } from '@/hooks/useUserPermissions';
import type { ApprovalGate, ApprovalChainEmployee } from '@/types/tenant';

type ApprovalChain = { gates: ApprovalGate[]; employees: ApprovalChainEmployee[] };

// setApprovalChain always replaces the gate's full approver list (never
// incremental), so rapid add/remove clicks are safe to collapse into a
// single call -- only the state after this pause actually gets sent.
const APPROVAL_CHAIN_SAVE_DEBOUNCE_MS = 500;

// Approval chain for a relational document module (Estimate, Quote, Sales
// Order, Purchase Order, Requisition, Vendor Bill, Vendor Payment, Expense,
// Fabrication Job). Every configured approver must sign off before the
// record can leave the named gate status -- see
// workflowService.getApprovalChain. Most modules have exactly one gate;
// Fabrication Job has two (Templating, QC Pending), rendered as separate
// cards side by side.
export function ApprovalChainSection({ workflowId }: { workflowId: string }) {
  const { hasPermission, isLoading: permsLoading } = useUserPermissions();
  const canRead = permsLoading || hasPermission('workflow_config', 'read');
  const canConfigure = hasPermission('workflow_config', 'configure');

  const chainQ = useQuery({
    queryKey: ['approval-chain', workflowId],
    queryFn: () => workflowService.getApprovalChain(workflowId),
    enabled: canRead,
    staleTime: 60 * 1000,
  });

  const gates = chainQ.data?.gates ?? [];
  const employees: ApproverCandidate[] = (chainQ.data?.employees ?? []).map((e) => ({
    id: e.id,
    fullName: e.name,
    email: '',
  }));
  const loading = chainQ.isLoading;
  const loadError = chainQ.error;

  return (
    <section className="rounded-[10px] border border-stone-200 bg-white p-5 dark:border-stone-800 dark:bg-stone-900">
      <div className="mb-3 flex items-center justify-between gap-3 border-b border-stone-100 pb-3 dark:border-stone-800">
        <div>
          <h2 className="text-sm font-semibold text-stone-950 dark:text-white">Approval chain</h2>
          <p className="mt-1 text-xs text-stone-500">
            Up to {MAX_APPROVERS} active employees who must sign off before a record can leave the named status.
          </p>
        </div>
        <Badge size="sm">{gates.length > 1 ? `${gates.length} gates` : 'Approval gate'}</Badge>
      </div>

      {loading ? (
        <Spinner label="Loading approval chain…" />
      ) : gates.length === 0 ? (
        <p className="text-xs text-stone-400">No approval gates configured for this workflow.</p>
      ) : (
        <div className="grid gap-x-8 gap-y-4 sm:grid-cols-2">
          {gates.map((gate) => (
            <ApprovalGateEditor
              key={gate.statusCode}
              workflowId={workflowId}
              gate={gate}
              employees={employees}
              canConfigure={canConfigure}
            />
          ))}
        </div>
      )}

      {loadError && (
        <div className="mt-3">
          <ErrorNote>{apiErrorMessage(loadError, 'Failed to load approval chain.')}</ErrorNote>
        </div>
      )}
    </section>
  );
}

function ApprovalGateEditor({
  workflowId,
  gate,
  employees,
  canConfigure,
}: {
  workflowId: string;
  gate: ApprovalGate;
  employees: ApproverCandidate[];
  canConfigure: boolean;
}) {
  const qc = useQueryClient();
  const byId = new Map(employees.map((e) => [e.id, e]));

  // Sync localIds from the confirmed server state during render (not an
  // effect) whenever gate.approverEmployeeIds changes underneath us --
  // e.g. after this gate's own save lands, or another tab's edit surfaces
  // through the query cache.
  const [confirmedIds, setConfirmedIds] = useState(gate.approverEmployeeIds);
  const [localIds, setLocalIds] = useState(gate.approverEmployeeIds);
  if (gate.approverEmployeeIds !== confirmedIds) {
    setConfirmedIds(gate.approverEmployeeIds);
    setLocalIds(gate.approverEmployeeIds);
  }

  const update = useMutation({
    mutationFn: (ids: string[]) => workflowService.setApprovalChain(workflowId, gate.statusCode, ids),
    onSuccess: (approverEmployeeIds) => {
      qc.setQueryData<ApprovalChain>(['approval-chain', workflowId], (prev) =>
        prev && {
          ...prev,
          gates: prev.gates.map((g) => (g.statusCode === gate.statusCode ? { ...g, approverEmployeeIds } : g)),
        },
      );
      toast.success('Approval chain updated.');
    },
    onError: () => setLocalIds(confirmedIds),
  });

  // Batch rapid add/remove clicks into one save: fire only after localIds
  // has settled for APPROVAL_CHAIN_SAVE_DEBOUNCE_MS, instead of one PUT per click.
  useEffect(() => {
    if (localIds === confirmedIds) return;
    const timer = setTimeout(() => update.mutate(localIds), APPROVAL_CHAIN_SAVE_DEBOUNCE_MS);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [localIds]);

  return (
    <div>
      <p className="mb-1.5 text-xs font-semibold text-stone-900 dark:text-stone-100">
        Before leaving <span className="font-normal text-stone-500">{gate.statusLabel}</span>
      </p>
      {!canConfigure ? (
        gate.approverEmployeeIds.length === 0 ? (
          <p className="text-2xs text-stone-400">No approvers configured.</p>
        ) : (
          <p className="text-2xs text-stone-600 dark:text-stone-300">
            {gate.approverEmployeeIds.map((id) => byId.get(id)?.fullName || 'Unknown employee').join(', ')}
          </p>
        )
      ) : (
        <>
          <ApproverPicker
            users={employees}
            selected={localIds}
            onAdd={(id) => {
              if (localIds.length >= MAX_APPROVERS || localIds.includes(id)) return;
              setLocalIds([...localIds, id]);
            }}
            onRemove={(id) => setLocalIds(localIds.filter((x) => x !== id))}
            disabled={update.isPending}
          />
          {update.error && (
            <div className="mt-2">
              <ErrorNote>{apiErrorMessage(update.error, 'Failed to update approval chain.')}</ErrorNote>
            </div>
          )}
        </>
      )}
    </div>
  );
}
