import * as React from 'react';
import { useState, useEffect } from 'react';
import { Outlet, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/store/useAuthStore';
import Sidebar from '@/components/Sidebar';
import { 
  Menu, 
  ChevronRight, 
  User as UserIcon, 
  LogOut, 
  Bell, 
  Settings 
} from 'lucide-react';
import { cn } from '@/lib/utils';

export default function MainLayout() {
  const { isAuthenticated, user, logout } = useAuthStore();
  const location = useLocation();
  const navigate = useNavigate();
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);

  // Close mobile sidebar on navigation
  useEffect(() => {
    setIsMobileSidebarOpen(false);
  }, [location.pathname]);

  // Handle clicking outside the profile dropdown to close it
  useEffect(() => {
    if (!isProfileOpen) return;
    const handleClose = () => setIsProfileOpen(false);
    window.addEventListener('click', handleClose);
    return () => window.removeEventListener('click', handleClose);
  }, [isProfileOpen]);

  if (!isAuthenticated) {
    return <Navigate to="/auth/login" replace />;
  }

  const handleLogout = () => {
    logout();
    navigate('/auth/login');
  };

  // Build Breadcrumbs
  const pathSegments = location.pathname.split('/').filter(Boolean);

  return (
    <div className="min-h-screen bg-stone-50/50 dark:bg-stone-900/10">
      {/* Sidebar Navigation */}
      <Sidebar 
        isOpen={isMobileSidebarOpen} 
        onClose={() => setIsMobileSidebarOpen(false)} 
      />

      {/* Main Content Area */}
      <div className="lg:pl-72 flex flex-col min-h-screen">
        
        {/* Top Header */}
        <header className="sticky top-0 z-30 flex h-16 w-full items-center justify-between border-b border-stone-200/80 bg-white/80 px-6 backdrop-blur-md dark:border-stone-800/80 dark:bg-stone-950/80">
          <div className="flex items-center gap-4">
            {/* Hamburger Trigger for Mobile */}
            <button
              onClick={() => setIsMobileSidebarOpen(true)}
              className="rounded-xl border border-stone-200 dark:border-stone-800 p-2 text-stone-600 hover:bg-stone-50 dark:text-stone-300 dark:hover:bg-stone-900 lg:hidden cursor-pointer"
            >
              <Menu className="size-5" />
            </button>

            {/* Dynamic Breadcrumbs */}
            <nav className="hidden sm:flex items-center gap-1.5 text-xs font-semibold text-stone-500">
              <span className="cursor-pointer hover:text-stone-800 dark:hover:text-stone-200 transition-colors" onClick={() => navigate('/')}>
                Home
              </span>
              {pathSegments.map((segment, index) => {
                const url = `/${pathSegments.slice(0, index + 1).join('/')}`;
                const isLast = index === pathSegments.length - 1;
                return (
                  <React.Fragment key={segment}>
                    <ChevronRight className="size-3.5 text-stone-400 shrink-0" />
                    <span 
                      onClick={() => !isLast && navigate(url)}
                      className={cn(
                        "capitalize transition-colors",
                        isLast 
                          ? "text-stone-800 dark:text-stone-200 font-bold" 
                          : "cursor-pointer hover:text-stone-800 dark:hover:text-stone-200"
                      )}
                    >
                      {segment.replace('-', ' ')}
                    </span>
                  </React.Fragment>
                );
              })}
            </nav>
          </div>

          {/* Right Header Controls */}
          <div className="flex items-center gap-3">
            {/* Notification Center */}
            <button className="relative rounded-xl border border-stone-200 dark:border-stone-800 p-2 text-stone-500 hover:bg-stone-50 dark:text-stone-400 dark:hover:bg-stone-900 transition-colors cursor-pointer">
              <Bell className="size-4.5" />
              <span className="absolute right-2 top-2 flex h-1.5 w-1.5 rounded-full bg-red-500" />
            </button>

            {/* Profile Dropdown Container */}
            <div className="relative">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setIsProfileOpen(!isProfileOpen);
                }}
                className="flex items-center gap-2 rounded-2xl border border-stone-200/80 dark:border-stone-800/80 bg-stone-50/50 dark:bg-stone-900/20 p-1.5 pr-3 text-left hover:bg-stone-100/50 dark:hover:bg-stone-800/30 transition-all cursor-pointer select-none"
              >
                <div className="flex size-7.5 items-center justify-center rounded-xl bg-[#c2f589] text-[11px] font-bold text-stone-950 shadow-sm">
                  {user?.fullName ? user.fullName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) : 'SS'}
                </div>
                <span className="hidden sm:block text-xs font-bold text-stone-700 dark:text-stone-200">
                  {user?.fullName || 'Guest'}
                </span>
              </button>

              {/* Dropdown Menu Card */}
              {isProfileOpen && (
                <div className="absolute right-0 mt-2.5 w-56 origin-top-right rounded-2xl border border-stone-200/80 dark:border-stone-800/80 bg-white dark:bg-stone-950 p-2 shadow-lg ring-1 ring-black/5 animate-in fade-in slide-in-from-top-1 duration-150">
                  {/* User info info */}
                  <div className="px-3.5 py-2.5 border-b border-stone-100 dark:border-stone-900">
                    <h5 className="text-xs font-bold text-stone-800 dark:text-stone-200">
                      {user?.fullName || 'Guest User'}
                    </h5>
                    <p className="truncate text-[10px] text-stone-400 mt-0.5">
                      {user?.email || 'guest@stonesuite.com'}
                    </p>
                  </div>
                  
                  {/* Actions list */}
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

                  {/* Logout Action */}
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
        </header>

        {/* Page Content Viewport */}
        <main className="flex-1 p-6 md:p-8 max-w-7xl w-full mx-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
