import { useId, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { platformService } from '@/services/tenantServices';
import { apiErrorMessage } from '@/api/tenantClient';
import { isPurgeConfirmed } from '@/lib/tenantLifecycle';
import { ErrorNote } from '@/components/tenant/ui';
import { TenantDialog } from '@/components/customer/TenantDialog';
import type { Tenant } from '@/types/tenant';

type Props = {
  tenant: Tenant;
  onClose: () => void;
  onPurged: () => void;
};

// Irreversible delete of a customer: the backend empties and deletes its storage
// bucket, drops its database and removes its records. Gated by typing the slug;
// the backend re-checks it, so this is friction, not the safeguard.
export function PurgeTenantDialog({ tenant, onClose, onPurged }: Props) {
  const qc = useQueryClient();
  const inputId = useId();
  const [typed, setTyped] = useState('');

  const purge = useMutation({
    mutationFn: () => platformService.purgeTenant(tenant.id, tenant.slug),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tenants'] });
      toast.success(`${tenant.displayName} was permanently deleted.`);
      onPurged();
    },
  });

  // Closing mid-request would hide the outcome of a destructive call.
  const close = () => {
    if (!purge.isPending) onClose();
  };

  const hasWorkspace = Boolean(tenant.dbName);
  const confirmed = isPurgeConfirmed(tenant.slug, typed);

  return (
    <TenantDialog
      title={`Permanently delete ${tenant.displayName}?`}
      subtitle="This cannot be undone."
      tone="danger"
      onClose={close}
    >
      <p className="text-xs text-stone-600">This immediately and irreversibly removes:</p>
      <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-stone-700">
        {tenant.dbName && (
          <li>
            the database <code className="font-mono text-stone-900">{tenant.dbName}</code> and everything in it
          </li>
        )}
        {tenant.r2Bucket && (
          <li>
            the storage bucket <code className="font-mono text-stone-900">{tenant.r2Bucket}</code> and every uploaded
            file
          </li>
        )}
        <li>{hasWorkspace ? 'all users, invites and settings for this customer' : 'this application, its invites and settings'}</li>
      </ul>

      <div className="mt-4 space-y-1.5">
        <label htmlFor={inputId} className="text-xs font-semibold text-stone-500">
          Type <span className="font-mono text-stone-900">{tenant.slug}</span> to confirm
        </label>
        <input
          id={inputId}
          type="text"
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          disabled={purge.isPending}
          autoFocus
          autoComplete="off"
          spellCheck={false}
          aria-label={`Type ${tenant.slug} to confirm`}
          className="w-full rounded-lg border border-stone-200 bg-stone-50 px-3 py-2 font-mono text-xs text-stone-800 focus:border-destructive/30 focus:outline-none focus:ring-2 focus:ring-destructive/10 disabled:opacity-50"
        />
      </div>

      {purge.error && (
        <div className="mt-3">
          <ErrorNote>{apiErrorMessage(purge.error, 'Failed to delete customer.')}</ErrorNote>
        </div>
      )}

      <div className="mt-5 flex justify-end gap-2">
        <button
          type="button"
          onClick={close}
          disabled={purge.isPending}
          className="rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-xs font-medium text-stone-600 hover:bg-stone-50 disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={() => purge.mutate()}
          disabled={!confirmed || purge.isPending}
          className="rounded-lg bg-destructive px-3 py-1.5 text-xs font-semibold text-white transition-all hover:bg-destructive/90 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {purge.isPending ? 'Deleting…' : 'Delete permanently'}
        </button>
      </div>
    </TenantDialog>
  );
}
