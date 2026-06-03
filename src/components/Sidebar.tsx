import { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  ChevronDown,
  X,
  LayoutDashboard,
  Workflow as WorkflowIcon,
  SlidersHorizontal,
  ShieldCheck,
  UserPlus,
  Loader2,
  Boxes,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { workflowService } from '@/services/tenantServices';
import { useAuthStore } from '@/store/useAuthStore';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

const linkClass = ({ isActive }: { isActive: boolean }) =>
  cn(
    'flex items-center gap-2.5 rounded-md px-3 py-2 text-xs font-semibold tracking-wide transition-all duration-200',
    isActive
      ? 'bg-brand text-stone-950 shadow-[0_4px_12px_rgba(194,245,137,0.25)] font-bold'
      : 'text-stone-600 dark:text-stone-300 hover:bg-sidebar-accent hover:text-stone-900 dark:hover:text-white',
  );

const childLinkClass = ({ isActive }: { isActive: boolean }) =>
  cn(
    'flex items-center gap-2 rounded-md px-2.5 py-1.5 text-xs font-medium tracking-wide transition-all duration-200',
    isActive
      ? 'bg-sidebar-primary/20 text-sidebar-primary font-semibold'
      : 'text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
  );

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="px-3 pb-1 pt-4 text-[10px] font-bold uppercase tracking-widest text-stone-400 dark:text-stone-500">
      {children}
    </p>
  );
}

export default function Sidebar({ isOpen, onClose }: SidebarProps) {
  const location = useLocation();
  const user = useAuthStore((s) => s.user);
  const [configOpen, setConfigOpen] = useState(true);

  // Dynamic: the workspace nav is driven by the tenant's enabled workflows.
  const { data: workflows = [], isLoading } = useQuery({
    queryKey: ['workflows'],
    queryFn: workflowService.list,
  });
  const enabled = workflows.filter((w) => w.enabled);

  const configActive = location.pathname.startsWith('/config');

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
          'fixed bottom-0 top-0 left-0 z-50 flex w-56 flex-col justify-between border-r border-sidebar-border bg-background text-sidebar-foreground transition-transform duration-300 ease-in-out lg:translate-x-0',
          isOpen ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <div className="flex h-full flex-col overflow-y-auto">
          {/* Header / Brand Logo */}
          <div className="relative flex h-12 shrink-0 items-center justify-between border-b border-border bg-stone-350 px-4">
            <NavLink to="/dashboard" className="group flex min-w-0 items-center gap-2">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden">
                <img src="/logo-only.png" alt="Stone Suite" className="h-6 w-6 object-contain" />
              </div>
              <span className="font-heading text-sm font-bold uppercase tracking-wider text-dark transition-colors group-hover:text-stone-700 dark:text-white dark:group-hover:text-stone-200">
                Stone Suite
              </span>
            </NavLink>
            <button
              onClick={onClose}
              aria-label="Close menu"
              className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-1 text-stone-500 hover:bg-sidebar-accent hover:text-stone-900 dark:text-stone-400 dark:hover:text-stone-100 lg:hidden"
            >
              <X className="size-4" />
            </button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 space-y-0.5 px-2.5 py-2">
            <NavLink to="/dashboard" onClick={onClose} className={linkClass}>
              <LayoutDashboard className="size-3.5" />
              <span>Dashboard</span>
            </NavLink>

            {/* Workspace — dynamic list of enabled workflows */}
            <SectionLabel>Workspace</SectionLabel>
            {isLoading && (
              <div className="flex items-center gap-2 px-3 py-2 text-xs text-stone-400">
                <Loader2 className="size-3.5 animate-spin" /> Loading…
              </div>
            )}
            {!isLoading && enabled.length === 0 && (
              <p className="px-3 py-1.5 text-[11px] text-stone-400">No workflows enabled yet.</p>
            )}
            {enabled.map((wf) => (
              <NavLink key={wf.id} to={`/workflows/${wf.id}`} onClick={onClose} className={linkClass}>
                <Boxes className="size-3.5" />
                <span className="truncate">{wf.name}</span>
              </NavLink>
            ))}

            {/* Configuration — build/configure the platform */}
            <SectionLabel>Configure</SectionLabel>
            <div className="space-y-0.5">
              <button
                type="button"
                onClick={() => setConfigOpen((v) => !v)}
                className={cn(
                  'flex w-full cursor-pointer items-center justify-between rounded-md px-3 py-2 text-xs font-semibold tracking-wide transition-all duration-200',
                  configActive
                    ? 'bg-sidebar-accent/50 text-stone-900 dark:text-white'
                    : 'text-stone-600 hover:bg-sidebar-accent hover:text-stone-900 dark:text-stone-300 dark:hover:text-white',
                )}
              >
                <div className="flex items-center gap-2.5">
                  <SlidersHorizontal className="size-3.5" />
                  <span>Configuration</span>
                </div>
                <ChevronDown className={cn('size-3 transition-transform duration-200', configOpen && 'rotate-180')} />
              </button>

              <div
                className={cn(
                  'grid overflow-hidden transition-all duration-300 ease-in-out',
                  configOpen ? 'mt-0.5 grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0',
                )}
              >
                <div className="ml-4 space-y-0.5 overflow-hidden border-l border-sidebar-border pl-2.5">
                  <NavLink to="/config/workflows" onClick={onClose} className={childLinkClass}>
                    <WorkflowIcon className="size-3" />
                    <span>Workflows</span>
                  </NavLink>
                  <NavLink to="/config/roles" onClick={onClose} className={childLinkClass}>
                    <ShieldCheck className="size-3" />
                    <span>Roles &amp; Access</span>
                  </NavLink>
                </div>
              </div>
            </div>

            {/* Platform — owner only */}
            {user?.isPlatformAdmin && (
              <>
                <SectionLabel>Platform</SectionLabel>
                <NavLink to="/customer/onboarding" onClick={onClose} className={linkClass}>
                  <UserPlus className="size-3.5" />
                  <span>Customer Onboarding</span>
                </NavLink>
              </>
            )}
          </nav>
        </div>
      </aside>
    </>
  );
}
