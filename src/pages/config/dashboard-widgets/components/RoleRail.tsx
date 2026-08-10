import { Lock } from 'lucide-react';
import { cn } from '@/lib/utils';

interface RailRole {
  id: string;
  name: string;
  locked: boolean;
}

function RoleRow({
  role,
  selected,
  onSelect,
  trailing,
  progress,
  children,
}: {
  role: RailRole;
  selected: boolean;
  onSelect: () => void;
  trailing: React.ReactNode;
  progress?: number;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-current={selected ? 'true' : undefined}
      aria-label={`View widgets for ${role.name}`}
      className={cn(
        'flex w-full flex-col gap-1 rounded-lg border px-2.5 py-2 text-left transition-colors',
        selected ? 'border-stone-300 bg-white shadow-sm' : 'border-transparent hover:bg-stone-100',
      )}
    >
      <span className="flex items-center justify-between gap-2">
        <span className="flex min-w-0 items-center gap-1.5 truncate text-xs font-medium text-stone-800">
          {children}
        </span>
        {trailing}
      </span>
      {progress !== undefined && (
        <span className="block h-1 w-full overflow-hidden rounded-full bg-stone-100">
          <span className="block h-1 rounded-full bg-brand-dark" style={{ width: `${progress}%` }} />
        </span>
      )}
    </button>
  );
}

export function RoleRail({
  roles,
  selectedRoleId,
  onSelectRole,
  counts,
  totalCount,
  dirtyRoleIds,
}: {
  roles: RailRole[];
  selectedRoleId: string;
  onSelectRole: (roleId: string) => void;
  counts: Record<string, number>;
  totalCount: number;
  dirtyRoleIds: string[];
}) {
  const editableRoles = roles.filter((r) => !r.locked);
  const lockedRoles = roles.filter((r) => r.locked);

  return (
    <nav aria-label="Roles" className="space-y-3">
      <div className="space-y-1">
        {editableRoles.map((role) => {
          const count = counts[role.id] ?? 0;
          const dirty = dirtyRoleIds.includes(role.id);
          return (
            <RoleRow
              key={role.id}
              role={role}
              selected={role.id === selectedRoleId}
              onSelect={() => onSelectRole(role.id)}
              progress={totalCount > 0 ? (count / totalCount) * 100 : 0}
              trailing={
                <span className={cn('text-2xs shrink-0', count === 0 ? 'text-red-500' : 'text-stone-400')}>
                  {count}/{totalCount}
                </span>
              }
            >
              <span className="truncate">{role.name}</span>
              {dirty && (
                <span
                  className="size-1.5 shrink-0 rounded-full bg-brand-dark"
                  title="Unsaved changes"
                  aria-label="Unsaved changes"
                />
              )}
            </RoleRow>
          );
        })}
      </div>

      {lockedRoles.length > 0 && (
        <div className="space-y-1 border-t border-stone-100 pt-2">
          {lockedRoles.map((role) => (
            <RoleRow
              key={role.id}
              role={role}
              selected={role.id === selectedRoleId}
              onSelect={() => onSelectRole(role.id)}
              trailing={<span className="text-2xs shrink-0 text-stone-400">All</span>}
            >
              <Lock className="size-3 shrink-0 text-stone-400" aria-hidden="true" />
              <span className="truncate text-stone-500">{role.name}</span>
            </RoleRow>
          ))}
        </div>
      )}
    </nav>
  );
}
