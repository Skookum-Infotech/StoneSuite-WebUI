import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Pencil, Ban, RotateCcw, Trash2, ChevronRight, Loader2 } from "lucide-react";
import { userService } from "@/services/tenantServices";
import { apiErrorMessage } from "@/api/tenantClient";
import { ErrorNote } from "@/components/tenant/ui";
import { cn } from "@/lib/utils";
import type { WorkspaceUser } from "@/types/tenant";
import { initials, avatarColor, fmtDate } from "../userHelpers";
import { StatusBadge } from "./StatusBadge";
import { ManageUserRoles } from "./ManageUserRoles";
import { EditNameModal } from "./EditNameModal";

export function UserDetail({ user }: { user: WorkspaceUser }) {
  const qc = useQueryClient();
  const [showEditName, setShowEditName] = useState(false);
  const [confirmDeactivate, setConfirmDeactivate] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

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
            <h2 className="text-sm sm:text-base font-bold text-stone-900 truncate">
              {user.fullName || "(no name)"}
            </h2>
            <StatusBadge status={user.status} />
          </div>
          <p className="text-xs text-stone-500 truncate">{user.email}</p>
          <p className="text-2xs text-stone-400 mt-0.5">
            Member since {fmtDate(user.createdAt)}
          </p>
        </div>
      </div>

      <ManageUserRoles user={user} />

      {/* Error */}
      {actionError && (
        <div className="mb-4">
          <ErrorNote>{actionError}</ErrorNote>
        </div>
      )}

      {/* Actions */}
      {user.status !== "disabled" && (
        <div className="space-y-2">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-stone-400">
            Actions
          </h3>

          <button
            type="button"
            onClick={() => setShowEditName(true)}
            className="flex w-full items-center gap-2 rounded-lg border border-stone-200 px-3 py-2 sm:py-2.5 text-xs sm:text-sm font-medium text-stone-700 transition hover:bg-stone-50"
          >
            <Pencil className="size-4 text-stone-400" />
            Edit display name
            <ChevronRight className="size-4 text-stone-300 ml-auto" />
          </button>

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
                "flex w-full items-center gap-2 rounded-lg border border-red-200 px-3 py-2 sm:py-2.5 text-xs sm:text-sm font-medium text-red-600 transition hover:bg-red-50",
                busy && "opacity-50 cursor-not-allowed",
              )}
            >
              <Trash2 className="size-4" />
              Deactivate account
            </button>
          ) : (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 space-y-2">
              <p className="text-xs text-red-700 font-medium">
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
                  className="flex items-center gap-1.5 rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-red-700 disabled:opacity-50"
                >
                  {deactivateMut.isPending && (
                    <Loader2 className="size-3 animate-spin" />
                  )}
                  Yes, deactivate
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmDeactivate(false)}
                  className="rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-medium text-red-600 transition hover:bg-red-50"
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
          <p className="text-xs text-stone-400">
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
