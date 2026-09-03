import * as React from "react"
import { CalendarIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import { fromISODate, toISODate, formatDisplayDate } from "@/lib/dateUtils"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"

interface DatePickerProps {
  /** ISO `yyyy-mm-dd`, or `''` when unset. */
  value: string
  onChange: (iso: string) => void
  /** Accessible name for the trigger — the field's own label, matching the
   *  rest of the form's "visible label IS the accessible name" convention
   *  (see StatusSelect.tsx). */
  label: string
  disabled?: boolean
  required?: boolean
}

// Field-level date input: a button trigger (styled like the app's other form
// fields) that opens react-day-picker's calendar grid in a Popover. Replaces
// the native `<input type="date">` fallback every `*FormFields.tsx` renderer
// used for `type: 'date'` fields — that native control renders inconsistently
// across browsers/OS locales and isn't a real click-to-pick affordance.
export function DatePicker({ value, onChange, label, disabled, required }: DatePickerProps) {
  const [open, setOpen] = React.useState(false)
  const selected = fromISODate(value) ?? undefined

  return (
    <Popover open={open} onOpenChange={(next) => !disabled && setOpen(next)}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={label}
          aria-required={required}
          disabled={disabled}
          className={cn(
            "flex h-8 w-full items-center gap-2 rounded-lg border border-stone-200 bg-white px-2.5 text-left text-sm text-stone-900 transition-colors outline-none",
            "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
            "disabled:cursor-not-allowed disabled:opacity-50",
            !value && "text-stone-400"
          )}
        >
          <CalendarIcon className="size-3.5 shrink-0 text-stone-400" aria-hidden="true" />
          <span className="flex-1 truncate">{value ? formatDisplayDate(value) : "Select date"}</span>
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-2">
        <Calendar
          mode="single"
          selected={selected}
          defaultMonth={selected}
          onSelect={(day) => {
            if (!day) return
            onChange(toISODate(day))
            setOpen(false)
          }}
        />
      </PopoverContent>
    </Popover>
  )
}
