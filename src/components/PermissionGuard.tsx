import type { ReactNode } from 'react';
import { ShieldOff } from 'lucide-react';
import { useUserPermissions } from '@/hooks/useUserPermissions';
import { useAuthStore } from '@/store/useAuthStore';
import { Spinner } from '@/components/tenant/ui';

interface Props {
  children: ReactNode;
  /** Regular RBAC permission check — provide both resource and action. */
  resource?: string;
  action?: string;
  /** Set true for routes that are only accessible to platform admins. */
  platformAdminOnly?: boolean;
}

function AccessDenied() {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <ShieldOff className="mb-3 size-10 text-stone-300" aria-hidden="true" />
      <p className="text-sm font-semibold text-stone-600 dark:text-stone-300">Access Denied</p>
      <p className="mt-1 text-xs text-stone-400">
        You don&apos;t have permission to view this page.
      </p>
    </div>
  );
}

export function PermissionGuard({ children, resource, action, platformAdminOnly }: Props) {
  const { hasPermission, isLoading } = useUserPermissions();
  const user = useAuthStore((s) => s.user);

  if (isLoading) return <Spinner />;

  if (platformAdminOnly) {
    return user?.isPlatformAdmin ? <>{children}</> : <AccessDenied />;
  }

  if (resource && action) {
    return hasPermission(resource, action) ? <>{children}</> : <AccessDenied />;
  }

  return <>{children}</>;
}
