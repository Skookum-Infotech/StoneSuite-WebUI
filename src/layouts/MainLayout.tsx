import * as React from 'react';
import { useState, useEffect, startTransition } from 'react';
import { Outlet, Navigate, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/store/useAuthStore';
import { useBreadcrumbStore } from '@/store/useBreadcrumbStore';
import { apiClient } from '@/api/client';
import Sidebar from '@/components/Sidebar';
import { GlobalSearch } from '@/components/GlobalSearch';
import {
  Menu,
  ChevronRight,
  User as UserIcon,
  LogOut,
  Bell,
  Settings,
  Search,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export default function MainLayout(): React.JSX.Element {
  const { isAuthenticated, user, logout } = useAuthStore();
  const breadcrumbLabels = useBreadcrumbStore((s) => s.labels);
  const location = useLocation();
  const navigate = useNavigate();
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isMobileSearchOpen, setIsMobileSearchOpen] = useState(false);

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

  if (!isAuthenticated) {
    return <Navigate to="/auth/login" replace />;
  }

  const handleLogout = (): void => {
    // Clear the httpOnly cookie server-side before wiping local state.
    // Fire-and-forget — navigate regardless of whether the call succeeds.
    apiClient.post('/auth/logout').catch(() => undefined);
    logout();
    navigate('/auth/login');
  };

  const pathSegments = location.pathname.split('/').filter(Boolean);

  return (
    <div className="min-h-screen bg-stone-50/50 dark:bg-stone-900/10">

      {/* ── Unified header ── */}
      <header className="fixed inset-x-0 top-0 z-30 flex h-16 items-center border-b border-white/[0.07] bg-[#111111]">

        {/* Left: both brand logos in one zone */}
        <div className="flex h-full w-auto shrink-0 items-center border-r border-white/[0.07]">

          {/* Mobile menu button */}
          <button
            onClick={() => setIsMobileSidebarOpen(true)}
            aria-label="Open menu"
            className="ml-3 rounded-xl border border-white/10 p-2 text-stone-400 hover:bg-white/[0.06] hover:text-white lg:hidden cursor-pointer transition-colors"
          >
            <Menu className="size-5" />
          </button>

          {/* Stone Suite logo + name */}
          <NavLink to="/dashboard" className="group flex min-w-0 items-center px-5">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden">
              <img src="/logo-only.png" alt="Stone Suite" className="h-7 w-7 object-contain" />
            </div>
            <div className="hidden lg:flex flex-col leading-tight">
              <span
                className="text-label uppercase text-white/90 transition-colors group-hover:text-white font-normal tracking-[0.22em]"
                style={{ fontFamily: 'var(--font-brand)' }}
              >
                Stone
              </span>
              <span
                className="text-label uppercase text-white/90 transition-colors group-hover:text-white font-normal tracking-[0.22em]"
                style={{ fontFamily: 'var(--font-brand)' }}
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

        {/* Main header area: search + actions */}
        <div className="relative flex flex-1 items-center px-4 sm:px-5 gap-3">

          {/* GlobalSearch — small bar on medium (sm to lg) */}
          <div className="hidden sm:flex lg:hidden max-w-xs">
            <GlobalSearch />
          </div>

          {/* GlobalSearch — full bar on desktop (lg+) */}
          <div className="pointer-events-none absolute inset-0 hidden items-center justify-center lg:flex">
            <div className="pointer-events-auto w-full max-w-sm px-4 sm:max-w-md lg:max-w-lg">
              <GlobalSearch />
            </div>
          </div>

          {/* Spacer — pushes actions to the right on mobile, takes center space on medium */}
          <div className="flex-1 sm:hidden" />
          <div className="hidden sm:flex lg:hidden flex-1" />

          {/* Right actions */}
          <div className="flex items-center gap-2 shrink-0 ml-auto">
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
              <span className="absolute right-2 top-2 flex h-1.5 w-1.5 rounded-full bg-red-500" />
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
                <div className="absolute right-0 mt-2.5 w-56 origin-top-right rounded-2xl border border-white/10 bg-[#1c1c1c] p-2 shadow-2xl ring-1 ring-white/[0.04] animate-in fade-in slide-in-from-top-1 duration-150">
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
                      onClick={() => navigate('/dashboard')}
                      className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-semibold text-stone-400 hover:bg-white/[0.06] hover:text-stone-200 transition-colors text-left cursor-pointer"
                    >
                      <UserIcon className="size-4 text-stone-500" />
                      <span>My Profile</span>
                    </button>
                    <button
                      onClick={() => navigate('/dashboard')}
                      className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-semibold text-stone-400 hover:bg-white/[0.06] hover:text-stone-200 transition-colors text-left cursor-pointer"
                    >
                      <Settings className="size-4 text-stone-500" />
                      <span>Account Settings</span>
                    </button>
                  </div>
                  <div className="h-px bg-white/[0.08] my-1" />
                  <button
                    onClick={handleLogout}
                    className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-bold text-red-400 hover:bg-red-950/30 transition-colors text-left cursor-pointer"
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
          'fixed inset-x-0 top-16 z-20 overflow-hidden border-b border-white/[0.07] bg-[#111111]/95 backdrop-blur-md transition-all duration-200 ease-in-out sm:hidden',
          isMobileSearchOpen ? 'max-h-24 opacity-100' : 'max-h-0 opacity-0',
        )}
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
      <div className="flex flex-col min-h-screen pt-16 lg:pl-56">
        <main className="flex-1 w-full flex flex-col min-h-0 bg-white">

          {/* Breadcrumb bar — contextual, scrolls with page */}
          {pathSegments.length > 0 && (
            <nav
              aria-label="Breadcrumb"
              className="flex items-center gap-1.5 px-6 pt-4 pb-1 text-2xs font-semibold text-stone-400"
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
                return (
                  <React.Fragment key={segment}>
                    <ChevronRight className="size-3 text-stone-300 shrink-0" />
                    <span
                      onClick={() => { if (!isLast) navigate(url); }}
                      className={cn(
                        'capitalize transition-colors',
                        isLast
                          ? 'text-stone-600 dark:text-stone-300 font-bold'
                          : 'cursor-pointer hover:text-stone-600 dark:hover:text-stone-200',
                      )}
                    >
                      {breadcrumbLabels[segment] ?? segment.replace(/-/g, ' ')}
                    </span>
                  </React.Fragment>
                );
              })}
            </nav>
          )}

          <Outlet />
        </main>
      </div>
    </div>
  );
}
