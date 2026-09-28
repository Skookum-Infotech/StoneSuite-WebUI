import { Check, Circle } from 'lucide-react'
import { evaluatePasswordRules } from '@/lib/passwordPolicy'
import { cn } from '@/lib/utils'

interface PasswordRequirementsProps {
  password: string
}

// Live checklist of the password policy: each rule turns green as the typed
// password satisfies it, so the user sees what is still missing before submit.
export function PasswordRequirements({ password }: PasswordRequirementsProps) {
  return (
    <ul
      aria-label="Password requirements"
      className="grid gap-2 rounded-xl border border-stone-200 bg-stone-50 px-4 py-3.5 sm:grid-cols-2"
    >
      {evaluatePasswordRules(password).map(({ rule, met }) => (
        <li key={rule.id} className="flex items-center gap-2">
          {met ? (
            <Check aria-hidden="true" className="size-3.5 shrink-0 text-emerald-600" />
          ) : (
            <Circle aria-hidden="true" className="size-2 shrink-0 fill-stone-300 text-stone-300" />
          )}
          <span className={cn('text-xs', met ? 'font-medium text-emerald-700' : 'text-stone-500')}>
            {rule.label}
          </span>
          <span className="sr-only">{met ? ' (met)' : ' (not met)'}</span>
        </li>
      ))}
    </ul>
  )
}
