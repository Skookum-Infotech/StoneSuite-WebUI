import { useEffect, useId, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

type Props = {
  title: string;
  subtitle: string;
  /** 'danger' for the irreversible delete, 'warning' for the reversible suspend. */
  tone: 'danger' | 'warning';
  onClose: () => void;
  children: ReactNode;
};

// Shared modal shell for the tenant lifecycle confirmations: backdrop click and
// Escape both close it, and it is labelled by its own title for screen readers.
export function TenantDialog({ title, subtitle, tone, onClose, children }: Props) {
  const titleId = useId();

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="mx-4 w-full max-w-md rounded-xl bg-white p-6 shadow-2xl">
        <div className="mb-4 flex items-center gap-3">
          <div
            className={cn(
              'flex size-9 shrink-0 items-center justify-center rounded-full',
              tone === 'danger' ? 'bg-destructive/10' : 'bg-amber-100',
            )}
          >
            <AlertTriangle
              className={cn('size-4', tone === 'danger' ? 'text-destructive' : 'text-amber-600')}
              aria-hidden="true"
            />
          </div>
          <div className="min-w-0">
            <h3 id={titleId} className="text-sm font-bold text-stone-900">
              {title}
            </h3>
            <p className="mt-0.5 text-xs text-stone-400">{subtitle}</p>
          </div>
        </div>
        {children}
      </div>
    </div>,
    document.body,
  );
}
