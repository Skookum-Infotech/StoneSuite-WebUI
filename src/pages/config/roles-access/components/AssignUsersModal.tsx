import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Plus, X } from "lucide-react";
import { userService } from "@/services/tenantServices";
import { apiErrorMessage } from "@/api/tenantClient";
import { ErrorNote, Spinner } from "@/components/tenant/ui";
import { Button } from "@/components/ui/button";
import type { Role } from "@/types/tenant";

export function AssignUsersModal({
  role,
  onClose,
}: {
  role: Role;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const usersQ = useQuery({ queryKey: ["users"], queryFn: userService.listUsers });
  const [selectedUserId, setSelectedUserId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pendingRemove, setPendingRemove] = useState<{ id: string; label: string } | null>(null);

  const users = (usersQ.data ?? []).map((u) => ({ ...u, roles: u.roles ?? [] }));
  const assignedUsers = users.filter((u) => u.roles.some((r) => r.id === role.id));
  const availableUsers = users.filter((u) => !u.roles.some((r) => r.id === role.id));

  const assignMut = useMutation({
    mutationFn: (userId: string) => userService.assignRole(userId, role.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["users"] });
      setSelectedUserId("");
      setError(null);
    },
    onError: (err) => setError(apiErrorMessage(err, "Failed to assign role.")),
  });

  const removeMut = useMutation({
    mutationFn: (userId: string) => userService.removeRole(userId, role.id),
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

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label={`Manage users for ${role.name}`}
    >
      <div className="w-full max-w-md rounded-2xl border border-stone-200 bg-white p-6 shadow-xl">
        <div className="mb-5 flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-stone-900">
              Users with {role.name}
            </h2>
            <p className="mt-0.5 text-xs text-stone-500">
              Assign or remove this role for workspace members.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="rounded-lg p-1.5 text-stone-400 transition hover:bg-stone-100 hover:text-stone-600"
          >
            <X className="size-4" />
          </button>
        </div>

        {usersQ.isLoading && <Spinner label="Loading users…" />}

        {!usersQ.isLoading && (
          <>
            {assignedUsers.length === 0 ? (
              <p className="mb-3 text-xs text-stone-400 italic">
                No one has this role yet.
              </p>
            ) : (
              <div className="mb-3 max-h-56 space-y-1.5 overflow-y-auto modal-scrollbar">
                {assignedUsers.map((u) => (
                  <div
                    key={u.id}
                    className="flex items-center justify-between gap-2 rounded-lg border border-stone-200 bg-stone-50 px-3 py-2"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-xs font-semibold text-stone-700">
                        {u.fullName || u.email}
                      </p>
                      <p className="truncate text-2xs text-stone-400">
                        {u.email}
                      </p>
                    </div>
                    <button
                      type="button"
                      aria-label={`Remove ${role.name} from ${u.fullName || u.email}`}
                      onClick={() =>
                        setPendingRemove({ id: u.id, label: u.fullName || u.email })
                      }
                      disabled={removeMut.isPending}
                      className="shrink-0 rounded p-1 text-stone-400 transition hover:bg-stone-200 hover:text-stone-600 disabled:opacity-50"
                    >
                      {removeMut.isPending && pendingRemove?.id === u.id ? (
                        <Loader2 className="size-3.5 animate-spin" />
                      ) : (
                        <X className="size-3.5" />
                      )}
                    </button>
                  </div>
                ))}
              </div>
            )}

            {pendingRemove && (
              <div className="mb-3 rounded-lg border border-red-200 bg-red-50 p-3 space-y-2">
                <p className="text-xs text-red-700 font-medium">
                  Remove the <span className="font-semibold">{role.name}</span> role from{" "}
                  {pendingRemove.label}? They will lose the associated permissions
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
              <div className="mb-3">
                <ErrorNote>{error}</ErrorNote>
              </div>
            )}

            {availableUsers.length > 0 ? (
              <div className="flex items-center gap-2">
                <select
                  aria-label="Select a user to assign this role to"
                  value={selectedUserId}
                  onChange={(e) => setSelectedUserId(e.target.value)}
                  className="h-9 min-w-0 flex-1 rounded-lg border border-stone-200 bg-white px-2.5 text-xs text-stone-700 focus:outline-none focus:ring-2 focus:ring-brand/50"
                >
                  <option value="">Add a user…</option>
                  {availableUsers.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.fullName || u.email}
                    </option>
                  ))}
                </select>
                <Button
                  type="button"
                  onClick={() => selectedUserId && assignMut.mutate(selectedUserId)}
                  disabled={!selectedUserId || assignMut.isPending}
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
            ) : (
              <p className="text-xs text-stone-400 italic">
                Every member already has this role.
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
