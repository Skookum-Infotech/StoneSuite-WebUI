import * as React from 'react'
import { Eye, EyeOff, Lock } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

const DEFAULT_TOGGLE_LABEL = 'password'

type PasswordInputProps = Omit<React.ComponentProps<'input'>, 'type'> & {
  // Noun the show/hide button is named after ("Show <toggleLabel>"), so two
  // password fields on one page get distinct accessible names.
  toggleLabel?: string
  // Draws a lock glyph inside the left edge (the account / reset-password look).
  withLockIcon?: boolean
}

// A password <input> with a show/hide (eye) toggle. Every other prop — including
// the `ref` and handlers from react-hook-form's register() — lands on the input.
export function PasswordInput({
  className,
  toggleLabel = DEFAULT_TOGGLE_LABEL,
  withLockIcon = false,
  ...inputProps
}: PasswordInputProps) {
  const [visible, setVisible] = React.useState(false)
  const Icon = visible ? EyeOff : Eye

  return (
    <div className="relative">
      {withLockIcon && (
        <Lock
          aria-hidden="true"
          className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-stone-300"
        />
      )}
      <Input
        {...inputProps}
        type={visible ? 'text' : 'password'}
        className={cn(withLockIcon && 'pl-10', 'pr-11', className)}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={`${visible ? 'Hide' : 'Show'} ${toggleLabel}`}
        aria-controls={inputProps.id}
        className="absolute right-3.5 top-1/2 -translate-y-1/2 cursor-pointer rounded-sm text-stone-400 transition-colors hover:text-stone-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
      >
        <Icon aria-hidden="true" className="size-4" />
      </button>
    </div>
  )
}
