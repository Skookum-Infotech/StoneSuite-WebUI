import type { ElementType, ReactNode } from 'react'
import { SegmentedProgressBar } from '@/components/tenant/SegmentedProgressBar'

export interface UsageMeterHeading {
  title: string
  icon: ElementType
  /** The headline figure, already formatted (e.g. "3.4 GB"). */
  value: string
  /** One muted line under the figure (file count, input/output split). */
  detail: string
}

/** Present only when the plan has a limit for this metric. */
export interface UsageMeterLimit {
  percent: number
  /** The limit, formatted (e.g. "50 GB"). */
  label: string
}

interface UsageMeterProps {
  heading: UsageMeterHeading
  limit: UsageMeterLimit | null
  children?: ReactNode
}

/** One usage metric card: a figure, then a progress bar against the plan's
 *  limit or a "no limit" note, then optional footer content. */
export function UsageMeter({ heading, limit, children }: UsageMeterProps) {
  const Icon = heading.icon
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-stone-200 bg-stone-50/60 p-4">
      <div className="flex items-center gap-2">
        <Icon className="size-4 text-stone-500" aria-hidden="true" />
        <h3 className="text-xs font-semibold text-stone-700">{heading.title}</h3>
      </div>
      <div>
        <p className="text-2xl font-bold tracking-tight text-stone-900 tabular-nums">
          {heading.value}
          {limit && <span className="ml-1.5 text-sm font-medium text-stone-500">of {limit.label}</span>}
        </p>
        <p className="mt-0.5 text-xs text-stone-500">{heading.detail}</p>
      </div>
      {limit ? (
        <SegmentedProgressBar
          percent={limit.percent}
          ariaLabel={`${heading.title} used`}
          valueLabel={`${limit.percent}%`}
          block
        />
      ) : (
        <p className="text-xs font-medium text-stone-500">No limit on your current plan</p>
      )}
      {children && <div className="border-t border-stone-200 pt-3 text-xs text-stone-500">{children}</div>}
    </div>
  )
}
