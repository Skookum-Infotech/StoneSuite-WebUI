import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Ban, ChevronLeft, Loader2, RotateCcw, ShieldCheck, ShieldOff, UsersRound, X } from "lucide-react";
import { toast } from "sonner";
import { apiErrorMessage } from "@/api/tenantClient";
import { useAuthStore } from "@/store/useAuthStore";
import { useUserPermissions } from "@/hooks/useUserPermissions";
import { cn } from "@/lib/utils";
import {
  SKIP_LABEL,
  bulkMessage,
  confirmText,
  displayName,
  planBulk,
  plural,
  type BulkAction,
} from "@/lib/userBulk";
import type { WorkspaceUser } from "@/types/tenant";
import { initials, avatarColor } from "../userHelpers";
import { runBulkAction } from "../runBulkAction";
import { BulkActionTile } from "./BulkActionTile";

const PREVIEW_LIMIT = 8;

interface ActionSpec {
  action: BulkAction;
  label: string;
  hint: string;
  verb: string;
  icon: typeof ShieldCheck;
}

const MFA_ACTIONS: ActionSpec[] = [
  { action: "mfa-on", label: "Turn on", hint: "They'll be asked for an emailed code at sign-in", verb: "Turn on two-step verification for", icon: ShieldCheck },
  { action: "mfa-off", label: "Turn off", hint: "They'll sign in with just a password", verb: "Turn off two-step verification for", icon: ShieldOff },
];

const STATUS_ACTIONS: ActionSpec[] = [
  { action: "suspend", label: "Suspend access", hint: "Signs them out and blocks sign-in", verb: "Suspend access for", icon: Ban },
  { action: "restore", label: "Restore access", hint: "Lets suspended members sign in again", verb: "Restore access for", icon: RotateCcw },
];

interface BulkConfigPanelProps {
  users: WorkspaceUser[];
  onRemove: (id: string) => void;
  onClear: () => void;
  onBack: () => void;
}

