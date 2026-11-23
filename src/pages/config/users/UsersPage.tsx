import { useState, useMemo } from "react";
import { TAB_LIST_CLASS, tabClass } from '@/components/ui/tabStyles';
import { useQuery } from "@tanstack/react-query";
import { UsersRound, Plus, Mail, ChevronLeft } from "lucide-react";
import { userService } from "@/services/tenantServices";
import { apiErrorMessage } from "@/api/tenantClient";
import { EmptyState, Spinner } from "@/components/tenant/ui";
import { cn } from "@/lib/utils";
import { Checkbox } from "@/components/ui/checkbox";
import { useAuthStore } from "@/store/useAuthStore";
import { useIdSelection } from "@/hooks/useIdSelection";
import { isSuperAdminUser } from "@/lib/userBulk";
import { MemberRow } from "./components/MemberRow";
import { BulkConfigPanel } from "./components/BulkConfigPanel";
import { SelectionStrip } from "./components/SelectionStrip";
import { InviteStatusBadge } from "./components/InviteStatusBadge";
import { EmailStatusBadge } from "@/components/tenant/EmailStatusBadge";
import { InviteModal } from "./components/InviteModal";
import { UserDetail } from "./components/UserDetail";
import { InviteDetail } from "./components/InviteDetail";
import { useUserPermissions } from "@/hooks/useUserPermissions";

type Tab = "members" | "invites";

