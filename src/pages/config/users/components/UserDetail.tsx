import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Pencil, Ban, RotateCcw, Trash2, ChevronRight, Loader2, ShieldCheck } from "lucide-react";
import { userService } from "@/services/tenantServices";
import { apiErrorMessage } from "@/api/tenantClient";
import { ErrorNote } from "@/components/tenant/ui";
import { cn } from "@/lib/utils";
import { useUserPermissions } from "@/hooks/useUserPermissions";
import type { WorkspaceUser } from "@/types/tenant";
import { isSuperAdminUser } from "@/lib/userBulk";
import { initials, avatarColor, fmtDate } from "../userHelpers";
import { StatusBadge } from "./StatusBadge";
import { ManageUserRoles } from "./ManageUserRoles";
import { EditNameModal } from "./EditNameModal";
import { TwoStepAdminToggle } from "./TwoStepAdminToggle";

import { buttonVariants } from '@/components/ui/button';
export function UserDetail({ user }: { user: WorkspaceUser }) {
  const qc = useQueryClient();
  const [showEditName, setShowEditName] = useState(false);
  const [confirmDeactivate, setConfirmDeactivate] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const { hasPermission, isSuperAdmin, isLoading: permissionsLoading } = useUserPermissions();
  // Anyone who can read users sees super admins, but only a super admin may change one.
  const locked = !isSuperAdmin && isSuperAdminUser(user);
  const canEdit = !locked && (permissionsLoading || hasPermission("user", "update"));

  const suspendMut = useMutation({
    mutationFn: () =>
      userService.updateUser(user.id, {
        status: user.status === "active" ? "suspended" : "active",
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["users"] });
      setActionError(null);
    },
    onError: (err) => setActionError(apiErrorMessage(err)),
  });

  const deactivateMut = useMutation({
    mutationFn: () => userService.deactivateUser(user.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["users"] });
      setActionError(null);
    },
    onError: (err) => setActionError(apiErrorMessage(err)),
  });

  const busy = suspendMut.isPending || deactivateMut.isPending;
  const avi = initials(user.fullName || user.email);
  const aviColor = avatarColor(user.id);

  return (
    <div className="flex flex-col h-full p-3 sm:p-6">
      {/* Header */}
      <div className="flex items-start gap-3 sm:gap-4 mb-4 sm:mb-6">
        <div
          className={cn(
            "flex size-10 sm:size-14 shrink-0 items-center justify-center rounded-2xl text-sm sm:text-base font-bold",
            aviColor,
          )}
        >
          {avi}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <h2 className="sm:text-base truncate type-card-title">
              {user.fullName || "(no name)"}
            </h2>
            <StatusBadge status={user.status} />
            {user.mfaEnabled && (
              <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-success-ink type-pill">
                <ShieldCheck className="size-3" aria-hidden="true" />
                Two-step on
              </span>
            )}
          </div>
          <p className="truncate type-helper">{user.email}</p>
          <p className="mt-0.5 type-helper">
            Member since {fmtDate(user.createdAt)}
          </p>
        </div>
      </div>

      <ManageUserRoles user={user} />

      {isSuperAdmin && user.status !== "disabled" && <TwoStepAdminToggle user={user} />}

      {/* Error */}
      {actionError && (
        <div className="mb-4">
          <ErrorNote>{actionError}</ErrorNote>
        </div>
      )}

      {/* Actions */}
      {locked && user.status !== "disabled" && (
        <p
          role="note"
          className="rounded-lg border border-stone-200 bg-stone-50 px-3 py-2.5 text-xs text-ink"
        >
          Only a super admin can change another super admin.
        </p>
      )}

      {user.status !== "disabled" && !locked && (
        <div className="space-y-2">
          <h3 className="mb-2 type-overline">
            Actions
          </h3>

          {canEdit && (
            <button
              type="button"
              onClick={() => setShowEditName(true)}
              className={cn(buttonVariants({ variant: 'outline' }), 'flex w-full gap-2')}
            >
              <Pencil className="size-4 text-ink-faint" />
              Edit display name
              <ChevronRight className="size-4 text-ink-faint ml-auto" />
            </button>
          )}

          <button
            type="button"
            onClick={() => {
              setActionError(null);
              suspendMut.mutate();
            }}
            disabled={busy}
            className={cn(
              "flex w-full items-center gap-2 rounded-lg border px-3 py-2 sm:py-2.5 text-xs sm:text-sm font-medium transition",
              user.status === "active"
                ? "border-amber-200 text-amber-700 hover:bg-amber-50"
                : "border-emerald-200 text-emerald-700 hover:bg-emerald-50",
              busy && "opacity-50 cursor-not-allowed",
            )}
          >
            {user.status === "active" ? (
              <>
                <Ban className="size-4" />
                Suspend access
              </>
            ) : (
              <>
                <RotateCcw className="size-4" />
                Restore access
              </>
            )}
            {suspendMut.isPending && (
              <Loader2 className="size-4 animate-spin ml-auto" />
            )}
          </button>

          {!confirmDeactivate ? (
            <button
              type="button"
              onClick={() => setConfirmDeactivate(true)}
              disabled={busy}
              className={cn(
                "flex w-full items-center gap-2 rounded-lg border border-red-200 px-3 py-2 sm:py-2.5 text-xs sm:text-sm font-medium text-danger-ink transition hover:bg-red-50",
                busy && "opacity-50 cursor-not-allowed",
              )}
            >
              <Trash2 className="size-4" />
              Deactivate account
            </button>
          ) : (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 space-y-2">
              <p className="type-error">
                Deactivate {user.fullName || user.email}? They will lose access
                immediately.
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setActionError(null);
                    deactivateMut.mutate();
                  }}
                  disabled={busy}
                  className={cn(buttonVariants({ variant: 'destructive' }), 'flex')}
                >
                  {deactivateMut.isPending && (
                    <Loader2 className="size-3 animate-spin" />
                  )}
                  Yes, deactivate
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmDeactivate(false)}
                  className={buttonVariants({ variant: 'outline' })}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {user.status === "disabled" && (
        <div className="rounded-xl border border-dashed border-stone-200 p-4 text-center">
          <p className="type-helper">
            This account has been deactivated.
          </p>
        </div>
      )}

      {showEditName && (
        <EditNameModal user={user} onClose={() => setShowEditName(false)} />
      )}
    </div>
  );
}
