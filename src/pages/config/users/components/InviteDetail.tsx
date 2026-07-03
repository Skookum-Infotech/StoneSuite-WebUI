import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Mail, Send, X, Loader2 } from "lucide-react";
import { userService } from "@/services/tenantServices";
import { apiErrorMessage } from "@/api/tenantClient";
import { ErrorNote } from "@/components/tenant/ui";
import { cn } from "@/lib/utils";
import type { UserInvite } from "@/types/tenant";
import { fmtDate } from "../userHelpers";
import { InviteStatusBadge } from "./InviteStatusBadge";

export function InviteDetail({ invite }: { invite: UserInvite }) {
  const qc = useQueryClient();
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [confirmRevoke, setConfirmRevoke] = useState(false);

  const resendMut = useMutation({
    mutationFn: () => userService.resendInvite(invite.ID),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["invites"] });
      setActionError(null);
      setActionSuccess(data.message ?? "Invitation resent.");
    },
    onError: (err) => {
      setActionError(apiErrorMessage(err));
      setActionSuccess(null);
    },
  });

  const revokeMut = useMutation({
    mutationFn: () => userService.revokeInvite(invite.ID),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["invites"] });
      setActionError(null);
      setActionSuccess("Invitation revoked.");
    },
    onError: (err) => {
      setActionError(apiErrorMessage(err));
      setActionSuccess(null);
    },
  });

  const busy = resendMut.isPending || revokeMut.isPending;
  const isExpired =
    invite.Status === "pending" && new Date() > new Date(invite.ExpiresAt);
  const canResend = invite.Status === "pending"; // works even if expired
  const canRevoke = invite.Status === "pending";

  return (
    <div className="flex flex-col h-full p-6">
      <div className="flex items-start gap-4 mb-6">
        <div className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-stone-100 text-stone-500">
          <Mail className="size-6" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <h2 className="text-base font-bold text-stone-900 truncate">
              {invite.Email}
            </h2>
            <InviteStatusBadge invite={invite} />
          </div>
          {invite.FullName && (
            <p className="text-xs text-stone-500">{invite.FullName}</p>
          )}
          <p className="text-2xs text-stone-400 mt-0.5">
            Invited {fmtDate(invite.CreatedAt)}
          </p>
        </div>
      </div>

      <div className="mb-6 space-y-1.5 text-xs">
        <div className="flex justify-between">
          <span className="text-stone-400">Expires</span>
          <span
            className={cn(
              "font-medium",
              isExpired ? "text-red-500" : "text-stone-700",
            )}
          >
            {fmtDate(invite.ExpiresAt)}
            {isExpired ? " (expired)" : ""}
          </span>
        </div>
        {invite.AcceptedAt && (
          <div className="flex justify-between">
            <span className="text-stone-400">Accepted</span>
            <span className="font-medium text-stone-700">
              {fmtDate(invite.AcceptedAt)}
            </span>
          </div>
        )}
      </div>

      {actionError && (
        <div className="mb-4">
          <ErrorNote>{actionError}</ErrorNote>
        </div>
      )}
      {actionSuccess && (
        <div className="mb-4 rounded-lg bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-700 border border-emerald-200">
          {actionSuccess}
        </div>
      )}

      {(canResend || canRevoke) && (
        <div className="space-y-2">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-stone-400">
            Actions
          </h3>

          {canResend && (
            <button
              type="button"
              onClick={() => {
                setActionError(null);
                setActionSuccess(null);
                resendMut.mutate();
              }}
              disabled={busy}
              className={cn(
                "flex w-full items-center gap-2 rounded-lg border border-stone-200 px-3 py-2 sm:py-2.5 text-xs sm:text-sm font-medium text-stone-700 transition hover:bg-stone-50",
                busy && "opacity-50 cursor-not-allowed",
              )}
            >
              <Send className="size-4 text-stone-400" />
              Resend invitation
              {resendMut.isPending && (
                <Loader2 className="size-4 animate-spin ml-auto" />
              )}
            </button>
          )}

          {canRevoke && !confirmRevoke && (
            <button
              type="button"
              onClick={() => setConfirmRevoke(true)}
              disabled={busy}
              className={cn(
                "flex w-full items-center gap-2 rounded-lg border border-red-200 px-3 py-2 sm:py-2.5 text-xs sm:text-sm font-medium text-red-600 transition hover:bg-red-50",
                busy && "opacity-50 cursor-not-allowed",
              )}
            >
              <X className="size-4" />
              Revoke invitation
            </button>
          )}
          {canRevoke && confirmRevoke && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 space-y-2">
              <p className="text-xs text-red-700 font-medium">
                Revoke invite for {invite.Email}?
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setActionError(null);
                    setActionSuccess(null);
                    revokeMut.mutate();
                  }}
                  disabled={busy}
                  className="flex items-center gap-1.5 rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-red-700 disabled:opacity-50"
                >
                  {revokeMut.isPending && (
                    <Loader2 className="size-3 animate-spin" />
                  )}
                  Yes, revoke
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmRevoke(false)}
                  className="rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-medium text-red-600 transition hover:bg-red-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
