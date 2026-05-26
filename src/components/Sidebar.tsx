import { useState, useEffect } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Users, 
  UserPlus, 
  ChevronDown, 
  LogOut, 
  X,
  Building2
} from 'lucide-react';
import { useAuthStore } from '@/store/useAuthStore';
import { cn } from '@/lib/utils';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function Sidebar({ isOpen, onClose }: SidebarProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  
  // Accordion state - initialized to true if currently on a customer route
  const [isCustomerExpanded, setIsCustomerExpanded] = useState(
    location.pathname.startsWith('/customer')
  );

  // Sync accordion expansion with active routes
  useEffect(() => {
    if (location.pathname.startsWith('/customer')) {
      setIsCustomerExpanded(true);
    }
  }, [location.pathname]);

  const handleLogout = () => {
    logout();
    navigate('/auth/login');
  };

  return (
    <>
      {/* Mobile Sidebar Backdrop */}
      {isOpen && (
        <div 
          className="fixed inset-0 z-40 bg-stone-900/40 backdrop-blur-sm transition-opacity duration-300 lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar Container */}
      <aside 
        className={cn(
          "fixed bottom-0 top-0 left-0 z-50 flex w-72 flex-col justify-between border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-transform duration-300 ease-in-out lg:translate-x-0",
          isOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {/* Header / Brand Logo */}
        <div>
          <div className="relative flex h-16 items-center justify-between px-6 border-b border-sidebar-border/50">
            <NavLink to="/dashboard" className="flex items-center gap-2.5 group">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#c2f589] text-stone-950 shadow-[0_0_15px_rgba(194,245,137,0.3)] transition-transform group-hover:scale-105">
                <Building2 className="size-5" />
              </div>
              <span className="font-heading text-lg font-bold tracking-wider text-stone-900 dark:text-white uppercase transition-colors group-hover:text-stone-700 dark:group-hover:text-stone-200">
                Stone Suite
              </span>
            </NavLink>

            {/* Mobile close button */}
            <button 
              onClick={onClose}
              className="absolute right-4 top-1/2 -translate-y-1/2 rounded-lg p-1 text-stone-500 hover:bg-sidebar-accent hover:text-stone-900 dark:text-stone-400 dark:hover:text-stone-100 lg:hidden"
            >
              <X className="size-5" />
            </button>
          </div>

          {/* Navigation Links */}
          <nav className="space-y-1.5 px-4 py-6">
            {/* Dashboard Link */}
            <NavLink
              to="/dashboard"
              onClick={onClose}
              className={({ isActive }) => cn(
                "flex items-center gap-3.5 rounded-xl px-4 py-3 text-sm font-semibold tracking-wide transition-all duration-200",
                isActive 
                  ? "bg-[#c2f589] text-stone-950 shadow-[0_4px_12px_rgba(194,245,137,0.25)] font-bold" 
                  : "text-stone-600 dark:text-stone-300 hover:bg-sidebar-accent hover:text-stone-900 dark:hover:text-white"
              )}
            >
              <LayoutDashboard className="size-5" />
              <span>Dashboard</span>
            </NavLink>

            {/* Customer Module Accordion */}
            <div className="space-y-1">
              <button
                onClick={() => setIsCustomerExpanded(!isCustomerExpanded)}
                className={cn(
                  "flex w-full items-center justify-between rounded-xl px-4 py-3 text-sm font-semibold tracking-wide transition-all duration-200 cursor-pointer",
                  location.pathname.startsWith('/customer')
                    ? "text-stone-900 dark:text-white bg-sidebar-accent/50"
                    : "text-stone-600 dark:text-stone-300 hover:bg-sidebar-accent hover:text-stone-900 dark:hover:text-white"
                )}
              >
                <div className="flex items-center gap-3.5">
                  <Users className="size-5" />
                  <span>Customer</span>
                </div>
                <ChevronDown 
                  className={cn(
                    "size-4 text-stone-500 transition-transform duration-250",
                    isCustomerExpanded && "rotate-180 text-stone-900 dark:text-white"
                  )}
                />
              </button>

              {/* Accordion Sub-items */}
              <div 
                className={cn(
                  "grid transition-all duration-300 ease-in-out overflow-hidden pl-4",
                  isCustomerExpanded ? "grid-rows-[1fr] opacity-100 mt-1" : "grid-rows-[0fr] opacity-0"
                )}
              >
                <div className="overflow-hidden space-y-1 border-l-2 border-stone-200/60 dark:border-stone-800/80 ml-6 pl-3">
                  <NavLink
                    to="/customer/onboarding"
                    onClick={onClose}
                    className={({ isActive }) => cn(
                      "flex items-center gap-2.5 rounded-lg px-3.5 py-2 text-xs font-semibold tracking-wide transition-all duration-200",
                      isActive
                        ? "bg-[#c2f589]/20 text-[#608731] dark:text-[#a5da67] font-bold"
                        : "text-stone-500 dark:text-stone-400 hover:bg-sidebar-accent hover:text-stone-900 dark:hover:text-white"
                    )}
                  >
                    <UserPlus className="size-4" />
                    <span>Onboarding</span>
                  </NavLink>
                </div>
              </div>
            </div>
          </nav>
        </div>

        {/* Footer / User Profile Card */}
          {/* 
        <div className="p-4 border-t border-sidebar-border/50 bg-stone-50/50 dark:bg-stone-950/20">
          <div className="flex items-center gap-3 rounded-2xl p-2.5 hover:bg-sidebar-accent/50 transition-colors">
            <div className="flex size-10 items-center justify-center rounded-xl bg-[#c2f589] font-bold text-stone-950 shadow-inner">
              {user?.fullName ? user.fullName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) : 'SS'}
            </div>
            
            <div className="flex-1 overflow-hidden">
              <h4 className="truncate text-sm font-bold text-stone-800 dark:text-stone-100">
                {user?.fullName || 'Guest User'}
              </h4>
              <p className="truncate text-xs text-stone-500 dark:text-stone-400">
                {user?.email || 'guest@stonesuite.com'}
              </p>
            </div>
          </div>

          <button
            onClick={handleLogout}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-stone-200 hover:border-stone-300 dark:border-stone-800 dark:hover:border-stone-700 bg-white dark:bg-stone-900/50 py-2.5 text-xs font-bold text-red-600 dark:text-red-400 shadow-sm transition-all duration-200 hover:bg-stone-50 dark:hover:bg-stone-800/80 cursor-pointer"
          >
            <LogOut className="size-4" />
            <span>Sign Out</span>
          </button>
        </div>
       */}
       
      </aside>
    </>
  );
}
