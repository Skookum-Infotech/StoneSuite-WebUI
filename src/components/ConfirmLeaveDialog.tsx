import * as React from 'react';
import { createPortal } from 'react-dom';
import { LogOut, TriangleAlert } from 'lucide-react';
import { useModalDialog } from '@/hooks/useModalDialog';

export type ConfirmLeaveVariant = 'unsaved-changes' | 'exit-app';

// Copy lives here rather than in props so both call sites stay consistent and the
// component keeps a small surface (CLAUDE.md caps components at five props).
const COPY = {
  'unsaved-changes': {
    title: 'Discard unsaved changes?',
    description:
      "This record has edits that haven't been saved yet. Leaving this page discards them.",
    confirmLabel: 'Discard changes',
    cancelLabel: 'Keep editing',
  },
  'exit-app': {
    title: 'Leave Stone Suite?',
    description:
      'Going back from here exits the app. Sign out to end your session on this device, or stay where you are.',
    confirmLabel: 'Sign out',
    cancelLabel: 'Stay',
  },
} as const;

const ICON = {
  'unsaved-changes': TriangleAlert,
  'exit-app': LogOut,
} as const;

interface ConfirmLeaveDialogProps {
  variant: ConfirmLeaveVariant;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmLeaveDialog({
  variant,
  onConfirm,
  onCancel,
}: ConfirmLeaveDialogProps): React.JSX.Element {
  const contentRef = useModalDialog(onCancel);
  const copy = COPY[variant];
  const Icon = ICON[variant];

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-leave-title"
      aria-describedby="confirm-leave-desc"
    >
      <div ref={contentRef} tabIndex={-1} className="mx-4 w-full max-w-sm rounded-xl bg-white p-6 shadow-2xl">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex size-9 flex-shrink-0 items-center justify-center rounded-full bg-warning/10">
            <Icon className="size-4 text-warning" aria-hidden="true" />
          </div>
          <h3 id="confirm-leave-title" className="text-sm font-bold text-stone-900">
            {copy.title}
          </h3>
        </div>

        <p id="confirm-leave-desc" className="mb-5 text-xs text-stone-600">
          {copy.description}
        </p>

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            aria-label={copy.cancelLabel}
            className="rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-xs font-medium text-stone-600 transition-colors hover:bg-stone-50"
          >
            {copy.cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            aria-label={copy.confirmLabel}
            className="rounded-lg bg-destructive px-3 py-1.5 text-xs font-semibold text-white transition-all hover:bg-destructive/90 active:scale-95"
          >
            {copy.confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
