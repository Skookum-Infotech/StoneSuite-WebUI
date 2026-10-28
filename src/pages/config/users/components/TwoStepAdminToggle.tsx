import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { userService } from "@/services/tenantServices";
import { apiErrorMessage } from "@/api/tenantClient";
import { ErrorNote } from "@/components/tenant/ui";
import { Switch } from "@/components/ui/switch";
import { useAuthStore } from "@/store/useAuthStore";
import { displayName, mfaOutcome } from "@/lib/userBulk";
import type { WorkspaceUser } from "@/types/tenant";

// Super admin's switch for another member's two-step verification. Turning it
// on needs no setup from them: their next sign-in asks for an emailed code, and
// they get a notice either way.
export function TwoStepAdminToggle({ user }: { user: WorkspaceUser }) {
  const qc = useQueryClient();
  const selfIdentityId = useAuthStore((s) => s.user?.id);
  const [error, setError] = useState<string | null>(null);

  const change = useMutation({
    mutationFn: (enabled: boolean) => userService.setUsersMfa([user.id], enabled),
    onSuccess: (results, enabled) => {
      const { failed } = mfaOutcome(results, [user]);
      if (failed.length > 0) {
        setError(`Two-step verification ${failed[0].message}.`);
        return;
      }
      setError(null);
      qc.invalidateQueries({ queryKey: ["users"] });
      toast.success(`Two-step verification turned ${enabled ? "on" : "off"} for ${displayName(user)}`);
    },
    onError: (err) => setError(apiErrorMessage(err, "Couldn't change two-step verification.")),
  });

  // Older backends don't report the setting: say so rather than hide the row.
  const reported = user.mfaEnabled !== undefined;
  const isSelf = user.identityId === selfIdentityId;
  const unavailable = user.mfaAvailable === false;
  const description = !reported
    ? "The server didn't report this setting. Update the backend to manage it here."
    : isSelf
    ? "Manage your own in Account Settings."
    : unavailable
      ? "Signs in with single sign-on, so there is no code to add."
      : user.mfaEnabled
        ? "After their password, they're asked for a code emailed to them."
        : "Off. Turn on to ask for an emailed code after their password.";

  return (
    <div className="mb-4 sm:mb-6">
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-stone-500">
        Two-step verification
      </h3>
      <div className="flex items-center gap-3 rounded-lg border border-stone-200 px-3 py-2.5">
        <div className="min-w-0 flex-1">
          <p className="text-xs sm:text-sm font-medium text-stone-700">Email code at sign-in</p>
          <p className="text-2xs text-stone-500">{description}</p>
        </div>
        {change.isPending && <Loader2 className="size-4 animate-spin text-stone-400" aria-hidden="true" />}
        <Switch
          checked={user.mfaEnabled === true}
          disabled={change.isPending || isSelf || unavailable || !reported}
          onCheckedChange={(next) => {
            setError(null);
            change.mutate(next);
          }}
          aria-label={`Two-step verification for ${displayName(user)}`}
        />
      </div>
      {error && (
        <div className="mt-2">
          <ErrorNote>{error}</ErrorNote>
        </div>
      )}
    </div>
  );
}
