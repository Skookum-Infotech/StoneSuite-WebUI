import { useEffect, useRef, useState } from 'react';
import { ChevronDown, Building2, Check, Loader2 } from 'lucide-react';
import { useMutation } from '@tanstack/react-query';
import { authService } from '@/services/authService';
import { apiErrorMessage } from '@/api/tenantClient';
import { useAuthStore } from '@/store/useAuthStore';

// Lets a customer-portal identity linked to several tenants (identity_tenants)
// switch which workspace's documents the shared List/Detail pages show.
// Staff never renders this — a staff identity belongs to exactly one
// workspace, so MainLayout only mounts it for a portal session with more
// than one linked workspace.
export function PortalWorkspaceSwitcher() {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const workspaces = useAuthStore((s) => s.workspaces);
  const applyWorkspaceSwitch = useAuthStore((s) => s.applyWorkspaceSwitch);

  useEffect(() => {
    if (!open) return;
    const handleClose = (e: MouseEvent): void => {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener('click', handleClose);
    return () => window.removeEventListener('click', handleClose);
  }, [open]);

  // switchWorkspace mints a token scoped to the new tenant — any cached
  // sales-order/invoice/etc. data from the previous workspace is invalid,
  // which is exactly what applyWorkspaceSwitch clears (see useAuthStore).
  const switchMutation = useMutation({
    mutationFn: (tenantId: string) => authService.switchWorkspace(tenantId),
    onSuccess: (data) => {
      applyWorkspaceSwitch(data.tenantId, data.token, data.expiresAt);
      setOpen(false);
    },
  });

  const active = workspaces.find((w) => w.active) ?? workspaces[0];
  if (!active) return null;

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        aria-label="Switch workspace"
        aria-expanded={open}
        aria-haspopup="listbox"
        className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.06] px-3 py-1.5 text-left hover:bg-white/10 transition-all cursor-pointer select-none"
      >
        <Building2 className="size-3.5 text-stone-400 shrink-0" aria-hidden="true" />
        <span className="hidden max-w-[140px] truncate text-xs font-bold text-stone-200 sm:block">
          {active.name}
        </span>
        <ChevronDown className="size-3.5 shrink-0 text-stone-400" aria-hidden="true" />
      </button>

      {open && (
        <div
          role="listbox"
          aria-label="Workspaces"
          className="absolute right-0 z-50 mt-2.5 w-64 origin-top-right rounded-2xl border border-white/10 bg-[#1c1c1c] p-2 shadow-2xl ring-1 ring-white/[0.04] animate-in fade-in slide-in-from-top-1 duration-150"
        >
          <div className="px-3.5 py-2 text-2xs font-bold uppercase tracking-wide text-stone-500">
            Workspaces
          </div>
          <div className="space-y-0.5">
            {workspaces.map((w) => {
              const isActive = w.tenantId === active.tenantId;
              const isSwitching = switchMutation.isPending && switchMutation.variables === w.tenantId;
              return (
                <button
                  key={w.tenantId}
                  type="button"
                  role="option"
                  aria-selected={isActive}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (!isActive) switchMutation.mutate(w.tenantId);
                  }}
                  disabled={switchMutation.isPending || isActive}
                  className="flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-3 py-2 text-left text-xs font-semibold text-stone-400 transition-colors hover:bg-white/[0.06] hover:text-stone-200 disabled:cursor-not-allowed disabled:hover:bg-transparent"
                >
                  {isSwitching ? (
                    <Loader2 className="size-4 shrink-0 animate-spin text-stone-500" aria-hidden="true" />
                  ) : (
                    <Building2 className="size-4 shrink-0 text-stone-500" aria-hidden="true" />
                  )}
                  <span className="flex-1 truncate">{w.name}</span>
                  {isActive && <Check className="size-4 shrink-0 text-brand" aria-hidden="true" />}
                </button>
              );
            })}
          </div>
          {switchMutation.isError && (
            <p role="alert" className="px-3 pt-1 text-2xs text-destructive">
              {apiErrorMessage(switchMutation.error, 'Failed to switch workspace. Try again.')}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
