import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { platformService } from '@/services/tenantServices';
import { apiErrorMessage } from '@/api/tenantClient';
import { ErrorNote } from '@/components/tenant/ui';
import { TenantNumberSettingRow } from '@/components/customer/TenantNumberSettingRow';
import {
  DEFAULT_TAKEOVER_COOLDOWN_MINUTES,
  DEFAULT_TAKEOVER_DAILY_CAP,
  MAX_TAKEOVER_COOLDOWN_MINUTES,
  MAX_TAKEOVER_DAILY_CAP,
  changedLimits,
  parseLimit,
} from '@/lib/sessionPolicyForm';
import type { Tenant } from '@/types/tenant';

const COOLDOWN_LABEL = 'Wait between device switches';
const COOLDOWN_HELP =
  'After a user moves their sign-in to another device, how long before they can move it again. 0 = no wait.';
const CAP_LABEL = 'Device switches allowed per day';
const CAP_HELP =
  "After this many switches in 24 hours, switching is blocked for the day and the customer's administrators are emailed. 0 = unlimited.";

/**
 * The single-session rule's two limits for one customer, shown under its
 * switch while it is on. One Save button covers both; it sends only what
 * changed and is enabled only when that is valid.
 */
export function TenantSwitchLimits({ tenant }: { tenant: Tenant }) {
  const qc = useQueryClient();
  const saved = {
    cooldown: tenant.takeoverCooldownMinutes ?? DEFAULT_TAKEOVER_COOLDOWN_MINUTES,
    cap: tenant.takeoverDailyCap ?? DEFAULT_TAKEOVER_DAILY_CAP,
  };
  const [cooldownText, setCooldownText] = useState(String(saved.cooldown));
  const [capText, setCapText] = useState(String(saved.cap));
  const cooldown = parseLimit(cooldownText, MAX_TAKEOVER_COOLDOWN_MINUTES);
  const cap = parseLimit(capText, MAX_TAKEOVER_DAILY_CAP);
  const patch = changedLimits(saved, { cooldown: cooldown.value, cap: cap.value });
  const valid = !cooldown.error && !cap.error;
  const dirty = Object.keys(patch).length > 0;

  const save = useMutation({
    mutationFn: () => platformService.updateSessionPolicy(tenant.id, patch),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tenants'] });
      toast.success(`Device switch limits saved for ${tenant.displayName}.`);
    },
  });

  return (
    <div className="bg-stone-50/60">
      <TenantNumberSettingRow
        label={COOLDOWN_LABEL}
        description={COOLDOWN_HELP}
        value={cooldownText}
        onChange={setCooldownText}
        extra={{ unit: 'minutes', error: cooldown.error, max: MAX_TAKEOVER_COOLDOWN_MINUTES }}
      />
      <TenantNumberSettingRow
        label={CAP_LABEL}
        description={CAP_HELP}
        value={capText}
        onChange={setCapText}
        extra={{ unit: 'per day', error: cap.error, max: MAX_TAKEOVER_DAILY_CAP }}
      />
      {save.isError && (
        <div className="px-4 pb-2">
          <ErrorNote>{apiErrorMessage(save.error, 'Failed to save the limits.')}</ErrorNote>
        </div>
      )}
      <div className="flex justify-end px-4 pb-3.5">
        <button
          type="button"
          onClick={() => save.mutate()}
          disabled={!dirty || !valid || save.isPending}
          aria-label="Save device switch limits"
          className="rounded-lg bg-brand px-3 py-1.5 text-xs font-semibold text-stone-950 transition-all hover:bg-brand/80 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {save.isPending ? 'Saving…' : 'Save'}
        </button>
      </div>
    </div>
  );
}
