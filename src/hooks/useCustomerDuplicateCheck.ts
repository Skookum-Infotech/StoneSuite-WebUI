import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { crmService } from '@/services/crmService';
import { apiErrorMessage } from '@/api/tenantClient';
import { customerActiveStateId, customerRecordIsUsable } from '@/lib/crmStatusFlow';
import { findDuplicateMatch, type DuplicateCandidate, type DuplicateMatchStatus } from '@/lib/duplicateRecordCheck';
import type { WorkflowRecord } from '@/types/tenant';

export interface CustomerDuplicate {
  id: string;
  name: string;
  status: DuplicateMatchStatus;
  statusLabel: string;
  /** stateId to transition to for Activate & Use — undefined only if the
   *  workflow's status catalog somehow has no Active state. */
  activeStateId?: string;
}

interface UseCustomerDuplicateCheckOptions {
  /** Called once the flagged duplicate has been transitioned to Active. */
  onActivated: (record: WorkflowRecord) => void;
}

/** AddCustomerPage's pre-submit duplicate-name check (see
 *  lib/duplicateRecordCheck.ts) plus the "Activate & Use" action for a match
 *  that isn't Active yet — keeps that plumbing out of the page component. */
export function useCustomerDuplicateCheck({ onActivated }: UseCustomerDuplicateCheckOptions) {
  const queryClient = useQueryClient();
  const [duplicate, setDuplicate] = useState<CustomerDuplicate | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const [checkError, setCheckError] = useState<string | null>(null);

  const { mutate: activate, isPending: isActivating } = useMutation({
    mutationFn: (vars: { id: string; stateId: string }) =>
      crmService.transitionRecord(vars.id, vars.stateId, 'customer'),
    onSuccess: (record) => {
      queryClient.invalidateQueries({ queryKey: ['crm-records', 'customer'] });
      setDuplicate(null);
      onActivated(record);
    },
  });

  /** Resolves true when `name` is free to create, false when a duplicate was
   *  found (and `duplicate` now describes it) or the check itself failed. */
  async function check(name: string): Promise<boolean> {
    setCheckError(null);
    setIsChecking(true);
    try {
      const [{ records }, { statuses }] = await Promise.all([
        crmService.searchRecords('customer', {
          filters: [{ field: 'core:customer_name', op: 'contains', value: name }],
          limit: 25,
        }),
        crmService.getWorkflowStatuses('customer'),
      ]);
      const candidates: (DuplicateCandidate & { statusLabel: string })[] = records.map((r) => ({
        id: r.id,
        name: String(r.coreFields.customer_name ?? ''),
        isUsable: customerRecordIsUsable(r.currentStateId, statuses),
        statusLabel: statuses.find((s) => s.stateId === r.currentStateId)?.statusLabel ?? 'Unknown',
      }));
      const match = findDuplicateMatch(candidates, name);
      if (!match) return true;
      setDuplicate({
        id: match.candidate.id,
        name: match.candidate.name,
        status: match.status,
        statusLabel: match.candidate.statusLabel,
        activeStateId: customerActiveStateId(statuses),
      });
      return false;
    } catch (err) {
      setCheckError(apiErrorMessage(err, "Couldn't check for an existing customer with this name. Please try again."));
      return false;
    } finally {
      setIsChecking(false);
    }
  }

  function activateDuplicate() {
    if (duplicate?.activeStateId) activate({ id: duplicate.id, stateId: duplicate.activeStateId });
  }

  return {
    duplicate,
    dismissDuplicate: () => setDuplicate(null),
    activateDuplicate,
    isActivating,
    check,
    isChecking,
    checkError,
  };
}
