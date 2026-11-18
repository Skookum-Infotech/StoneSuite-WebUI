import { Lock } from 'lucide-react'
import { Label } from '@/components/ui/label'

export function ReadOnlyField({
  label,
  value,
  icon: Icon,
}: {
  label: string
  value: string
  icon?: React.ElementType
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-semibold text-ink-muted">{label}</Label>
      <div className="flex h-11 items-center gap-3 rounded-xl border border-stone-200 bg-stone-50 px-3.5">
        {Icon && <Icon className="size-4 shrink-0 text-ink-faint" />}
        <span className="flex-1 text-xs text-ink select-all">{value || '—'}</span>
        <Lock className="size-3.5 shrink-0 text-ink-faint" />
      </div>
    </div>
  )
}
