import { useId, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { ShieldCheck } from 'lucide-react'
import { useModalDialog } from '@/hooks/useModalDialog'

interface TwoStepDialogShellProps {
  title: string
  description: string
  // A request is in flight: the dialog can't be dismissed under it.
  busy: boolean
  onClose: () => void
  children: ReactNode
}

// The overlay + card the two-step verification dialogs share. Mount it
// conditionally (fresh on every open): useModalDialog moves focus in once per
// mount, so an always-mounted dialog would not refocus on a second open.
export function TwoStepDialogShell({ title, description, busy, onClose, children }: TwoStepDialogShellProps) {
  const titleId = useId()
  const closeIfIdle = () => {
    if (!busy) onClose()
  }
  const contentRef = useModalDialog(closeIfIdle)

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      onClick={(e) => e.target === e.currentTarget && closeIfIdle()}
    >
      <div ref={contentRef} tabIndex={-1} className="mx-4 w-full max-w-sm rounded-xl bg-white p-6 shadow-2xl outline-none">
        <div className="mb-5 flex items-center gap-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-brand/20 text-brand-dark">
            <ShieldCheck className="size-4" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <h3 id={titleId} className="text-sm font-bold text-stone-900">{title}</h3>
            <p className="mt-0.5 text-xs text-stone-500">{description}</p>
          </div>
        </div>
        {children}
      </div>
    </div>,
    document.body,
  )
}
