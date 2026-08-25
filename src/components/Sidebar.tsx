import { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { ChevronDown, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/store/useAuthStore';
import { useUserPermissions } from '@/hooks/useUserPermissions';
import { useWorkflows } from '@/hooks/useWorkflows';
import { sidebarNav } from '@/config/sidebarNav';
import type { NavLink as NavLinkItem, NavGroup, NavEntry, NavSection } from '@/config/sidebarNav';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

const linkClass = ({ isActive }: { isActive: boolean }) =>
  cn(
    'group flex items-center gap-2.5 rounded-md px-3 py-2 text-xs font-semibold tracking-wide transition-all duration-200',
    isActive
      ? 'bg-accent text-accent-foreground font-bold'
      : 'text-stone-700 hover:bg-accent/60 hover:text-stone-900',
  );

const childLinkClass = ({ isActive }: { isActive: boolean }) =>
  cn(
    'group flex items-center gap-2 rounded-md px-2.5 py-1.5 text-xs font-medium tracking-wide transition-all duration-200',
    isActive
      ? 'bg-accent text-accent-foreground font-semibold'
      : 'text-stone-700 hover:bg-accent/50 hover:text-stone-900',
  );

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="px-3 pb-1 pt-4 text-2xs xl:text-xs font-semibold tracking-wide text-stone-700 dark:text-stone-700">
      {children}
    </p>
  );
}

// Derive initial open state: all groups start collapsed.
function buildInitialOpenState(): Record<string, boolean> {
  const state: Record<string, boolean> = {};
  sidebarNav.sections.forEach((section) => {
    section.entries.forEach((entry) => {
      if (entry.type === 'group') state[entry.id] = false;
    });
  });
  return state;
}

