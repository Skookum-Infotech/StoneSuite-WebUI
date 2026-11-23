import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { PauseCircle, PlayCircle, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { platformService } from '@/services/tenantServices';
import { apiErrorMessage } from '@/api/tenantClient';
import { tenantActionState } from '@/lib/tenantLifecycle';
import { Badge } from '@/components/tenant/ui';
import { PurgeTenantDialog } from '@/components/customer/PurgeTenantDialog';
import { SuspendTenantDialog } from '@/components/customer/SuspendTenantDialog';
import type { Tenant } from '@/types/tenant';

type Props = {
  tenant: Tenant;
  /** Called after the customer is permanently deleted (e.g. to leave its detail page). */
  onPurged?: () => void;
};

type OpenDialog = 'suspend' | 'purge' | null;

const BUTTON_BASE =
  'inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-label font-semibold transition disabled:opacity-50';

// Suspend / Restore / Delete permanently for one customer. What shows is decided
// by tenantActionState; the backend enforces the same rules.
export function TenantActions({ tenant, onPurged }: Props) {
  const qc = useQueryClient();
  const [dialog, setDialog] = useState<OpenDialog>(null);
  const actions = tenantActionState(tenant);

  const restore = useMutation({
    mutationFn: () => platformService.lifecycle(tenant.id, 'restore'),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tenants'] });
      toast.success(`${tenant.displayName} was restored.`);
    },
    onError: (err: unknown) => toast.error(apiErrorMessage(err, 'Failed to restore customer.')),
  });

  if (actions.isProtected) {
    return <Badge size="sm">Platform owner</Badge>;
  }

  return (
    <div className="flex shrink-0 items-center gap-2">
      {actions.canSuspend && (
        <button
          type="button"
          onClick={() => setDialog('suspend')}
          aria-label={`Suspend ${tenant.displayName}`}
          className={`${BUTTON_BASE} border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100`}
        >
          <PauseCircle className="size-3" aria-hidden="true" /> Suspend
        </button>
      )}
      {actions.canRestore && (
        <button
          type="button"
          onClick={() => restore.mutate()}
          disabled={restore.isPending}
          aria-label={`Restore ${tenant.displayName}`}
          className={`${BUTTON_BASE} border-green-300 bg-green-50 text-green-800 hover:bg-green-100`}
        >
          <PlayCircle className="size-3" aria-hidden="true" /> {restore.isPending ? 'Restoring…' : 'Restore'}
        </button>
      )}
      {actions.canPurge && (
        <button
          type="button"
          onClick={() => setDialog('purge')}
          aria-label={`Delete ${tenant.displayName} permanently`}
          className={`${BUTTON_BASE} border-red-200 bg-white text-red-600 hover:bg-red-50`}
        >
          <Trash2 className="size-3" aria-hidden="true" /> Delete
        </button>
      )}

      {dialog === 'suspend' && <SuspendTenantDialog tenant={tenant} onClose={() => setDialog(null)} />}
      {dialog === 'purge' && (
        <PurgeTenantDialog
          tenant={tenant}
          onClose={() => setDialog(null)}
          onPurged={() => {
            setDialog(null);
            onPurged?.();
          }}
        />
      )}
    </div>
  );
}
