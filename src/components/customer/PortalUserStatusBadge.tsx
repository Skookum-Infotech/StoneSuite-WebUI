import { CheckCircle2, PauseCircle, XCircle } from "lucide-react";
import type { PortalUserStatus } from "@/types/portalUser";

// Visually mirrors config/users/components/StatusBadge, but with labels that
// match the portal-user domain: "Revoked" carries different (permanent)
// weight than a workspace-user "Disabled", so the two badges are kept
// separate rather than shared despite the similar styling.
export function PortalUserStatusBadge({ status }: { status: PortalUserStatus }) {
  if (status === "active")
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-label font-semibold text-emerald-700">
        <CheckCircle2 className="size-3" /> Active
      </span>
    );
  if (status === "suspended")
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-label font-semibold text-amber-700">
        <PauseCircle className="size-3" /> Suspended
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-stone-200 bg-stone-100 px-2 py-0.5 text-label font-semibold text-stone-500">
      <XCircle className="size-3" /> Revoked
    </span>
  );
}
