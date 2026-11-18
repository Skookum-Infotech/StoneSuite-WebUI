import { forwardRef, type ComponentType, type ReactNode } from 'react';
import { AlertTriangle, Trash2 } from 'lucide-react';

import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';
export function DangerZoneCard({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-xl border border-destructive/20 bg-destructive/5 shadow-sm p-4 space-y-3 mb-4 dark:border-destructive/30 dark:bg-destructive/10">
      <div className="flex items-center gap-2">
        <AlertTriangle className="size-4 text-danger-ink shrink-0" aria-hidden="true" />
        <p className="text-xs font-bold text-danger-ink">Danger Zone</p>
      </div>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

type DangerZoneActionProps = {
  description: string;
  buttonLabel: string;
  onClick: () => void;
  icon?: ComponentType<{ className?: string }>;
  ariaLabel?: string;
  /** Renders the button inert — pair with `hint` so the reason is visible. */
  disabled?: boolean;
  /** Why the action is unavailable right now, shown under the button. */
  hint?: string;
};

export const DangerZoneAction = forwardRef<HTMLButtonElement, DangerZoneActionProps>(
  function DangerZoneAction({ description, buttonLabel, onClick, icon: Icon = Trash2, ariaLabel, disabled, hint }, ref) {
    return (
      <div className="space-y-2 border-t border-destructive/10 pt-3 first:border-t-0 first:pt-0">
        <div className="space-y-0.5">
          <p className="text-xs text-ink dark:text-stone-300">{description}</p>
          <p className="text-micro text-danger-ink/80">This action cannot be undone.</p>
        </div>
        <button
          ref={ref}
          type="button"
          onClick={onClick}
          disabled={disabled}
          aria-label={ariaLabel ?? buttonLabel}
          className={cn(buttonVariants({ variant: 'destructive' }), 'flex w-full gap-2 active:scale-95 disabled:active:scale-100')}
        >
          <Icon className="size-4 shrink-0" />
          {buttonLabel}
        </button>
        {hint && <p className="dark:text-stone-400 type-helper">{hint}</p>}
      </div>
    );
  },
);
