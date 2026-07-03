import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Plus, ShieldCheck, X } from "lucide-react";
import { userService, rbacService } from "@/services/tenantServices";
import { apiErrorMessage } from "@/api/tenantClient";
import { ErrorNote } from "@/components/tenant/ui";
import { Button } from "@/components/ui/button";
import type { WorkspaceUser } from "@/types/tenant";

export function ManageUserRoles({ user }: { user: WorkspaceUser }) {
  const qc = useQueryClient();
  const [selectedRoleId, setSelectedRoleId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pendingRemove, setPendingRemove] = useState<{ id: string; name: string } | null>(null);

  const rolesQ = useQuery({ queryKey: ["roles"], queryFn: rbacService.listRoles });

  const assignedIds = new Set(user.roles.map((r) => r.id));
  const availableRoles = (rolesQ.data ?? []).filter((r) => !assignedIds.has(r.id));

  const assignMut = useMutation({
    mutationFn: (roleId: string) => userService.assignRole(user.id, roleId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["users"] });
      setSelectedRoleId("");
      setError(null);
    },
    onError: (err) => setError(apiErrorMessage(err, "Failed to assign role.")),
  });

  const removeMut = useMutation({
    mutationFn: (roleId: string) => userService.removeRole(user.id, roleId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["users"] });
      setError(null);
      setPendingRemove(null);
    },
    onError: (err) => {
      setError(apiErrorMessage(err, "Failed to remove role."));
      setPendingRemove(null);
    },
  });

  return (
    <div className="mb-4 sm:mb-6">
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-stone-400">
        Roles
      </h3>

      {user.roles.length === 0 ? (
        <p className="mb-2 text-xs text-stone-400 italic">No roles assigned.</p>
      ) : (
        <div className="mb-2 flex flex-wrap gap-1.5">
          {user.roles.map((r) => (
            <span
              key={r.id}
              className="inline-flex items-center gap-1 rounded-lg border border-stone-200 bg-stone-50 py-1 pl-2.5 pr-1 text-xs font-semibold text-stone-700"
            >
              <ShieldCheck className="size-3 text-stone-400" />
              {r.name}
              <button
                type="button"
                aria-label={`Remove ${r.name} role`}
                onClick={() => setPendingRemove({ id: r.id, name: r.name })}
                disabled={removeMut.isPending}
                className="ml-0.5 rounded p-0.5 text-stone-400 transition hover:bg-stone-200 hover:text-stone-600 disabled:opacity-50"
              >
                {removeMut.isPending && pendingRemove?.id === r.id ? (
                  <Loader2 className="size-3 animate-spin" />
                ) : (
                  <X className="size-3" />
                )}
              </button>
            </span>
          ))}
        </div>
      )}

      {pendingRemove && (
        <div className="mb-3 rounded-lg border border-red-200 bg-red-50 p-3 space-y-2">
          <p className="text-xs text-red-700 font-medium">
            Remove the <span className="font-semibold">{pendingRemove.name}</span> role from{" "}
            {user.fullName || user.email}? They will lose the associated permissions
            immediately.
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => removeMut.mutate(pendingRemove.id)}
              disabled={removeMut.isPending}
              className="flex items-center gap-1.5 rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-red-700 disabled:opacity-50"
            >
              {removeMut.isPending && <Loader2 className="size-3 animate-spin" />}
              Yes, remove
            </button>
            <button
              type="button"
              onClick={() => setPendingRemove(null)}
              disabled={removeMut.isPending}
              className="rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-medium text-red-600 transition hover:bg-red-50 disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {error && (
        <div className="mb-2">
          <ErrorNote>{error}</ErrorNote>
        </div>
      )}

      {availableRoles.length > 0 && (
        <div className="flex items-center gap-2">
          <select
            aria-label="Select a role to add"
            value={selectedRoleId}
            onChange={(e) => setSelectedRoleId(e.target.value)}
            className="h-9 flex-1 min-w-0 rounded-lg border border-stone-200 bg-white px-2.5 text-xs text-stone-700 focus:outline-none focus:ring-2 focus:ring-brand/50"
          >
            <option value="">Add a role…</option>
            {availableRoles.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
          <Button
            type="button"
            onClick={() => selectedRoleId && assignMut.mutate(selectedRoleId)}
            disabled={!selectedRoleId || assignMut.isPending}
            className="h-9 shrink-0 gap-1.5 px-3"
          >
            {assignMut.isPending ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Plus className="size-3.5" />
            )}
            Add
          </Button>
        </div>
      )}
    </div>
  );
}
