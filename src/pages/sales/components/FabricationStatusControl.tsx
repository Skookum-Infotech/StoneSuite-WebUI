import { useUserPermissions } from '@/hooks/useUserPermissions';
import { FJ_STATUS_CODES, FJ_LINEAR_TRANSITIONS, FJ_STATUS_COLORS, needsApproval } from '@/lib/fabricationForm';
import { StatusSelect } from './StatusSelect';
import type { FabricationJob } from '@/types/fabrication';

// Forward-path status select for the Fabrication Job Edit/Detail pages.
// Legal moves mirror the backend fabrication/transitions.go linear happy path
// (plus the QCPD->EDGP rework edge) — HOLD and CANC are never options here,
// since Hold/Resume/Cancel are their own dedicated controls rendered
// alongside this one (see FabricationHoldResumeControl and
// CancelFabricationJobDialog). Every move needs installation:transition; a
// move is additionally blocked client-side while approvalStatus is 'pending'
// (the current status has configured approvers awaiting sign-off) — the
// backend would 409 with ErrApprovalRequired anyway, this just explains why
// up front instead of after a failed save.
export function FabricationStatusControl({ job, onChange, disabled, variant }: {
  job: Pick<FabricationJob, 'statusCode' | 'approvalStatus'> & { gated?: boolean };
  onChange: (code: string) => void;
  disabled?: boolean;
  variant?: 'field' | 'pill';
}) {
  const { hasPermission, isLoading } = useUserPermissions();
  const guard = () => {
    if (!isLoading && !hasPermission('installation', 'transition')) {
      return { permitted: false, reason: 'You do not have permission to change status' };
    }
    if (needsApproval(job)) {
      return { permitted: false, reason: 'Awaiting approval', needsApprove: true };
    }
    return { permitted: true };
  };

  return (
    <StatusSelect
      value={job.statusCode}
      onChange={onChange}
      disabled={disabled}
      statuses={FJ_STATUS_CODES}
      allowedTransitions={FJ_LINEAR_TRANSITIONS}
      guard={guard}
      variant={variant}
      colorFor={(s) => FJ_STATUS_COLORS[s.label] ?? '#a8a29e'}
    />
  );
}
