import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { platformService } from '@/services/tenantServices';
import { apiErrorMessage } from '@/api/tenantClient';
import { ErrorNote } from '@/components/tenant/ui';
import { SectionCard } from '@/components/customer/TenantSectionCard';
import { TenantSettingRow } from '@/components/customer/TenantSettingRow';
import { TenantDialog } from '@/components/customer/TenantDialog';
import { TenantSwitchLimits } from '@/components/customer/TenantSwitchLimits';
import type { Tenant } from '@/types/tenant';

const SINGLE_SESSION_LABEL = 'Enforce single session';
const SINGLE_SESSION_HELP =
  'Each user can be signed in on only one browser at a time. Signing in elsewhere asks to end the other session.';
const OWNER_EXEMPT_NOTE = 'Platform users are always exempt.';

/** The customer detail page's Settings tab: per-customer feature controls. */
export function TenantSettingsTab({ tenant }: { tenant: Tenant }) {
  const qc = useQueryClient();
  // An older backend omits the field; the rule is on by default for customers.
  const enforced = tenant.isPlatformOwner ? false : (tenant.singleSessionEnforced ?? true);
  const [pending, setPending] = useState<boolean | null>(null);

  const save = useMutation({
    mutationFn: (next: boolean) => platformService.updateSessionPolicy(tenant.id, { enforced: next }),
    onSuccess: (_data, next) => {
      qc.invalidateQueries({ queryKey: ['tenants'] });
      toast.success(`Single session ${next ? 'turned on' : 'turned off'} for ${tenant.displayName}.`);
      setPending(null);
    },
  });

  const close = () => {
    if (!save.isPending) setPending(null);
  };

  return (
    <div className="space-y-5">
      <SectionCard title="Security & access">
        <div className="divide-y divide-stone-100">
          <TenantSettingRow
            label={SINGLE_SESSION_LABEL}
            description={SINGLE_SESSION_HELP}
            checked={enforced}
            onChange={(next) => {
              save.reset();
              setPending(next);
            }}
            state={{
              saving: save.isPending,
              disabled: tenant.isPlatformOwner,
              note: tenant.isPlatformOwner ? OWNER_EXEMPT_NOTE : undefined,
            }}
          />
          {enforced && !tenant.isPlatformOwner && <TenantSwitchLimits key={tenant.id} tenant={tenant} />}
        </div>
      </SectionCard>

      {pending !== null && (
        <TenantDialog
          title={`${pending ? 'Turn on' : 'Turn off'} single session?`}
          subtitle={tenant.displayName}
          tone="warning"
          onClose={close}
        >
          <p className="text-xs text-stone-600">
            {pending
              ? 'Each user will be limited to one browser at a time. Users signed in on several browsers now keep only the one they used most recently; the others get a 30-second warning and are signed out.'
              : 'Users will be able to stay signed in on several browsers at once, so one login could be shared.'}
          </p>
          {save.isError && <ErrorNote>{apiErrorMessage(save.error, 'Failed to update the setting.')}</ErrorNote>}
          <div className="mt-5 flex justify-end gap-2">
            <button
              type="button"
              onClick={close}
              disabled={save.isPending}
              aria-label="Cancel"
              className="rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-xs font-medium text-stone-600 hover:bg-stone-50 disabled:opacity-40"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => save.mutate(pending)}
              disabled={save.isPending}
              aria-label={pending ? 'Turn on single session' : 'Turn off single session'}
              className="rounded-lg bg-warning px-3 py-1.5 text-xs font-semibold text-white hover:bg-warning/90 disabled:opacity-50"
            >
              {save.isPending ? 'Saving…' : pending ? 'Turn on' : 'Turn off'}
            </button>
          </div>
        </TenantDialog>
      )}
    </div>
  );
}
