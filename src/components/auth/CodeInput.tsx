import * as React from 'react'
import { Input } from '@/components/ui/input'
import { MFA_CODE_LENGTH, digitsOnly } from '@/lib/mfa'
import { cn } from '@/lib/utils'

type CodeInputProps = Omit<React.ComponentProps<'input'>, 'type' | 'value' | 'onChange' | 'maxLength'> & {
  value: string
  onValueChange: (value: string) => void
  length?: number
}

// The box an emailed one-time code goes in. Only digits get through (a pasted
// "123 456" lands as 123456), the phone's number pad opens, and the browser or
// phone can offer to fill the code straight from the email.
export function CodeInput({
  value,
  onValueChange,
  length = MFA_CODE_LENGTH,
  className,
  ...inputProps
}: CodeInputProps) {
  return (
    <Input
      {...inputProps}
      type="text"
      inputMode="numeric"
      pattern="[0-9]*"
      autoComplete="one-time-code"
      maxLength={length}
      value={value}
      onChange={(e) => onValueChange(digitsOnly(e.target.value, length))}
      className={cn(
        'h-14 rounded-xl border-stone-200 bg-white pl-[0.4em] text-center font-mono text-2xl font-semibold tracking-[0.4em] text-stone-950 placeholder:text-stone-500',
        className,
      )}
    />
  )
}
