import type { ReactNode } from 'react';
import { Ban, ShieldOff } from 'lucide-react';
import { useUserPermissions } from '@/hooks/useUserPermissions';
import { useWorkflows } from '@/hooks/useWorkflows';
import { useAuthStore } from '@/store/useAuthStore';
import { Spinner } from '@/components/tenant/ui';

interface Props {
  children: ReactNode;
  /** Regular RBAC permission check — provide both resource and action. */
  resource?: string;
  action?: string;
  /** Set true for routes that are only accessible to platform admins. */
  platformAdminOnly?: boolean;
  /** Workflow key (Configuration > Workflows) backing this route's form,
   *  e.g. "lead". When set, the route is blocked for every user — independent
   *  of permission — while that workflow is disabled. */
  workflowKey?: string;
}

function AccessDenied() {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <ShieldOff className="mb-3 size-10 text-stone-400" aria-hidden="true" />
      <p className="text-sm font-semibold text-stone-600 dark:text-stone-300">Access Denied</p>
      <p className="mt-1 text-xs text-stone-500">
        You don&apos;t have permission to view this page.
      </p>
    </div>
  );
}

function FormDisabled() {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <Ban className="mb-3 size-10 text-stone-400" aria-hidden="true" />
      <p className="text-sm font-semibold text-stone-600 dark:text-stone-300">Form Disabled</p>
      <p className="mt-1 text-xs text-stone-500">
        This form has been disabled by your administrator.
      </p>
    </div>
  );
}

function PermissionsUnavailable({ onRetry }: { onRetry: () => void }) {
  return (
    <div role="alert" className="flex flex-col items-center justify-center py-24 text-center">
      <ShieldOff className="mb-3 size-10 text-stone-400" aria-hidden="true" />
      <p className="text-sm font-semibold text-stone-600 dark:text-stone-300">Couldn&apos;t load your permissions</p>
      <p className="mt-1 text-xs text-stone-500">Check your connection and try again.</p>
      <button
        type="button"
        onClick={onRetry}
        aria-label="Retry loading permissions"
        className="mt-3 rounded-lg border border-stone-300 px-3 py-1.5 text-xs font-semibold text-stone-700 hover:bg-stone-100"
      >
        Try again
      </button>
    </div>
  );
}

export function PermissionGuard({ children, resource, action, platformAdminOnly, workflowKey }: Props) {
  const { hasPermission, isLoading: permissionsLoading, isError: permissionsFailed, refetch } = useUserPermissions();
  const { isWorkflowEnabled, isLoading: workflowsLoading } = useWorkflows();
  const user = useAuthStore((s) => s.user);

  if (permissionsLoading || (workflowKey && workflowsLoading)) return <Spinner />;

  // Checked before permission: a disabled workflow blocks every user, so it
  // should read as "Form Disabled", not a misleading "Access Denied".
  if (workflowKey && !isWorkflowEnabled(workflowKey)) return <FormDisabled />;

  if (platformAdminOnly) {
    return user?.isPlatformAdmin ? <>{children}</> : <AccessDenied />;
  }

  // A half-specified check (resource without action or vice versa) is a
  // mistake in the route table — deny rather than silently allow everyone.
  if (resource || action) {
    if (!resource || !action) return <AccessDenied />;
    if (permissionsFailed) return <PermissionsUnavailable onRetry={() => void refetch?.()} />;
    return hasPermission(resource, action) ? <>{children}</> : <AccessDenied />;
  }

  return <>{children}</>;
}