// Right-hand panel shown while members are ticked: configure all of them at
// once instead of opening each profile. Every action previews who it reaches
// and who it skips before anything changes.
export function BulkConfigPanel({ users, onRemove, onClear, onBack }: BulkConfigPanelProps) {
  const qc = useQueryClient();
  const selfIdentityId = useAuthStore((s) => s.user?.id);
  const { hasPermission, isSuperAdmin } = useUserPermissions();
  const canMfa = isSuperAdmin;
  const canStatus = isSuperAdmin || hasPermission("user", "update");
  const [pending, setPending] = useState<BulkAction | null>(null);

  const plans = useMemo(
    () => ({
      "mfa-on": planBulk("mfa-on", users, selfIdentityId, isSuperAdmin),
      "mfa-off": planBulk("mfa-off", users, selfIdentityId, isSuperAdmin),
      suspend: planBulk("suspend", users, selfIdentityId, isSuperAdmin),
      restore: planBulk("restore", users, selfIdentityId, isSuperAdmin),
    }),
    [users, selfIdentityId, isSuperAdmin],
  );

  const run = useMutation({
    mutationFn: async (action: BulkAction) => {
      const plan = plans[action];
      return { action, plan, outcome: await runBulkAction(action, plan.targets) };
    },
    onSuccess: ({ action, plan, outcome }) => {
      qc.invalidateQueries({ queryKey: ["users"] });
      const msg = bulkMessage(action, plan, outcome);
      if (msg.tone === "success") toast.success(msg.title, { description: msg.description });
      else toast.warning(msg.title, { description: msg.description });
      setPending(null);
      onClear();
    },
    onError: (err) => {
      toast.error(apiErrorMessage(err, "The change couldn't be made."));
      setPending(null);
    },
  });

  const twoStepOn = users.filter((u) => u.mfaEnabled).length;
  const confirming = pending ? plans[pending] : null;
  const spec = pending ? [...MFA_ACTIONS, ...STATUS_ACTIONS].find((a) => a.action === pending) : null;

  const renderTiles = (specs: ActionSpec[]) => (
    <div className="flex flex-col gap-2 sm:flex-row">
      {specs.map(({ action, label, hint, verb, icon }) => (
        <BulkActionTile
          key={action}
          icon={icon}
          label={label}
          hint={hint}
          count={plans[action].targets.length}
          ariaLabel={`${verb} ${plans[action].targets.length} selected`}
          onClick={() => setPending(action)}
        />
      ))}
    </div>
  );

  return (
    <div className="flex flex-col gap-5 p-3 sm:p-6">
      <button
        type="button"
        onClick={onBack}
        className="md:hidden flex items-center gap-1.5 text-xs font-semibold text-brand-dark"
      >
        <ChevronLeft className="size-3.5" />
        Back to Members
      </button>

      <div className="flex items-start gap-3">
        <div className="flex size-10 sm:size-12 shrink-0 items-center justify-center rounded-2xl bg-brand/20 text-brand-dark">
          <UsersRound className="size-5" aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-bold text-stone-900">Configure {plural(users.length, "user", "users")}</h2>
          <p className="text-xs text-stone-500">Changes apply to everyone selected. Nothing happens until you confirm.</p>
        </div>
        <button
          type="button"
          onClick={() => {
            setPending(null);
            onClear();
          }}
          disabled={run.isPending}
          aria-label="Clear selection"
          className="shrink-0 rounded-lg border border-stone-200 px-3 py-1.5 text-xs font-medium text-stone-600 transition hover:bg-stone-50 disabled:opacity-50"
        >
          Clear selection
        </button>
      </div>

      <ul aria-label="Selected users" className="flex flex-wrap gap-1.5">
        {users.map((u) => (
          <li
            key={u.id}
            className="inline-flex items-center gap-1.5 rounded-full border border-stone-200 bg-stone-50 py-1 pl-1 pr-2 text-xs font-medium text-stone-700"
          >
            <span className={cn("flex size-5 items-center justify-center rounded-full text-[9px] font-bold", avatarColor(u.id))}>
              {initials(displayName(u))}
            </span>
            {displayName(u)}
            <button
              type="button"
              onClick={() => onRemove(u.id)}
              disabled={run.isPending}
              aria-label={`Remove ${displayName(u)} from selection`}
              className="rounded-full p-0.5 text-stone-400 transition hover:bg-stone-200 hover:text-stone-600"
            >
              <X className="size-3" />
            </button>
          </li>
        ))}
      </ul>

      {pending && confirming && spec ? (
        <section aria-label="Confirm change" className="space-y-3 rounded-xl border border-stone-200 bg-stone-50 p-4">
          <p className="text-sm font-semibold text-stone-800">{confirmText(pending, confirming.targets.length)}</p>
          <ul className="space-y-1 text-xs text-stone-700">
            {confirming.targets.slice(0, PREVIEW_LIMIT).map((u) => (
              <li key={u.id}>{displayName(u)}</li>
            ))}
            {confirming.targets.length > PREVIEW_LIMIT && (
              <li className="text-stone-500">and {confirming.targets.length - PREVIEW_LIMIT} more</li>
            )}
          </ul>
          {confirming.skipped.length > 0 && (
            <div className="rounded-lg border border-stone-200 bg-white p-2.5 text-2xs text-stone-500">
              <p className="mb-1 font-semibold text-stone-600">Skipped</p>
              <ul className="space-y-0.5">
                {confirming.skipped.map(({ user, reason }) => (
                  <li key={user.id}>
                    {displayName(user)} — {SKIP_LABEL[reason]}
                  </li>
                ))}
              </ul>
            </div>
          )}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => run.mutate(pending)}
              disabled={run.isPending}
              aria-label="Confirm bulk action"
              className="flex items-center gap-1.5 rounded-lg bg-brand px-4 py-2 text-xs font-semibold text-stone-950 transition hover:bg-brand-hover disabled:opacity-50"
            >
              {run.isPending && <Loader2 className="size-3 animate-spin" aria-hidden="true" />}
              Confirm
            </button>
            <button
              type="button"
              onClick={() => setPending(null)}
              disabled={run.isPending}
              aria-label="Cancel bulk action"
              className="rounded-lg border border-stone-200 bg-white px-4 py-2 text-xs font-medium text-stone-600 transition hover:bg-stone-50 disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
        </section>
      ) : (
        <>
          {canMfa && (
            <section aria-label="Two-step verification" className="space-y-2">
              <div className="flex items-baseline justify-between gap-2">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-stone-500">Two-step verification</h3>
                <span className="text-2xs text-stone-500">
                  {twoStepOn} of {users.length} have it on
                </span>
              </div>
              {renderTiles(MFA_ACTIONS)}
            </section>
          )}
          {canStatus && (
            <section aria-label="Access" className="space-y-2">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-stone-500">Access</h3>
              {renderTiles(STATUS_ACTIONS)}
            </section>
          )}
        </>
      )}
    </div>
  );
}
