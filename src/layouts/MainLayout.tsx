import * as React from 'react';
import { useState, useEffect, useRef } from 'react';
import { Outlet, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/store/useAuthStore';
import Sidebar from '@/components/Sidebar';
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

export default function MainLayout() {
  const { isAuthenticated, user, logout } = useAuthStore();
  const location = useLocation();
  const navigate = useNavigate();
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isMobileSearchOpen, setIsMobileSearchOpen] = useState(false);
  const mobileSearchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isProfileOpen) return;
    const handleClose = () => setIsProfileOpen(false);
    window.addEventListener('click', handleClose);
    return () => window.removeEventListener('click', handleClose);
  }, [isProfileOpen]);

  useEffect(() => {
    if (isMobileSearchOpen) {
      mobileSearchRef.current?.focus();
    }
  }, [isMobileSearchOpen]);

  // Close mobile search when navigating
  useEffect(() => {
    setIsMobileSearchOpen(false);
  }, [location.pathname]);

  if (!isAuthenticated) {
    return <Navigate to="/auth/login" replace />;
  }

  const handleLogout = () => {
    logout();
    navigate('/auth/login');
  };

  const pathSegments = location.pathname.split('/').filter(Boolean);

  return (
    <div className="min-h-screen bg-stone-50/50 dark:bg-stone-900/10">
      <Sidebar
        isOpen={isMobileSidebarOpen}
        onClose={() => setIsMobileSidebarOpen(false)}
      />

      <div className="lg:pl-56 flex flex-col min-h-screen">

        {/* ── Top Header ── */}
        <header className="sticky top-0 z-30 w-full border-b border-stone-200/80 bg-white/80 backdrop-blur-md dark:border-stone-800/80 dark:bg-stone-950/80">

          {/* Main row */}
          <div className="relative flex h-16 items-center justify-between px-4 sm:px-6">

            {/* Left: mobile hamburger */}
            <div className="flex items-center gap-3 shrink-0">
              <button
                onClick={() => setIsMobileSidebarOpen(true)}
                aria-label="Open menu"
                className="rounded-xl border border-stone-200 dark:border-stone-800 p-2 text-stone-600 hover:bg-stone-50 dark:text-stone-300 dark:hover:bg-stone-900 lg:hidden cursor-pointer"
              >
                <Menu className="size-5" />
              </button>
            </div>

            {/* Center: Global Search — desktop only (sm+) */}
            <div className="pointer-events-none absolute inset-0 hidden items-center justify-center sm:flex">
              <div className="pointer-events-auto w-full max-w-sm px-4 sm:max-w-md lg:max-w-lg">
                <div className="relative flex items-center">
                  <Search className="pointer-events-none absolute left-3 size-3.5 text-stone-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search leads, prospects, customers…"
                    aria-label="Global search"
                    className="h-9 w-full rounded-xl border border-stone-200 bg-stone-50/80 pl-8 pr-12 text-xs text-stone-700 placeholder:text-stone-400 focus:border-brand focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand/30 dark:border-stone-700 dark:bg-stone-900/40 dark:text-stone-200 dark:placeholder:text-stone-500 dark:focus:border-brand transition-all"
                  />
                  <kbd className="pointer-events-none absolute right-3 rounded border border-stone-200 bg-white px-1.5 py-0.5 text-[9px] font-semibold text-stone-400 shadow-sm dark:border-stone-700 dark:bg-stone-900 dark:text-stone-500">
                    ⌘K
                  </kbd>
                </div>
              </div>
            </div>

            {/* Right: search toggle (mobile) + notifications + profile */}
            <div className="flex items-center gap-2 shrink-0">

              {/* Mobile search toggle — hidden on sm+ */}
              <button
                onClick={() => setIsMobileSearchOpen((o) => !o)}
                aria-label={isMobileSearchOpen ? 'Close search' : 'Open search'}
                className={cn(
                  'rounded-xl border p-2 transition-colors sm:hidden cursor-pointer',
                  isMobileSearchOpen
                    ? 'border-brand bg-brand/10 text-brand-dark'
                    : 'border-stone-200 text-stone-500 hover:bg-stone-50 dark:border-stone-800 dark:text-stone-400 dark:hover:bg-stone-900',
                )}
              >
                {isMobileSearchOpen ? <X className="size-4" /> : <Search className="size-4" />}
              </button>

              {/* Notification bell */}
              <button
                aria-label="Notifications"
                className="relative rounded-xl border border-stone-200 dark:border-stone-800 p-2 text-stone-500 hover:bg-stone-50 dark:text-stone-400 dark:hover:bg-stone-900 transition-colors cursor-pointer"
              >
                <Bell className="size-4.5" />
                <span className="absolute right-2 top-2 flex h-1.5 w-1.5 rounded-full bg-red-500" />
              </button>

              {/* Profile dropdown */}
              <div className="relative">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsProfileOpen(!isProfileOpen);
                  }}
                  className="flex items-center gap-2 rounded-2xl border border-stone-200/80 dark:border-stone-800/80 bg-stone-50/50 dark:bg-stone-900/20 p-1.5 pr-3 text-left hover:bg-stone-100/50 dark:hover:bg-stone-800/30 transition-all cursor-pointer select-none"
                >
                  <div className="flex size-7 items-center justify-center rounded-xl bg-brand text-label font-bold text-stone-950 shadow-sm">
                    {user?.fullName
                      ? user.fullName.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
                      : 'SS'}
                  </div>
                  <span className="hidden sm:block text-xs font-bold text-stone-700 dark:text-stone-200">
                    {user?.fullName || 'Guest'}
                  </span>
                </button>

                {isProfileOpen && (
                  <div className="absolute right-0 mt-2.5 w-56 origin-top-right rounded-2xl border border-stone-200/80 dark:border-stone-800/80 bg-white dark:bg-stone-950 p-2 shadow-lg ring-1 ring-black/5 animate-in fade-in slide-in-from-top-1 duration-150">
                    <div className="px-3.5 py-2.5 border-b border-stone-100 dark:border-stone-900">
                      <h5 className="text-xs font-bold text-stone-800 dark:text-stone-200">
                        {user?.fullName || 'Guest User'}
                      </h5>
                      <p className="truncate text-2xs text-stone-400 mt-0.5">
                        {user?.email || 'guest@stonesuite.com'}
                      </p>
                    </div>
                    <div className="py-1">
                      <button
                        onClick={() => navigate('/dashboard')}
                        className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-semibold text-stone-600 dark:text-stone-300 hover:bg-stone-50 dark:hover:bg-stone-900 transition-colors text-left cursor-pointer"
                      >
                        <UserIcon className="size-4 text-stone-400" />
                        <span>My Profile</span>
                      </button>
                      <button
                        onClick={() => navigate('/dashboard')}
                        className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-semibold text-stone-600 dark:text-stone-300 hover:bg-stone-50 dark:hover:bg-stone-900 transition-colors text-left cursor-pointer"
                      >
                        <Settings className="size-4 text-stone-400" />
                        <span>Account Settings</span>
                      </button>
                    </div>
                    <div className="h-px bg-stone-100 dark:bg-stone-900 my-1" />
                    <button
                      onClick={handleLogout}
                      className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-bold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors text-left cursor-pointer"
                    >
                      <LogOut className="size-4" />
                      <span>Sign Out</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Mobile search expansion — slides in below the main row */}
          <div
            className={cn(
              'overflow-hidden transition-all duration-200 ease-in-out sm:hidden',
              isMobileSearchOpen ? 'max-h-20 opacity-100' : 'max-h-0 opacity-0',
            )}
          >
            <div className="px-4 pb-3 pt-0">
              <div className="relative flex items-center">
                <Search className="pointer-events-none absolute left-3 size-3.5 text-stone-400" />
                <input
                  ref={mobileSearchRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search leads, prospects, customers…"
                  aria-label="Global search"
                  className="h-9 w-full rounded-xl border border-stone-200 bg-stone-50 pl-8 pr-3 text-xs text-stone-700 placeholder:text-stone-400 focus:border-brand focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand/30 dark:border-stone-700 dark:bg-stone-900/60 dark:text-stone-200 dark:placeholder:text-stone-500 transition-all"
                />
              </div>
            </div>
          </div>
        </header>

        {/* ── Page Content ── */}
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
                      {segment.replace(/-/g, ' ')}
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
