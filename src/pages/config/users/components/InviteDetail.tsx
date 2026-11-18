import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Mail, Send, X, Loader2, Copy, Check, MailWarning } from "lucide-react";
import { userService } from "@/services/tenantServices";
import { apiErrorMessage } from "@/api/tenantClient";
import { ErrorNote } from "@/components/tenant/ui";
import { EmailStatusBadge } from "@/components/tenant/EmailStatusBadge";
import { cn } from "@/lib/utils";
import type { UserInvite } from "@/types/tenant";
import { fmtDate } from "../userHelpers";
import { InviteStatusBadge } from "./InviteStatusBadge";

import { buttonVariants } from '@/components/ui/button';
export function InviteDetail({ invite }: { invite: UserInvite }) {
  const qc = useQueryClient();
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  // Set only when a resend created a fresh link but the email failed to send.
  const [undeliveredLink, setUndeliveredLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [confirmResend, setConfirmResend] = useState(false);
  const [confirmRevoke, setConfirmRevoke] = useState(false);

  const resendMut = useMutation({
    mutationFn: () => userService.resendInvite(invite.ID),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["invites"] });
      setActionError(null);
      setConfirmResend(false);
      if (data.emailSent) {
        setUndeliveredLink(null);
        setActionSuccess("Invitation resent — email delivered.");
      } else {
        setActionSuccess(null);
        setUndeliveredLink(data.inviteLink);
      }
    },
    onError: (err) => {
      setActionError(apiErrorMessage(err));
      setActionSuccess(null);
      setUndeliveredLink(null);
    },
  });

  const copyLink = async () => {
    if (!undeliveredLink) return;
    await navigator.clipboard.writeText(undeliveredLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const revokeMut = useMutation({
    mutationFn: () => userService.revokeInvite(invite.ID),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["invites"] });
      setActionError(null);
      setUndeliveredLink(null);
      setActionSuccess("Invitation revoked.");
    },
    onError: (err) => {
      setActionError(apiErrorMessage(err));
      setActionSuccess(null);
    },
  });

  const clearFeedback = () => {
    setActionError(null);
    setActionSuccess(null);
    setUndeliveredLink(null);
  };

  const busy = resendMut.isPending || revokeMut.isPending;
  const isExpired =
    invite.Status === "pending" && new Date() > new Date(invite.ExpiresAt);
  const canResend = invite.Status === "pending"; // works even if expired
  const canRevoke = invite.Status === "pending";

  return (
    <div className="flex flex-col h-full p-6">
      <div className="flex items-start gap-4 mb-6">
        <div className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-stone-100 text-ink-muted">
          <Mail className="size-6" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <h2 className="truncate type-dialog-title">
              {invite.Email}
            </h2>
            <InviteStatusBadge invite={invite} />
          </div>
          {invite.FullName && (
            <p className="type-helper">{invite.FullName}</p>
          )}
          <p className="mt-0.5 type-helper">
            Invited {fmtDate(invite.CreatedAt)}
          </p>
        </div>
      </div>

      <div className="mb-6 space-y-1.5 text-xs">
        {invite.Status === "pending" && invite.emailStatus && invite.emailStatus !== "unknown" && (
          <div className="flex justify-between gap-3">
            <span className="text-ink-muted">Email</span>
            <EmailStatusBadge source={invite} showMessage />
          </div>
        )}
        <div className="flex justify-between">
          <span className="text-ink-muted">Expires</span>
          <span
            className={cn(
              "font-medium",
              isExpired ? "text-danger-ink" : "text-ink",
            )}
          >
            {fmtDate(invite.ExpiresAt)}
            {isExpired ? " (expired)" : ""}
          </span>
        </div>
        {invite.AcceptedAt && (
          <div className="flex justify-between">
            <span className="text-ink-muted">Accepted</span>
            <span className="font-medium text-ink">
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
        <div className="mb-4 rounded-lg bg-emerald-50 px-3 py-2 text-xs font-medium text-success-ink border border-emerald-200">
          {actionSuccess}
        </div>
      )}
      {undeliveredLink && (
        <div className="mb-4 space-y-2 rounded-lg border border-amber-200 bg-amber-50 p-3">
          <div className="flex items-start gap-2 text-xs text-amber-800">
            <MailWarning className="size-4 shrink-0" />
            <span>
              Invite re-issued with a fresh link and expiry, but the email
              could not be sent. Copy the link and send it to {invite.Email}{" "}
              directly.
            </span>
          </div>
          <div className="flex items-center gap-2 rounded-md border border-amber-200 bg-white p-1.5">
            <code className="flex-1 truncate px-1.5 text-micro text-ink" title={undeliveredLink}>
              {undeliveredLink}
            </code>
            <button
              type="button"
              onClick={copyLink}
              aria-label="Copy invite link"
              className={cn(buttonVariants({ size: 'sm' }), 'flex shrink-0')}
            >
              {copied ? <Check className="size-3" /> : <Copy className="size-3" />}
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
        </div>
      )}

      {(canResend || canRevoke) && (
        <div className="space-y-2">
          <h3 className="mb-2 type-overline">
            Actions
          </h3>

          {canResend && !confirmResend && (
            <button
              type="button"
              onClick={() => setConfirmResend(true)}
              disabled={busy}
              className={cn(
                "flex w-full items-center gap-2 rounded-lg border border-stone-200 px-3 py-2 sm:py-2.5 text-xs sm:text-sm font-medium text-ink transition hover:bg-stone-50",
                busy && "opacity-50 cursor-not-allowed",
              )}
            >
              <Send className="size-4 text-ink-faint" />
              Resend invitation
            </button>
          )}
          {canResend && confirmResend && (
            <div className="rounded-lg border border-stone-200 bg-stone-50 p-3 space-y-2">
              <p className="text-xs text-ink font-medium">
                Resend invitation to {invite.Email}?
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    clearFeedback();
                    resendMut.mutate();
                  }}
                  disabled={busy}
                  className="flex items-center gap-1.5 rounded-lg bg-stone-800 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-stone-900 disabled:opacity-50"
                >
                  {resendMut.isPending && (
                    <Loader2 className="size-3 animate-spin" />
                  )}
                  Yes, resend
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmResend(false)}
                  className={buttonVariants({ variant: 'outline' })}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {canRevoke && !confirmRevoke && (
            <button
              type="button"
              onClick={() => setConfirmRevoke(true)}
              disabled={busy}
              className={cn(
                "flex w-full items-center gap-2 rounded-lg border border-red-200 px-3 py-2 sm:py-2.5 text-xs sm:text-sm font-medium text-danger-ink transition hover:bg-red-50",
                busy && "opacity-50 cursor-not-allowed",
              )}
            >
              <X className="size-4" />
              Revoke invitation
            </button>
          )}
          {canRevoke && confirmRevoke && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 space-y-2">
              <p className="type-error">
                Revoke invite for {invite.Email}?
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    clearFeedback();
                    revokeMut.mutate();
                  }}
                  disabled={busy}
                  className={cn(buttonVariants({ variant: 'destructive' }), 'flex')}
                >
                  {revokeMut.isPending && (
                    <Loader2 className="size-3 animate-spin" />
                  )}
                  Yes, revoke
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmRevoke(false)}
                  className={buttonVariants({ variant: 'outline' })}
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
