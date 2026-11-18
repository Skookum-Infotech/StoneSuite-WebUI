import type { ReactNode } from 'react';

export function DxfMessage({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-lg border border-dashed border-stone-200 px-4 py-10 text-center text-xs text-ink-muted">
      {children}
    </div>
  );
}
