import { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  ChevronDown,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { SidebarItem } from '@/types/sidebar';
import { sidebarItems } from '@/config/sidebar';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function Sidebar({ isOpen, onClose }: SidebarProps) {
  const location = useLocation();

  // Accordion state - initialized to true if currently on a customer route
  const [expandedItems, setExpandedItems] = useState<string[]>([])


  const toggleExpanded = (title: string) => {
    setExpandedItems((prev) =>
      prev.includes(title)
        ? prev.filter((item) => item !== title)
        : [...prev, title]
    )
  }

  // ONCE USER.ROLE IS IMPLEMENTED WE CAN ACTIVATE THE SIDEBAR MODULE ACCESS ------------------------->
  // const canAccess = (item: SidebarItem) => {
  //   if (!item.access?.length) return true
  //   return user?.role ? item.access.includes(user.role as any) : false
  // }

  const canAccess = (_item: SidebarItem) => true

  const isItemActive = (item: SidebarItem) => {
    if (item.path && location.pathname === item.path) return true

    return item.children?.some((child) =>
      child.path ? location.pathname.startsWith(child.path) : false
    )
  }
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
          "fixed bottom-0 top-0 left-0 z-50 flex w-56 flex-col justify-between border-r border-sidebar-border bg-background text-sidebar-foreground transition-transform duration-300 ease-in-out lg:translate-x-0",
          isOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {/* Header / Brand Logo */}
        <div>
          <div className="relative flex h-12 items-center justify-between border-b border-border bg-stone-350 px-4">
            <NavLink to="/dashboard" className="group flex min-w-0 items-center gap-2">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden">
                <img
                  src="/logo-only.png"
                  alt="Stone Suite"
                  className="h-6 w-6 object-contain"
                />
              </div>
              <span className="font-heading text-sm font-bold tracking-wider text-dark dark:text-white uppercase transition-colors group-hover:text-stone-700 dark:group-hover:text-stone-200">
                Stone Suite
              </span>
            </NavLink>

            {/* Mobile close button */}
            <button
              onClick={onClose}
              className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-1 text-stone-500 hover:bg-sidebar-accent hover:text-stone-900 dark:text-stone-400 dark:hover:text-stone-100 lg:hidden"
            >
              <X className="size-4" />
            </button>
          </div>

          {/* Navigation Links */}
          <nav className="space-y-0.5 px-2.5 py-4">
            {sidebarItems.filter(canAccess).map((item) => {
              const Icon = item.icon
              const hasChildren = item.children && item.children.length > 0
              const isActive = isItemActive(item)
              const isExpanded = expandedItems.includes(item.title) || isActive

              if (!hasChildren && item.path) {
                return (
                  <NavLink
                    key={item.title}
                    to={item.path}
                    onClick={onClose}
                    className={({ isActive }) =>
                      cn(
                        'flex items-center gap-2.5 rounded-md px-3 py-2 text-xs font-semibold tracking-wide transition-all duration-200',
                        isActive
                          ? "bg-brand text-stone-950 shadow-[0_4px_12px_rgba(194,245,137,0.25)] font-bold"
                          : "text-stone-600 dark:text-stone-300 hover:bg-sidebar-accent hover:text-stone-900 dark:hover:text-white"
                      )
                    }
                  >
                    <Icon className="size-3.5" />
                    <span>{item.title}</span>
                  </NavLink>
                )
              }

              return (
                <div key={item.title} className="space-y-0.5">
                  <button
                    type="button"
                    onClick={() => toggleExpanded(item.title)}
                    className={cn(
                      'flex w-full cursor-pointer items-center justify-between rounded-md px-3 py-2 text-xs font-semibold tracking-wide transition-all duration-200',
                      isActive
                        ? "text-stone-900 dark:text-white bg-sidebar-accent/50"
                        : "text-stone-600 dark:text-stone-300 hover:bg-sidebar-accent hover:text-stone-900 dark:hover:text-white"
                    )}
                  >
                    <div className="flex items-center gap-2.5">
                      <Icon className="size-3.5" />
                      <span>{item.title}</span>
                    </div>

                    <ChevronDown
                      className={cn(
                        'size-3 transition-transform duration-200',
                        isExpanded && 'rotate-180'
                      )}
                    />
                  </button>

                  <div
                    className={cn(
                      'grid overflow-hidden transition-all duration-300 ease-in-out',
                      isExpanded
                        ? 'mt-0.5 grid-rows-[1fr] opacity-100'
                        : 'grid-rows-[0fr] opacity-0'
                    )}
                  >
                    <div className="ml-4 space-y-0.5 overflow-hidden border-l border-sidebar-border pl-2.5">
                      {item.children?.filter(canAccess).map((child) => {
                        const ChildIcon = child.icon

                        return (
                          <NavLink
                            key={child.title}
                            to={child.path!}
                            onClick={onClose}
                            className={({ isActive }) =>
                              cn(
                                'flex items-center gap-2 rounded-md px-2.5 py-1.5 text-xs font-medium tracking-wide transition-all duration-200',
                                isActive
                                  ? 'bg-sidebar-primary/20 text-sidebar-primary font-semibold'
                                  : 'text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
                              )
                            }
                          >
                            <ChildIcon className="size-3" />
                            <span>{child.title}</span>
                          </NavLink>
                        )
                      })}
                    </div>
                  </div>
                </div>
              )
            })}
          </nav>
        </div>

        {/* Footer / User Profile Card */}
        {/* 
        <div className="p-4 border-t border-sidebar-border/50 bg-stone-50/50 dark:bg-stone-950/20">
          <div className="flex items-center gap-3 rounded-2xl p-2.5 hover:bg-sidebar-accent/50 transition-colors">
            <div className="flex size-10 items-center justify-center rounded-xl bg-brand font-bold text-stone-950 shadow-inner">
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
