import { createPortal } from 'react-dom'
import { cn } from '@/lib/utils'
import { useModalDialog } from '@/hooks/useModalDialog'

interface SubscriptionDialogHeader {
  title: string
  description?: string
  icon: React.ElementType
  tone?: 'brand' | 'destructive'
}

// Shared overlay/portal/focus-trap shell for the Subscription page's dialogs
// (Upgrade, Cancel, Contact Sales, Add Payment Method, Remove Card, Edit
// Billing Details) — same createPortal + useModalDialog pattern as
// DeleteRefundDialog/ApplyRefundDialog, factored out since five dialogs would
// otherwise repeat the identical overlay/focus-trap markup.
export function SubscriptionDialogShell({
  header,
  onClose,
  widthClassName = 'max-w-sm',
  children,
}: {
  header: SubscriptionDialogHeader
  onClose: () => void
  widthClassName?: string
  children: React.ReactNode
}) {
  const contentRef = useModalDialog(onClose)
  const { title, description, icon: Icon, tone = 'brand' } = header
  const titleId = `subscription-dialog-title-${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-[2px] p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div ref={contentRef} tabIndex={-1} className={cn('w-full rounded-2xl bg-white p-6 shadow-2xl', widthClassName)}>
        <div className="mb-4 flex items-start gap-3">
          <div
            className={cn(
              'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl',
              tone === 'destructive' ? 'bg-red-50 text-red-600' : 'bg-brand/20 text-brand-dark',
            )}
          >
            <Icon className="size-4.5" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <h3 id={titleId} className="text-sm font-bold text-stone-900">{title}</h3>
            {description && <p className="text-xs text-stone-500 mt-0.5">{description}</p>}
          </div>
        </div>
        {children}
      </div>
    </div>,
    document.body,
  )
}
