import { CheckCircle2, XCircle, AlertTriangle, Clock } from "lucide-react";
import type { UserInvite } from "@/types/tenant";

export function InviteStatusBadge({ invite }: { invite: UserInvite }) {
  const expired =
    invite.Status === "pending" && new Date() > new Date(invite.ExpiresAt);

  if (invite.Status === "accepted")
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-label font-semibold text-emerald-700">
        <CheckCircle2 className="size-3" /> Accepted
      </span>
    );
  if (invite.Status === "revoked")
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-stone-200 bg-stone-100 px-2 py-0.5 text-label font-semibold text-stone-500">
        <XCircle className="size-3" /> Revoked
      </span>
    );
  if (expired)
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-label font-semibold text-red-600">
        <AlertTriangle className="size-3" /> Expired
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-brand/40 bg-brand/10 px-2 py-0.5 text-label font-semibold text-brand-dark">
      <Clock className="size-3" /> Pending
    </span>
  );
}
