import type { ReactNode } from 'react';
import { ShieldOff } from 'lucide-react';
import { useAuthStore } from '@/store/useAuthStore';

interface PortalOnlyGuardProps {
  children: ReactNode;
}

// Route guard for a page that exists only in the customer portal and has no
// staff-side module, so there is no RBAC resource to check — the session kind
// is the whole rule. The sidebar already hides the link from staff; this stops
// a staff member who types the URL from reaching a page whose API they cannot
// call.
export function PortalOnlyGuard({ children }: PortalOnlyGuardProps) {
  const isPortal = useAuthStore((s) => s.kind === 'portal');

  if (!isPortal) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <ShieldOff className="mb-3 size-10 text-stone-400" aria-hidden="true" />
        <p className="text-sm font-semibold text-stone-600">Customer portal only</p>
        <p className="mt-1 text-xs text-stone-500">This page is only available to customer portal users.</p>
      </div>
    );
  }
  return <>{children}</>;
}