export default function Sidebar({ isOpen, onClose }: SidebarProps) {
  const location = useLocation();
  const user = useAuthStore((s) => s.user);
  const isCustomer = useAuthStore((s) => s.kind === 'portal');
  const { hasPermission, isLoading: permissionsLoading } = useUserPermissions();
  const { isWorkflowEnabled, isLoading: workflowsLoading } = useWorkflows();
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(buildInitialOpenState);

  function toggleGroup(id: string) {
    setOpenGroups((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  // While permissions are loading, show all items to avoid layout shift.
  function canShowLink(item: NavLinkItem): boolean {
    if (item.platformAdminOnly && !user?.isPlatformAdmin) return false;
    // Independent of the viewer's permissions: a workflow an admin disabled
    // in Configuration > Workflows is hidden from every user, not just those
    // without the resource grant.
    if (item.workflowKey && !workflowsLoading && !isWorkflowEnabled(item.workflowKey)) return false;
    if (permissionsLoading) return true;
    if (item.permission) return hasPermission(item.permission.resource, item.permission.action);
    // `alwaysVisible` means "every signed-in STAFF user" (Dashboard,
    // Subscription) — neither has a /api/portal/* backing, so a customer
    // session gets no catch-all here. Every link a customer may reach
    // (Sales Orders/Invoices/Payments/Refunds) declares an explicit
    // `permission` and is handled by the branch above via useUserPermissions'
    // portal allowlist, never by this fallback.
    if (isCustomer) return false;
    // Fail closed. A link that declares no access rule at all is a config
    // oversight, and the safe reading of an oversight is "hide it" — the
    // previous default showed it, which is how fourteen Sales and Purchases
    // modules ended up advertised to users whose every click returned 403.
    //
    // `platformAdminOnly` counts as a declaration in its own right: reaching
    // this line means the guard above already passed, so the caller *is* a
    // platform admin. Omitting it here would hide the Platform section from
    // the only people who can use it.
    return item.alwaysVisible === true || item.platformAdminOnly === true;
  }

  function visibleChildren(group: NavGroup): NavLinkItem[] {
    return group.children.filter(canShowLink);
  }

  function canShowEntry(entry: NavEntry): boolean {
    if (entry.type === 'link') return canShowLink(entry);
    // Group-level gates: platformAdminOnly and explicit permission (if declared).
    if (entry.platformAdminOnly && !user?.isPlatformAdmin) return false;
    if (!permissionsLoading && entry.permission && !hasPermission(entry.permission.resource, entry.permission.action)) return false;
    // Group is visible only when at least one child passes its own access check.
    return visibleChildren(entry).length > 0;
  }

  function canShowSection(section: NavSection): boolean {
    if (section.platformAdminOnly && !user?.isPlatformAdmin) return false;
    return section.entries.some(canShowEntry);
  }

  function isGroupActive(group: NavGroup): boolean {
    return group.matchPaths.some((p) => location.pathname.startsWith(p));
  }

  function renderLink(item: NavLinkItem, isChild = false) {
    const Icon = item.icon;
    return (
      <NavLink
        key={item.id}
        to={item.path}
        onClick={onClose}
        className={isChild ? childLinkClass : linkClass}
      >
        <Icon
          className={cn(
            'shrink-0 transition-transform duration-200 group-hover:scale-110',
            isChild ? 'size-3 xl:size-3.5' : 'size-3.5 xl:size-4',
            item.iconColor,
          )}
        />
        <span>{item.label}</span>
      </NavLink>
    );
  }

  function renderGroup(group: NavGroup) {
    const children = visibleChildren(group);
    if (children.length === 0) return null;

    const groupOpen = openGroups[group.id] ?? false;
    const active = isGroupActive(group);
    const Icon = group.icon;

    return (
      <div key={group.id} className="space-y-0.5">
        <button
          type="button"
          onClick={() => toggleGroup(group.id)}
          aria-label={`Toggle ${group.label} menu`}
          className={cn(
            'group flex w-full cursor-pointer items-center justify-between rounded-md px-3 py-2 text-xs font-semibold tracking-wide transition-all duration-200',
            active
              ? 'bg-accent/60 text-accent-foreground'
              : 'text-stone-700 hover:bg-accent/40 hover:text-stone-900',
          )}
        >
          <div className="flex items-center gap-2.5">
            <Icon
              className={cn(
                'size-3.5 shrink-0 transition-transform duration-200 group-hover:scale-110',
                group.iconColor,
              )}
            />
            <span>{group.label}</span>
          </div>
          <ChevronDown
            className={cn('size-3 xl:size-3.5 transition-transform duration-200', groupOpen && 'rotate-180')}
          />
        </button>

        <div
          className={cn(
            'grid overflow-hidden transition-all duration-300 ease-in-out',
            groupOpen ? 'mt-0.5 grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0',
          )}
        >
          <div className="ml-4 space-y-0.5 overflow-hidden border-l border-sidebar-border pl-2.5">
            {children.map((child) => renderLink(child, true))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-stone-900/40 backdrop-blur-sm transition-opacity duration-300 lg:hidden"
          onClick={onClose}
        />
      )}

      <aside
        className={cn(
          'fixed bottom-0 left-0 z-50 flex w-56 flex-col border-r border-sidebar-border bg-background text-sidebar-foreground transition-transform duration-300 ease-in-out',
          'top-0 lg:top-16',
          isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
        )}
        style={{ width: 'var(--sidebar-w)' }}
      >
        <div className="flex h-full flex-col overflow-y-auto modal-scrollbar">
          {/* Mobile-only close button row */}
          <div className="flex items-center justify-between border-b border-stone-200/80 px-4 py-3 lg:hidden">
            <span className="text-xs font-semibold text-stone-700">Navigation</span>
            <button
              onClick={onClose}
              aria-label="Close menu"
              className="rounded-lg p-1 text-stone-700 hover:bg-sidebar-accent hover:text-stone-900 dark:text-stone-700 dark:hover:text-stone-100"
            >
              <X className="size-4" />
            </button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 space-y-0.5 px-2.5 py-2">
            {/* Top-level items (e.g. Dashboard) — always visible to staff,
                filtered like everything else for a customer session. */}
            {sidebarNav.topItems.filter(canShowLink).map((item) => renderLink(item))}

            {/* Sections driven by sidebarNav config */}
            {sidebarNav.sections.filter(canShowSection).map((section) => (
              <div key={section.id}>
                <SectionLabel>{section.label}</SectionLabel>
                <div className="space-y-0.5">
                  {section.entries.map((entry) => {
                    if (!canShowEntry(entry)) return null;
                    if (entry.type === 'link') return renderLink(entry);
                    // A customer's navigable surface is a handful of document
                    // types, not a hierarchy — whatever's visible renders as
                    // flat top-level links instead of a collapsible group.
                    if (isCustomer) return visibleChildren(entry).map((child) => renderLink(child));
                    return renderGroup(entry);
                  })}
                </div>
              </div>
            ))}
          </nav>
        </div>
      </aside>
    </>
  );
}
