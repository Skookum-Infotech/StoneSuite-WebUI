import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  UsersRound,
  Plus,
  Mail,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ChevronRight,
  Pencil,
  Ban,
  RotateCcw,
  Trash2,
  Send,
  X,
  ShieldCheck,
  Loader2,
} from "lucide-react";
import { userService, rbacService } from "@/services/tenantServices";
import { apiErrorMessage } from "@/api/tenantClient";
import { ErrorNote, EmptyState, Spinner } from "@/components/tenant/ui";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { WorkspaceUser, UserInvite } from "@/types/tenant";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function initials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((n) => n[0].toUpperCase())
    .join("");
}

function avatarColor(id: string): string {
  const palette = [
    "bg-violet-100 text-violet-700",
    "bg-sky-100 text-sky-700",
    "bg-emerald-100 text-emerald-700",
    "bg-amber-100 text-amber-700",
    "bg-rose-100 text-rose-700",
    "bg-indigo-100 text-indigo-700",
    "bg-teal-100 text-teal-700",
    "bg-orange-100 text-orange-700",
  ];
  const hash = [...id].reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
  return palette[hash % palette.length];
}

function StatusBadge({ status }: { status: string }) {
  if (status === "active")
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-label font-semibold text-emerald-700">
        <span className="size-1.5 rounded-full bg-emerald-500" />
        Active
      </span>
    );
  if (status === "suspended")
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-label font-semibold text-amber-700">
        <span className="size-1.5 rounded-full bg-amber-500" />
        Suspended
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-stone-200 bg-stone-100 px-2 py-0.5 text-label font-semibold text-stone-500">
      <span className="size-1.5 rounded-full bg-stone-400" />
      Disabled
    </span>
  );
}

function InviteStatusBadge({ invite }: { invite: UserInvite }) {
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

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

// ---------------------------------------------------------------------------
// Invite User Modal
// ---------------------------------------------------------------------------

const inviteSchema = z.object({
  email: z.string().email("Enter a valid email address"),
  fullName: z
    .string()
    .optional()
    .refine(
      (v) => !v || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v),
      { message: "This looks like an email address — please enter a display name instead" },
    ),
  initialRoleId: z.string().optional(),
});
type InviteFields = z.infer<typeof inviteSchema>;

function InviteModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const rolesQ = useQuery({
    queryKey: ["roles"],
    queryFn: rbacService.listRoles,
  });

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<InviteFields>({ resolver: zodResolver(inviteSchema) });

  const onSubmit = async (data: InviteFields) => {
    try {
      await userService.inviteUser({
        email: data.email,
        fullName: data.fullName || undefined,
        initialRoleId: data.initialRoleId || undefined,
      });
      qc.invalidateQueries({ queryKey: ["invites"] });
      onClose();
    } catch (err) {
      setError("root", {
        message: apiErrorMessage(err, "Failed to send invitation."),
      });
    }
  };

  // Close on Escape
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
      aria-label="Invite team member"
    >
      <div className="w-full max-w-md rounded-2xl border border-stone-200 bg-white p-6 shadow-xl">
        <div className="mb-5 flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-stone-900">
              Invite team member
            </h2>
            <p className="mt-0.5 text-xs text-stone-500">
              They'll receive an email to set up their account.
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

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="invite-email">
              Email address <span className="text-red-500">*</span>
            </Label>
            <Input
              id="invite-email"
              type="email"
              placeholder="colleague@company.com"
              aria-invalid={Boolean(errors.email)}
              {...register("email")}
              className="h-10"
            />
            {errors.email && (
              <p className="text-xs text-red-500">{errors.email.message}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="invite-name">
              Full name{" "}
              <span className="text-stone-400 font-normal">(optional)</span>
            </Label>
            <Input
              id="invite-name"
              type="text"
              placeholder="Jane Smith"
              {...register("fullName")}
              className="h-10"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="invite-role">
              Initial role{" "}
              <span className="text-stone-400 font-normal">(optional)</span>
            </Label>
            <select
              id="invite-role"
              {...register("initialRoleId")}
              className="h-10 w-full rounded-lg border border-stone-200 bg-white px-3 text-sm text-stone-700 focus:outline-none focus:ring-2 focus:ring-brand/50"
            >
              <option value="">No role assigned</option>
              {(rolesQ.data ?? []).map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </div>

          {errors.root && <ErrorNote>{errors.root.message}</ErrorNote>}

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-stone-200 px-4 py-2 text-sm font-medium text-stone-600 transition hover:bg-stone-50"
            >
              Cancel
            </button>
            <Button type="submit" disabled={isSubmitting} className="h-9 gap-2">
              {isSubmitting ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Send className="size-3.5" />
              )}
              {isSubmitting ? "Sending…" : "Send invite"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Edit Name Modal
// ---------------------------------------------------------------------------

const editNameSchema = z.object({
  fullName: z.string().min(1, "Name is required").max(120),
});
type EditNameFields = z.infer<typeof editNameSchema>;

function EditNameModal({
  user,
  onClose,
}: {
  user: WorkspaceUser;
  onClose: () => void;
}) {
  const qc = useQueryClient();

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<EditNameFields>({
    resolver: zodResolver(editNameSchema),
    defaultValues: { fullName: user.fullName },
  });

  const onSubmit = async (data: EditNameFields) => {
    try {
      await userService.updateUser(user.id, { fullName: data.fullName });
      qc.invalidateQueries({ queryKey: ["users"] });
      onClose();
    } catch (err) {
      setError("root", {
        message: apiErrorMessage(err, "Failed to update name."),
      });
    }
  };

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
      aria-label="Edit user name"
    >
      <div className="w-full max-w-sm rounded-2xl border border-stone-200 bg-white p-6 shadow-xl">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-base font-bold text-stone-900">
            Edit display name
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-lg p-1.5 text-stone-400 transition hover:bg-stone-100"
          >
            <X className="size-4" />
          </button>
        </div>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="edit-name">Full name</Label>
            <Input
              id="edit-name"
              {...register("fullName")}
              className="h-10"
              aria-invalid={Boolean(errors.fullName)}
            />
            {errors.fullName && (
              <p className="text-xs text-red-500">{errors.fullName.message}</p>
            )}
          </div>
          {errors.root && <ErrorNote>{errors.root.message}</ErrorNote>}
          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-stone-200 px-4 py-2 text-sm font-medium text-stone-600 transition hover:bg-stone-50"
            >
              Cancel
            </button>
            <Button type="submit" disabled={isSubmitting} className="h-9 gap-2">
              {isSubmitting && <Loader2 className="size-3.5 animate-spin" />}
              Save
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// User detail panel
// ---------------------------------------------------------------------------

function UserDetail({ user }: { user: WorkspaceUser }) {
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
    <div className="flex flex-col h-full p-6">
      {/* Header */}
      <div className="flex items-start gap-4 mb-6">
        <div
          className={cn(
            "flex size-14 shrink-0 items-center justify-center rounded-2xl text-base font-bold",
            aviColor,
          )}
        >
          {avi}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <h2 className="text-base font-bold text-stone-900 truncate">
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

      {/* Roles */}
      <div className="mb-6">
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-stone-400">
          Roles
        </h3>
        {user.roles.length === 0 ? (
          <p className="text-xs text-stone-400 italic">No roles assigned.</p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {user.roles.map((r) => (
              <span
                key={r.id}
                className="inline-flex items-center gap-1 rounded-lg border border-stone-200 bg-stone-50 px-2.5 py-1 text-xs font-semibold text-stone-700"
              >
                <ShieldCheck className="size-3 text-stone-400" />
                {r.name}
              </span>
            ))}
          </div>
        )}
      </div>

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
            className="flex w-full items-center gap-2 rounded-lg border border-stone-200 px-3 py-2.5 text-sm font-medium text-stone-700 transition hover:bg-stone-50"
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
              "flex w-full items-center gap-2 rounded-lg border px-3 py-2.5 text-sm font-medium transition",
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
                "flex w-full items-center gap-2 rounded-lg border border-red-200 px-3 py-2.5 text-sm font-medium text-red-600 transition hover:bg-red-50",
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

// ---------------------------------------------------------------------------
// Invite detail panel
// ---------------------------------------------------------------------------

function InviteDetail({ invite }: { invite: UserInvite }) {
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
                "flex w-full items-center gap-2 rounded-lg border border-stone-200 px-3 py-2.5 text-sm font-medium text-stone-700 transition hover:bg-stone-50",
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
                "flex w-full items-center gap-2 rounded-lg border border-red-200 px-3 py-2.5 text-sm font-medium text-red-600 transition hover:bg-red-50",
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

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

type Tab = "members" | "invites";

export default function UsersPage() {
  const [tab, setTab] = useState<Tab>("members");
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [selectedInviteId, setSelectedInviteId] = useState<string | null>(null);
  const [showInviteModal, setShowInviteModal] = useState(false);

  const usersQ = useQuery({
    queryKey: ["users"],
    queryFn: userService.listUsers,
  });
  const invitesQ = useQuery({
    queryKey: ["invites"],
    queryFn: userService.listInvites,
  });

  const users = useMemo(
    () => (usersQ.data ?? []).map((u) => ({ ...u, roles: u.roles ?? [] })),
    [usersQ.data],
  );
  const invites = useMemo(
    () => (invitesQ.data ?? []).map((i) => ({ ...i })),
    [invitesQ.data],
  );

  // Fall back to first item when no explicit selection has been made.
  const activeUser =
    users.find((u) => u.id === selectedUserId) ?? users[0] ?? null;
  const activeInvite =
    invites.find((i) => i.ID === selectedInviteId) ?? invites[0] ?? null;

  const pendingCount = invites.filter(
    (i) => i.Status === "pending" && new Date() <= new Date(i.ExpiresAt),
  ).length;

  return (
    <div className="flex flex-1 flex-col min-h-0 bg-background">
      {/* Page header */}
      <div className="flex items-center justify-between gap-3 border-b border-stone-100 px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand/20 text-brand-dark">
            <UsersRound className="size-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-stone-900">
              Users
            </h1>
            <p className="text-sm text-stone-500">
              Manage workspace members and invitations.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setShowInviteModal(true)}
          className="flex items-center gap-1.5 rounded-lg bg-brand px-3 py-2 text-xs font-semibold text-stone-950 shadow-sm transition hover:bg-brand/80"
          aria-label="Invite team member"
        >
          <Plus className="size-3.5" />
          Invite member
        </button>
      </div>

      {/* Split pane */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Left panel */}
        <aside className="flex flex-col w-64 shrink-0 border-r border-stone-100">
          {/* Tab switcher */}
          <div className="flex border-b border-stone-100">
            <button
              type="button"
              onClick={() => setTab("members")}
              className={cn(
                "flex-1 py-2.5 text-xs font-semibold transition-colors",
                tab === "members"
                  ? "border-b-2 border-brand-dark text-brand-dark"
                  : "text-stone-500 hover:text-stone-700",
              )}
            >
              Members
              <span className="ml-1.5 rounded-full bg-stone-100 px-1.5 py-0.5 text-2xs text-stone-500">
                {users.length}
              </span>
            </button>
            <button
              type="button"
              onClick={() => setTab("invites")}
              className={cn(
                "flex-1 py-2.5 text-xs font-semibold transition-colors",
                tab === "invites"
                  ? "border-b-2 border-brand-dark text-brand-dark"
                  : "text-stone-500 hover:text-stone-700",
              )}
            >
              Invites
              {pendingCount > 0 && (
                <span className="ml-1.5 rounded-full bg-brand/20 px-1.5 py-0.5 text-2xs text-brand-dark font-bold">
                  {pendingCount}
                </span>
              )}
            </button>
          </div>

          {/* List */}
          <div className="flex-1 overflow-y-auto modal-scrollbar p-2 space-y-0.5">
            {/* Members tab */}
            {tab === "members" && (
              <>
                {usersQ.isLoading && <Spinner label="Loading members…" />}
                {usersQ.isError && (
                  <p className="px-2 py-2 text-xs text-red-500">
                    {apiErrorMessage(usersQ.error)}
                  </p>
                )}
                {!usersQ.isLoading && users.length === 0 && (
                  <p className="px-2 py-4 text-xs text-stone-400 text-center">
                    No members yet.
                  </p>
                )}
                {users.map((u) => {
                  const active = u.id === selectedUserId;
                  const avi = initials(u.fullName || u.email);
                  const aviColor = avatarColor(u.id);
                  return (
                    <button
                      key={u.id}
                      type="button"
                      onClick={() => setSelectedUserId(u.id)}
                      className={cn(
                        "w-full rounded-lg px-2.5 py-2 text-left transition-colors border",
                        active
                          ? "bg-brand/10 border-brand/25"
                          : "border-transparent hover:bg-stone-50",
                      )}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div
                          className={cn(
                            "flex size-7 shrink-0 items-center justify-center rounded-lg text-2xs font-bold",
                            aviColor,
                          )}
                        >
                          {avi}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p
                            className={cn(
                              "text-xs font-semibold truncate",
                              active ? "text-brand-dark" : "text-stone-700",
                              u.status === "disabled" && "opacity-50",
                            )}
                          >
                            {u.fullName || u.email}
                          </p>
                          <p className="text-2xs text-stone-400 truncate">
                            {u.roles.length === 0
                              ? "No roles"
                              : u.roles.map((r) => r.name).join(", ")}
                          </p>
                        </div>
                        {u.status !== "active" && (
                          <StatusBadge status={u.status} />
                        )}
                      </div>
                    </button>
                  );
                })}
              </>
            )}

            {/* Invites tab */}
            {tab === "invites" && (
              <>
                {invitesQ.isLoading && <Spinner label="Loading invites…" />}
                {invitesQ.isError && (
                  <p className="px-2 py-2 text-xs text-red-500">
                    {apiErrorMessage(invitesQ.error)}
                  </p>
                )}
                {!invitesQ.isLoading && invites.length === 0 && (
                  <EmptyState>No invitations found.</EmptyState>
                )}
                {invites.map((inv) => {
                  const active = inv.ID === selectedInviteId;
                  return (
                    <button
                      key={inv.ID}
                      type="button"
                      onClick={() => setSelectedInviteId(inv.ID)}
                      className={cn(
                        "w-full rounded-lg px-2.5 py-2 text-left transition-colors border",
                        active
                          ? "bg-brand/10 border-brand/25"
                          : "border-transparent hover:bg-stone-50",
                      )}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <Mail className="size-4 shrink-0 text-stone-400" />
                        <div className="min-w-0 flex-1">
                          <p
                            className={cn(
                              "text-xs font-semibold truncate",
                              active ? "text-brand-dark" : "text-stone-700",
                            )}
                          >
                            {inv.Email}
                          </p>
                          <div className="mt-0.5">
                            <InviteStatusBadge invite={inv} />
                          </div>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </>
            )}
          </div>
        </aside>

        {/* Right panel */}
        <main className="flex-1 overflow-y-auto modal-scrollbar">
          {tab === "members" && (
            <>
              {!activeUser && !usersQ.isLoading && (
                <div className="flex h-full items-center justify-center">
                  <div className="text-center">
                    <UsersRound className="mx-auto mb-2 size-8 text-stone-300" />
                    <p className="text-sm text-stone-400">
                      Select a member to view their profile.
                    </p>
                  </div>
                </div>
              )}
              {activeUser && (
                <UserDetail key={activeUser.id} user={activeUser} />
              )}
            </>
          )}

          {tab === "invites" && (
            <>
              {!activeInvite && !invitesQ.isLoading && (
                <div className="flex h-full items-center justify-center">
                  <div className="text-center">
                    <Mail className="mx-auto mb-2 size-8 text-stone-300" />
                    <p className="text-sm text-stone-400">
                      Select an invitation to view details.
                    </p>
                  </div>
                </div>
              )}
              {activeInvite && (
                <InviteDetail key={activeInvite.ID} invite={activeInvite} />
              )}
            </>
          )}
        </main>
      </div>

      {showInviteModal && (
        <InviteModal onClose={() => setShowInviteModal(false)} />
      )}
    </div>
  );
}
