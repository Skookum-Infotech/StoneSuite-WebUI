import { ShieldCheck } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import type { WorkspaceUser } from "@/types/tenant";
import { initials, avatarColor } from "../userHelpers";
import { StatusBadge } from "./StatusBadge";

interface MemberRowProps {
  user: WorkspaceUser;
  active: boolean;
  // null = the row can't be picked (no permission, you, or a deactivated account).
  checked: boolean | null;
  onOpen: (id: string) => void;
  onToggle: (id: string) => void;
}

// One member in the Users list: a checkbox for bulk actions beside the button
// that opens their profile.
export function MemberRow({ user, active, checked, onOpen, onToggle }: MemberRowProps) {
  const name = user.fullName || user.email;
  return (
    <div
      className={cn(
        "flex items-center gap-1 rounded-lg border transition-colors",
        active ? "bg-brand/10 border-brand/25" : "border-transparent hover:bg-stone-50",
      )}
    >
      {checked !== null && (
        <Checkbox
          checked={checked}
          onCheckedChange={() => onToggle(user.id)}
          aria-label={`Select ${name}`}
          className="ml-2"
        />
      )}
      <button
        type="button"
        onClick={() => onOpen(user.id)}
        aria-label={`Open ${name}`}
        className={cn("min-w-0 flex-1 py-2 pr-2.5 text-left", checked === null ? "pl-2.5" : "pl-1.5")}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <div
            className={cn(
              "flex size-7 shrink-0 items-center justify-center rounded-lg text-2xs font-bold",
              avatarColor(user.id),
            )}
          >
            {initials(name)}
          </div>
          <div className="min-w-0 flex-1">
            <p
              className={cn(
                "text-xs font-semibold truncate",
                active ? "text-brand-dark" : "text-stone-700",
                user.status === "disabled" && "opacity-50",
              )}
            >
              {name}
            </p>
            <p className="text-2xs text-stone-500 truncate">
              {user.roles.length === 0 ? "No roles" : user.roles.map((r) => r.name).join(", ")}
            </p>
          </div>
          {user.mfaEnabled && (
            <ShieldCheck
              className="size-3.5 shrink-0 text-emerald-600"
              role="img"
              aria-label="Two-step verification is on"
            />
          )}
          {user.status !== "active" && <StatusBadge status={user.status} />}
        </div>
      </button>
    </div>
  );
}
