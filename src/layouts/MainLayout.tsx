import * as React from 'react';
import { useState, useEffect, useCallback, startTransition } from 'react';
import { Outlet, Navigate, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/store/useAuthStore';
import { useBreadcrumbStore } from '@/store/useBreadcrumbStore';
import { useSessionTimer } from '@/hooks/useSessionTimer';
import { useUserPermissions } from '@/hooks/useUserPermissions';
import { useExitConfirmation } from '@/hooks/useExitConfirmation';
import { formatBreadcrumbSegment } from '@/lib/breadcrumb';
import { SessionExpiryModal } from '@/components/SessionExpiryModal';
import { ConfirmLeaveDialog } from '@/components/ConfirmLeaveDialog';
import { apiClient } from '@/api/client';
import { rbacService } from '@/services/tenantServices';
import { authService } from '@/services/authService';
import { apiErrorMessage } from '@/api/tenantClient';
import { samlAuthService } from '@/services/samlAuthService';
import { SAML_ACTIVE_PROVIDER_KEY } from '@/lib/samlSession';
import type { SAMLProvider } from '@/types/tenant';
import Sidebar from '@/components/Sidebar';
import { GlobalSearch } from '@/components/GlobalSearch';
import { AssistantPanel } from '@/components/ai/AssistantPanel';
import {
  Menu,
  ChevronRight,
  LogOut,
  Bell,
  Settings,
  Search,
  X,
  CreditCard,
  Shield,
  Building2,
  Check,
  Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// See the isCustomer guard below for why this exists as an explicit allowlist
// rather than per-route PermissionGuard coverage alone.
const CUSTOMER_ALLOWED_PATH_PREFIXES = [
  '/sales/sales_order',
  '/sales/invoice',
  '/sales/payment',
  '/sales/refund',
  '/account/settings',
];

export default function MainLayout(): React.JSX.Element {
  const { isAuthenticated, user, setAuth, logout } = useAuthStore();
  const isCustomer = useAuthStore((s) => s.kind === 'portal');
  const workspaces = useAuthStore((s) => s.workspaces);
  const applyWorkspaceSwitch = useAuthStore((s) => s.applyWorkspaceSwitch);
  const breadcrumbLabels = useBreadcrumbStore((s) => s.labels);
  const { activeRoleId } = useUserPermissions();
  const queryClient = useQueryClient();
  const location = useLocation();
  const navigate = useNavigate();
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isMobileSearchOpen, setIsMobileSearchOpen] = useState(false);

  const { showWarning, secondsRemaining, onStay, onLogout, isExtending } = useSessionTimer();

  // Same switch-role round-trip as the Account Settings > Roles & Access tab —
  // re-signs the JWT server-side so the active-role claim actually narrows
  // authz enforcement, not just what this menu displays.
  const switchRoleMutation = useMutation({
    mutationFn: (roleId: string) => rbacService.switchRole(roleId),
    onSuccess: (data, roleId) => {
      if (user) {
        setAuth({ ...user, selectedRoleId: roleId }, data.token, data.expiresAt);
      }
      queryClient.invalidateQueries({ queryKey: ['user-permissions', user?.id] });
    },
  });

  // A customer-portal identity linked to several tenants (identity_tenants)
  // switching which workspace's documents the shared List/Detail pages show.
  // switchWorkspace mints a token scoped to the new tenant — any cached
  // sales-order/invoice/etc. data from the previous workspace is invalid,
  // which is exactly what applyWorkspaceSwitch clears (see useAuthStore).
  const switchWorkspaceMutation = useMutation({
    mutationFn: (tenantId: string) => authService.switchWorkspace(tenantId),
    onSuccess: (data) => {
      applyWorkspaceSwitch(data.tenantId, data.token, data.expiresAt);
      setIsProfileOpen(false);
    },
  });

  useEffect(() => {
    if (!isProfileOpen) return;
    const handleClose = (): void => setIsProfileOpen(false);
    window.addEventListener('click', handleClose);
    return () => window.removeEventListener('click', handleClose);
  }, [isProfileOpen]);

  // Close mobile search when navigating
  useEffect(() => {
    startTransition(() => {
      setIsMobileSearchOpen(false);
    });
  }, [location.pathname]);

  const handleLogout = useCallback(async (): Promise<void> => {
    // A session established via SAML sign-in needs the IdP notified (SLO)
    // in addition to the local logout — MainLayout is the only user-facing
    // logout entry point, so this is the one place that distinction matters.
    const samlProvider = sessionStorage.getItem(SAML_ACTIVE_PROVIDER_KEY) as SAMLProvider | null;
    if (samlProvider) {
      sessionStorage.removeItem(SAML_ACTIVE_PROVIDER_KEY);
      try {
        const result = await samlAuthService.logout(samlProvider);
        // Local auth_token/refresh_token cookies are already cleared
        // server-side by the time this resolves (saml_logout.go), regardless
        // of sloAvailable.
        logout();
        if (result.sloAvailable && result.logoutUrl) {
          window.location.href = result.logoutUrl; // IdP handles the rest
          return;
        }
        navigate('/auth/login', { replace: true });
        return;
      } catch {
        // Session may already be gone server-side — fall through to the
        // password-logout path below so the user isn't stuck signed in locally.
      }
    }

    // Clear the httpOnly cookie server-side before wiping local state. A
    // customer session's cookies live at /api/portal/auth/logout — the staff
    // endpoint would 403 (RequireAuth's path confinement) and clear nothing.
    // Fire-and-forget — navigate regardless of whether the call succeeds.
    apiClient.post(isCustomer ? '/portal/auth/logout' : '/auth/logout').catch(() => undefined);
    logout();
    // replace: true so Back after signing out does not re-enter the app shell.
    navigate('/auth/login', { replace: true });
  }, [logout, navigate, isCustomer]);

  // Backing out of the bottom of the history stack drops the user out of the app
  // entirely, and that exit cannot be cancelled once it happens. The guard parks
  // an entry there, catches the press, and offers a real choice instead. It is
  // not tied to a route — the hook anchors on the stack position itself.
  const exitConfirmation = useExitConfirmation(isAuthenticated);

  if (!isAuthenticated) {
    return <Navigate to="/auth/login" replace />;
  }

  // A customer-portal session may only reach its four document types (List
  // and Detail — Add/Edit already render "Access Denied" via PermissionGuard,
  // so there is no need to redirect away from those specifically) plus its
  // own account settings. Everything else under this shell is staff-only.
  // This is a single allowlisted choke point rather than relying on every
  // route remembering its own PermissionGuard — /dashboard, /transactions and
  // /subscription, for instance, declare none at all.
  if (isCustomer && !CUSTOMER_ALLOWED_PATH_PREFIXES.some((p) => location.pathname.startsWith(p))) {
    return <Navigate to="/sales/sales_order" replace />;
  }

  const pathSegments = location.pathname.split('/').filter(Boolean);

  // Segments that are namespace prefixes with no real index page — non-navigable in breadcrumb.
  const nonNavigableSegments = new Set(['crm', 'sales', 'purchases', 'customer', 'onboarding']);

  return (
    <div className="min-h-screen bg-stone-50/50 dark:bg-stone-900/10">

      {exitConfirmation.isPrompting && (
        <ConfirmLeaveDialog
          variant="exit-app"
          onConfirm={() => { exitConfirmation.dismiss(); handleLogout(); }}
          onCancel={exitConfirmation.dismiss}
        />
      )}

      {showWarning && (
        <SessionExpiryModal
          secondsRemaining={secondsRemaining}
          onStay={onStay}
          onLogout={onLogout}
          isExtending={isExtending}
        />
      )}

      {/* ── Unified header ── */}
      <header className="fixed inset-x-0 top-0 z-30 flex h-16 items-center border-b border-white/[0.07]" style={{ background: 'var(--gradient-header)' }}>

        {/* Left: both brand logos in one zone */}
        <div className="flex h-full w-auto shrink-0 items-center">

          {/* Mobile menu button */}
          <button
            onClick={() => setIsMobileSidebarOpen(true)}
            aria-label="Open menu"
            className="ml-3 rounded-xl border border-white/10 p-2 text-stone-400 hover:bg-white/[0.06] hover:text-white lg:hidden cursor-pointer transition-colors"
          >
            <Menu className="size-5" />
          </button>

          {/* Stone Suite logo + name */}
          <NavLink to="/dashboard" className="group flex min-w-0 items-center gap-1 px-5">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden">
              <img src="/logo-only.png" alt="Stone Suite" className="h-10 w-10 object-contain drop-shadow-[0_0_6px_rgba(255,255,255,0.15)]" />
            </div>
            <div className="hidden lg:flex flex-col leading-none">
              <span
                className="font-brand text-sm uppercase text-white/95 transition-colors group-hover:text-white font-semibold tracking-[0.26em]"
              >
                Stone
              </span>
              <span
                className="font-brand text-sm uppercase text-white/95 transition-colors group-hover:text-white font-semibold tracking-[0.26em]"
              >
                Suite
              </span>
            </div>
          </NavLink>

          {/* Divider between the two logos */}
          <div className="hidden lg:block h-7 w-px bg-white/12 mx-1" />

          {/* Elevation Stone — pill logo on desktop */}
          <div className="hidden lg:flex items-center px-3">
            <img
              src="/elevation-stone-logo.svg"
              alt="Elevation Stone"
              className="h-45 w-auto object-contain"
            />
          </div>

          {/* Elevation Stone — circular badge on mobile */}
          <div className="flex lg:hidden items-center pl-2">
            <img
              src="/elevation-stone-badge.svg"
              alt="Elevation Stone"
              className="h-9 w-9 object-contain"
            />
          </div>
        </div>

        {/* GlobalSearch — flex-centered between logos and actions on lg+ */}
        <div className="hidden lg:flex flex-1 items-center justify-center px-4">
          <div className="w-full max-w-lg 3xl:max-w-xl 4xl:max-w-2xl">
            <GlobalSearch />
          </div>
        </div>

        {/* Right area: sm search + spacer + actions (flex-1 on mobile, shrink-0 on lg+) */}
        <div className="flex flex-1 lg:flex-none items-center px-4 sm:px-5 gap-3">

          {/* GlobalSearch — small bar on sm only (hidden lg+) */}
          <div className="hidden sm:flex lg:hidden max-w-xs">
            <GlobalSearch />
          </div>

          {/* Spacer — only active on mobile/sm, lg+ center div handles the space */}
          <div className="flex-1 sm:hidden" />
          <div className="hidden sm:flex lg:hidden flex-1" />

          {/* Right actions */}
          <div className="flex items-center gap-2 shrink-0 ml-auto lg:ml-0">
            <button
              onClick={() => setIsMobileSearchOpen((o) => !o)}
              aria-label={isMobileSearchOpen ? 'Close search' : 'Open search'}
              className={cn(
                'rounded-xl border p-2 transition-colors sm:hidden cursor-pointer',
                isMobileSearchOpen
                  ? 'border-brand bg-brand/10 text-brand-dark'
                  : 'border-white/10 text-stone-400 hover:bg-white/[0.06] hover:text-stone-200',
              )}
            >
              {isMobileSearchOpen ? <X className="size-4" /> : <Search className="size-4" />}
            </button>

            <button
              aria-label="Notifications"
              className="relative rounded-xl border border-white/10 p-2 text-stone-400 hover:bg-white/[0.06] hover:text-stone-200 transition-colors cursor-pointer"
            >
              <Bell className="size-4.5" />
              <span className="absolute right-2 top-2 flex h-1.5 w-1.5 rounded-full bg-destructive" />
            </button>

            <div className="relative">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setIsProfileOpen(!isProfileOpen);
                }}
                className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.06] p-1.5 pr-3 text-left hover:bg-white/10 transition-all cursor-pointer select-none"
              >
                <div className="flex size-7 items-center justify-center rounded-xl bg-brand text-label font-bold text-stone-950 shadow-sm">
                  {user?.fullName
                    ? user.fullName.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
                    : 'SS'}
                </div>
                <span className="hidden sm:block text-xs font-bold text-stone-200">
                  {user?.fullName || 'Guest'}
                </span>
              </button>

              {isProfileOpen && (
                <div className="absolute right-0 mt-2.5 w-60 origin-top-right rounded-2xl border border-white/10 bg-[#1c1c1c] p-2 shadow-2xl ring-1 ring-white/[0.04] animate-in fade-in slide-in-from-top-1 duration-150 max-h-96 overflow-y-auto">
                  <div className="px-3.5 py-2.5 border-b border-white/[0.08]">
                    <h5 className="text-xs font-bold text-stone-200">
                      {user?.fullName || 'Guest User'}
                    </h5>
                    <p className="truncate text-2xs text-stone-500 mt-0.5">
                      {user?.email || 'guest@stonesuite.com'}
                    </p>
                  </div>
                  <div className="py-1">
                    <button
                      onClick={() => { setIsProfileOpen(false); navigate('/account/settings'); }}
                      className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-semibold text-stone-400 hover:bg-white/[0.06] hover:text-stone-200 transition-colors text-left cursor-pointer"
                    >
                      <Settings className="size-4 text-stone-500" />
                      <span>Account Settings</span>
                    </button>
                  </div>
                  <div className="h-px bg-white/[0.08] my-1" />
                  <div className="py-1">
                    <button
                      onClick={() => { setIsProfileOpen(false); navigate('/transactions'); }}
                      className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-semibold text-stone-400 hover:bg-white/[0.06] hover:text-stone-200 transition-colors text-left cursor-pointer"
                    >
                      <CreditCard className="size-4 text-stone-500" />
                      <span>My Transactions</span>
                    </button>
                  </div>
                  <div className="h-px bg-white/[0.08] my-1" />
                  {isCustomer ? (
                    <div className="py-1">
                      <div className="px-3 py-2 text-2xs font-bold text-stone-500 uppercase tracking-wide">
                        Workspaces
                      </div>
                      {workspaces.length > 0 ? (
                        <div className="space-y-0.5">
                          {workspaces.map((w) => {
                            const isActive = w.active;
                            const isSwitching = switchWorkspaceMutation.isPending && switchWorkspaceMutation.variables === w.tenantId;
                            return (
                              <button
                                key={w.tenantId}
                                type="button"
                                onClick={(e) => { e.stopPropagation(); if (!isActive) switchWorkspaceMutation.mutate(w.tenantId); }}
                                disabled={switchWorkspaceMutation.isPending || isActive}
                                aria-pressed={isActive}
                                className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-semibold text-stone-400 hover:bg-white/[0.06] hover:text-stone-200 transition-colors text-left cursor-pointer disabled:cursor-not-allowed disabled:hover:bg-transparent"
                              >
                                {isSwitching ? (
                                  <Loader2 className="size-4 text-stone-500 flex-shrink-0 animate-spin" />
                                ) : (
                                  <Building2 className="size-4 text-stone-500 flex-shrink-0" />
                                )}
                                <span className="flex-1 truncate">{w.name}</span>
                                {isActive && <Check className="size-4 text-brand flex-shrink-0" />}
                              </button>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="px-3 py-2 text-2xs text-stone-500">
                          No workspaces
                        </div>
                      )}
                      {switchWorkspaceMutation.isError && (
                        <p className="px-3 pt-1 text-2xs text-destructive">
                          {apiErrorMessage(switchWorkspaceMutation.error, 'Failed to switch workspace. Try again.')}
                        </p>
                      )}
                    </div>
                  ) : (
                    <div className="py-1">
                      <div className="px-3 py-2 text-2xs font-bold text-stone-500 uppercase tracking-wide">
                        Roles
                      </div>
                      {user?.roles && user.roles.length > 0 ? (
                        <div className="space-y-0.5">
                          {user.roles.map((role) => {
                            const isActive = role.id === (activeRoleId || user.selectedRoleId);
                            const isSwitching = switchRoleMutation.isPending && switchRoleMutation.variables === role.id;
                            return (
                              <button
                                key={role.id}
                                type="button"
                                onClick={(e) => { e.stopPropagation(); switchRoleMutation.mutate(role.id); }}
                                disabled={switchRoleMutation.isPending || isActive}
                                aria-pressed={isActive}
                                className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-semibold text-stone-400 hover:bg-white/[0.06] hover:text-stone-200 transition-colors text-left cursor-pointer disabled:cursor-not-allowed disabled:hover:bg-transparent"
                              >
                                {isSwitching ? (
                                  <Loader2 className="size-4 text-stone-500 flex-shrink-0 animate-spin" />
                                ) : (
                                  <Shield className="size-4 text-stone-500 flex-shrink-0" />
                                )}
                                <span className="flex-1">{role.name}</span>
                                {isActive && <Check className="size-4 text-brand flex-shrink-0" />}
                              </button>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="px-3 py-2 text-2xs text-stone-500">
                          No roles assigned
                        </div>
                      )}
                      {switchRoleMutation.isError && (
                        <p className="px-3 pt-1 text-2xs text-destructive">
                          Failed to switch role. Try again.
                        </p>
                      )}
                    </div>
                  )}
                  <div className="h-px bg-white/[0.08] my-1" />
                  <button
                    onClick={handleLogout}
                    className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-bold text-destructive hover:bg-destructive/10 transition-colors text-left cursor-pointer"
                  >
                    <LogOut className="size-4" />
                    <span>Sign Out</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Mobile search expansion — fixed below header */}
      <div
        className={cn(
          'fixed inset-x-0 top-16 z-20 overflow-hidden border-b border-white/[0.07] backdrop-blur-md transition-all duration-200 ease-in-out sm:hidden',
          isMobileSearchOpen ? 'max-h-24 opacity-100' : 'max-h-0 opacity-0',
        )}
        style={{ background: 'linear-gradient(135deg, #001219 0%, #005f73 40%, #0a2540 75%, #050e1a 100%)' }}
      >
        <div className="px-4 py-3">
          <GlobalSearch
            hideKbd
            autoFocus={isMobileSearchOpen}
            onNavigate={() => setIsMobileSearchOpen(false)}
          />
        </div>
      </div>

      <Sidebar
        isOpen={isMobileSidebarOpen}
        onClose={() => setIsMobileSidebarOpen(false)}
      />

      {/* ── Page Content ── */}
      <div className="flex flex-col min-h-screen pt-16" style={{ paddingLeft: 'var(--sidebar-offset)' }}>
        <main className="flex-1 w-full flex flex-col min-h-0 bg-background">

          {/* Breadcrumb bar — contextual, scrolls with page */}
          {pathSegments.length > 0 && (
            <nav
              aria-label="Breadcrumb"
              className="flex flex-wrap items-center gap-1.5 px-4 pt-3 pb-1 sm:px-6 sm:pt-4 3xl:px-12 3xl:pt-5 4xl:px-16 text-2xs xl:text-xs font-semibold text-stone-400"
            >
              <span
                className="cursor-pointer hover:text-stone-600 dark:hover:text-stone-200 transition-colors"
                onClick={() => navigate('/')}
              >
                Home
              </span>
              {pathSegments.map((segment, index) => {
                const url = `/${pathSegments.slice(0, index + 1).join('/')}`;
                const isLast = index === pathSegments.length - 1;
                const isClickable = !isLast && !nonNavigableSegments.has(segment);
                return (
                  <React.Fragment key={segment}>
                    <ChevronRight className="size-3 xl:size-3.5 text-stone-300 shrink-0" />
                    <span
                      onClick={() => { if (isClickable) navigate(url); }}
                      className={cn(
                        'transition-colors',
                        isLast
                          ? 'text-stone-600 dark:text-stone-300 font-bold'
                          : isClickable
                            ? 'cursor-pointer hover:text-stone-600 dark:hover:text-stone-200'
                            : 'text-stone-400',
                      )}
                    >
                      {breadcrumbLabels[segment] ?? formatBreadcrumbSegment(segment)}
                    </span>
                  </React.Fragment>
                );
              })}
            </nav>
          )}

          <Outlet />
        </main>
      </div>

      <AssistantPanel />
    </div>
  );
}
