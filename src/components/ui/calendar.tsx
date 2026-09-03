import { ChevronLeft, ChevronRight } from "lucide-react"
import { DayPicker, type DayPickerProps } from "react-day-picker"

import { cn } from "@/lib/utils"

// Thin shadcn-style wrapper around react-day-picker, styled to match the
// app's stone/brand palette (same tokens StatusSelect.tsx uses) instead of
// react-day-picker's own default look.
function Calendar({ className, classNames, ...props }: DayPickerProps) {
  return (
    <DayPicker
      showOutsideDays
      className={cn("p-1", className)}
      classNames={{
        months: "flex flex-col gap-2",
        month: "space-y-2",
        month_caption: "flex items-center justify-center pt-1 pb-1 relative",
        caption_label: "text-sm font-semibold text-stone-900",
        nav: "flex items-center justify-between absolute inset-x-0 top-0.5",
        button_previous: cn(
          "inline-flex size-7 items-center justify-center rounded-md text-stone-500 transition hover:bg-stone-100 hover:text-stone-900 disabled:opacity-30 disabled:pointer-events-none"
        ),
        button_next: cn(
          "inline-flex size-7 items-center justify-center rounded-md text-stone-500 transition hover:bg-stone-100 hover:text-stone-900 disabled:opacity-30 disabled:pointer-events-none"
        ),
        month_grid: "w-full border-collapse",
        weekdays: "flex",
        weekday: "w-8 text-2xs font-medium text-stone-400",
        week: "flex w-full mt-1",
        day: "size-8 p-0 text-center text-sm",
        day_button: cn(
          "size-8 rounded-md font-normal text-stone-700 transition hover:bg-stone-100",
          "aria-selected:bg-brand aria-selected:font-semibold aria-selected:text-stone-950 aria-selected:hover:bg-brand-hover"
        ),
        today: "font-semibold text-brand-hover",
        outside: "text-stone-300",
        disabled: "text-stone-300 opacity-50",
        hidden: "invisible",
        ...classNames,
      }}
      components={{
        Chevron: ({ orientation, ...chevronProps }) =>
          orientation === "left" ? (
            <ChevronLeft className="size-4" {...chevronProps} />
          ) : (
            <ChevronRight className="size-4" {...chevronProps} />
          ),
      }}
      {...props}
    />
  )
}

export { Calendar }
