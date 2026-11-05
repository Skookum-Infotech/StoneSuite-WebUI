import { cn } from '@/lib/utils';
import type { ApprovalInboxScope } from '@/types/approvalInbox';

const OPTIONS: { value: ApprovalInboxScope; label: string }[] = [
  { value: 'mine', label: 'Assigned to me' },
  { value: 'all', label: 'All pending' },
];

/** Super-admin-only segmented control; the page never renders it for anyone else. */
export function ApprovalScopeToggle({ scope, onChange }: {
  scope: ApprovalInboxScope;
  onChange: (scope: ApprovalInboxScope) => void;
}) {
  return (
    <div role="group" aria-label="Approval scope" className="inline-flex rounded-lg border border-stone-200 bg-white p-0.5">
      {OPTIONS.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={scope === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            'h-7 rounded-md px-3 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-400',
            scope === o.value ? 'bg-stone-900 text-white' : 'text-stone-600 hover:bg-stone-50',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
