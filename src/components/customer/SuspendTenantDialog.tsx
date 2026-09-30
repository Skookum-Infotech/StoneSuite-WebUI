import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { platformService } from '@/services/tenantServices';
import { apiErrorMessage } from '@/api/tenantClient';
import { ErrorNote } from '@/components/tenant/ui';
import { TenantDialog } from '@/components/customer/TenantDialog';
import type { Tenant } from '@/types/tenant';

type Props = {
  tenant: Tenant;
  onClose: () => void;
};

// Reversible: suspending blocks every user of the customer until it is restored,
// and deletes nothing.
export function SuspendTenantDialog({ tenant, onClose }: Props) {
  const qc = useQueryClient();

  const suspend = useMutation({
    mutationFn: () => platformService.lifecycle(tenant.id, 'suspend'),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tenants'] });
      toast.success(`${tenant.displayName} was suspended.`);
      onClose();
    },
  });

  const close = () => {
    if (!suspend.isPending) onClose();
  };

  return (
    <TenantDialog
      title={`Suspend ${tenant.displayName}?`}
      subtitle="You can restore access at any time."
      tone="warning"
      onClose={close}
    >
      <p className="text-xs text-stone-600">
        Everyone at <span className="font-semibold">{tenant.displayName}</span> is blocked from signing in to their
        workspace until you restore it. No data is deleted.
      </p>

      {suspend.error && (
        <div className="mt-3">
          <ErrorNote>{apiErrorMessage(suspend.error, 'Failed to suspend customer.')}</ErrorNote>
        </div>
      )}

      <div className="mt-5 flex justify-end gap-2">
        <button
          type="button"
          onClick={close}
          disabled={suspend.isPending}
          className="rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-xs font-medium text-stone-600 hover:bg-stone-50 disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={() => suspend.mutate()}
          disabled={suspend.isPending}
          className="rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-semibold text-stone-950 transition-all hover:bg-amber-400 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {suspend.isPending ? 'Suspending…' : 'Suspend'}
        </button>
      </div>
    </TenantDialog>
  );
}
