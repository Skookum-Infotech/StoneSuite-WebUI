import { passwordStrength } from '@/lib/passwordPolicy'
import { cn } from '@/lib/utils'

interface PasswordStrengthMeterProps {
  password: string
}

const METER_LEVELS = [1, 2, 3, 4] as const
// Indexed by strength level (0 = nothing typed).
const BAR_COLORS = ['', 'bg-red-400', 'bg-amber-400', 'bg-blue-400', 'bg-emerald-500'] as const
const TEXT_COLORS = ['', 'text-red-500', 'text-amber-500', 'text-blue-500', 'text-emerald-600'] as const

export function PasswordStrengthMeter({ password }: PasswordStrengthMeterProps) {
  const { level, label } = passwordStrength(password)
  if (level === 0) return null

  return (
    <div className="space-y-1.5 pt-1.5">
      <div className="flex gap-1" aria-hidden="true">
        {METER_LEVELS.map((bar) => (
          <div
            key={bar}
            className={cn('h-1 flex-1 rounded-full transition-all duration-300', level >= bar ? BAR_COLORS[level] : 'bg-stone-200')}
          />
        ))}
      </div>
      <p className="text-xs text-stone-400">
        Strength: <span className={cn('font-semibold', TEXT_COLORS[level])}>{label}</span>
      </p>
    </div>
  )
}