export default function UsersPage() {
  const [tab, setTab] = useState<Tab>("members");
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [selectedInviteId, setSelectedInviteId] = useState<string | null>(null);
  const [showInviteModal, setShowInviteModal] = useState(false);
  // Ticking a member opens the Configure panel on the right; opening a single
  // member's profile swaps it back (the ticks stay).
  const [configOpen, setConfigOpen] = useState(false);
  const { hasPermission, isSuperAdmin, isLoading: permissionsLoading } = useUserPermissions();
  const canInvite = permissionsLoading || hasPermission("user", "create");
  // Ticking members is for whoever can change users; the two-step actions in
  // the Configure panel are for super admins only.
  const canSelect = !permissionsLoading && (isSuperAdmin || hasPermission("user", "update"));
  const selfIdentityId = useAuthStore((s) => s.user?.id);

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

  // You, deactivated accounts, and (unless you are one) super admins can't be
  // bulk-changed, so they get no checkbox.
  const selectableIds = useMemo(
    () =>
      users
        .filter(
          (u) =>
            u.status !== "disabled" &&
            u.identityId !== selfIdentityId &&
            (isSuperAdmin || !isSuperAdminUser(u)),
        )
        .map((u) => u.id),
    [users, selfIdentityId, isSuperAdmin],
  );
  const selection = useIdSelection(selectableIds);
  const selectedUsers = useMemo(
    () => users.filter((u) => selection.selected.has(u.id)),
    [users, selection.selected],
  );
  const allPicked = selectableIds.length > 0 && selection.selected.size === selectableIds.length;

  const configuring = tab === "members" && canSelect && selectedUsers.length > 0;
  const showConfig = configuring && configOpen;

  const toggleMember = (id: string) => {
    selection.toggle(id);
    setConfigOpen(true);
  };
  const clearSelection = () => {
    selection.clear();
    setConfigOpen(false);
  };
  const removeFromSelection = (id: string) => {
    selection.toggle(id);
  };
  const openMember = (id: string) => {
    setSelectedUserId(id);
    setConfigOpen(false);
  };

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
      <div className="flex items-center justify-between gap-3 border-b border-stone-100 px-4 py-3 sm:px-6 sm:py-4">
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
        {canInvite && (
          <button
            type="button"
            onClick={() => setShowInviteModal(true)}
            className="flex items-center gap-1.5 rounded-lg bg-brand px-3 py-2 text-xs font-semibold text-stone-950 shadow-sm transition hover:bg-brand/80"
            aria-label="Invite team member"
          >
            <Plus className="size-3.5" />
            Invite member
          </button>
        )}
      </div>

      {/* Split pane — stacks on mobile, side-by-side on md+ */}
      <div className="flex flex-col md:flex-row flex-1 min-h-0 overflow-hidden">
        {/* Left panel — hidden on mobile when a member/invite is selected */}
        <aside className={cn(
          "flex flex-col md:w-64 md:shrink-0 md:border-r border-stone-100",
          showConfig || (tab === "members" ? selectedUserId !== null : selectedInviteId !== null)
            ? "hidden md:flex"
            : "flex flex-1 md:flex-none",
        )}>
          {/* Tab switcher */}
          <div className="border-b border-stone-100 p-2">
            <div role="tablist" className={cn(TAB_LIST_CLASS, "flex w-full")}>
            <button
              type="button"
              onClick={() => setTab("members")}
              className={cn(tabClass(tab === "members"), "flex-1 shrink justify-center")}
            >
              Members
              <span className="ml-1.5 rounded-full bg-stone-100 px-1.5 py-0.5 text-2xs text-stone-500">
                {users.length}
              </span>
            </button>
            <button
              type="button"
              onClick={() => setTab("invites")}
              className={cn(tabClass(tab === "invites"), "flex-1 shrink justify-center")}
            >
              Invites
              {pendingCount > 0 && (
                <span className="ml-1.5 rounded-full bg-brand/20 px-1.5 py-0.5 text-2xs text-brand-dark font-bold">
                  {pendingCount}
                </span>
              )}
            </button>
            </div>
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
                  <p className="px-2 py-4 text-xs text-stone-500 text-center">
                    No members yet.
                  </p>
                )}
                {canSelect && selectableIds.length > 0 && (
                  <label className="flex items-center gap-2 px-2.5 py-1.5 text-2xs font-semibold text-stone-500">
                    <Checkbox
                      checked={allPicked ? true : selection.selected.size > 0 ? "indeterminate" : false}
                      onCheckedChange={() => {
                        if (allPicked) clearSelection();
                        else {
                          selection.setAll(selectableIds);
                          setConfigOpen(true);
                        }
                      }}
                      aria-label="Select all members"
                    />
                    Select all
                  </label>
                )}
                {users.map((u) => (
                  <MemberRow
                    key={u.id}
                    user={u}
                    active={u.id === selectedUserId}
                    checked={canSelect && selectableIds.includes(u.id) ? selection.selected.has(u.id) : null}
                    onOpen={openMember}
                    onToggle={toggleMember}
                  />
                ))}
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
                          <div className="mt-0.5 flex flex-wrap items-center gap-1">
                            <InviteStatusBadge invite={inv} />
                            {inv.Status === "pending" && <EmailStatusBadge source={inv} />}
                          </div>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </>
            )}
          </div>

          {configuring && (
            <SelectionStrip
              count={selectedUsers.length}
              panelOpen={showConfig}
              onConfigure={() => setConfigOpen(true)}
              onClear={clearSelection}
            />
          )}
        </aside>

        {/* Right panel — hidden on mobile until a selection is made */}
        <main className={cn(
          "flex-1 overflow-y-auto modal-scrollbar",
          !showConfig && (tab === "members" ? selectedUserId === null : selectedInviteId === null) && "hidden md:block",
        )}>
          {showConfig && (
            <BulkConfigPanel
              users={selectedUsers}
              onRemove={removeFromSelection}
              onClear={clearSelection}
              onBack={() => setConfigOpen(false)}
            />
          )}

          {/* Mobile back button */}
          {!showConfig && (tab === "members" ? selectedUserId !== null : selectedInviteId !== null) && (
            <button
              type="button"
              onClick={() => {
                if (tab === "members") setSelectedUserId(null);
                else setSelectedInviteId(null);
              }}
              className="md:hidden flex items-center gap-1.5 w-full px-4 py-3 text-xs font-semibold text-brand-dark border-b border-stone-100 hover:bg-stone-50 transition-colors"
            >
              <ChevronLeft className="size-3.5" />
              Back to {tab === "members" ? "Members" : "Invites"}
            </button>
          )}

          {tab === "members" && !showConfig && (
            <>
              {!activeUser && !usersQ.isLoading && (
                <div className="hidden md:flex h-full items-center justify-center">
                  <div className="text-center">
                    <UsersRound className="mx-auto mb-2 size-8 text-stone-400" />
                    <p className="text-sm text-stone-500">
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
                <div className="hidden md:flex h-full items-center justify-center">
                  <div className="text-center">
                    <Mail className="mx-auto mb-2 size-8 text-stone-400" />
                    <p className="text-sm text-stone-500">
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
        <InviteModal
          onClose={() => setShowInviteModal(false)}
          onViewInvites={() => {
            setTab("invites");
            setShowInviteModal(false);
          }}
        />
      )}
    </div>
  );
}
