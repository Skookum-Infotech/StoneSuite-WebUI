import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Slot } from "radix-ui"

import { cn } from "@/lib/utils"

/**
 * The approved StoneSuite button system (DESIGN.md "Buttons"): four kinds in
 * three sizes, all with 12.5px text except `lg`.
 * - default  (primary): lime fill, semibold — the main action on a screen
 * - outline / secondary: white with a gray border, medium
 * - destructive (danger): red fill, white semibold text — delete / reject
 * - ghost (text-only):   no border, medium — low-priority actions
 * Sizes: sm 26px (dialogs, table rows) · default 30px (everywhere else) ·
 * lg 38px / 14px (one-action screens: billing, onboarding). On touch screens
 * every button is at least 40px tall so it is easy to tap.
 */
const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center gap-1.5 rounded-lg border border-transparent bg-clip-padding text-button whitespace-nowrap transition-colors outline-none select-none focus-visible:ring-3 focus-visible:ring-ring/50 active:not-aria-[haspopup]:translate-y-px disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 pointer-coarse:min-h-10 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-3.5",
  {
    variants: {
      variant: {
        default: "bg-brand font-semibold text-ink-strong hover:bg-brand-hover aria-expanded:bg-brand-hover",
        outline:
          "border-input bg-white font-medium text-ink hover:bg-stone-100 aria-expanded:bg-stone-100",
        secondary:
          "border-input bg-white font-medium text-ink hover:bg-stone-100 aria-expanded:bg-stone-100",
        ghost: "font-medium text-ink hover:bg-stone-100 aria-expanded:bg-stone-100",
        destructive:
          "bg-danger-solid font-semibold text-white hover:bg-danger-solid-hover focus-visible:ring-destructive/20",
        link: "h-auto px-0 type-link",
      },
      size: {
        default: "h-7.5 px-3",
        xs: "h-6.5 gap-1 px-2 [&_svg:not([class*='size-'])]:size-3",
        sm: "h-6.5 gap-1 px-2 [&_svg:not([class*='size-'])]:size-3",
        lg: "h-9.5 rounded-[0.75rem] px-4 text-body [&_svg:not([class*='size-'])]:size-4",
        icon: "size-7.5",
        "icon-xs": "size-6 [&_svg:not([class*='size-'])]:size-3",
        "icon-sm": "size-6.5",
        "icon-lg": "size-9.5",
      },
    },
    compoundVariants: [
      { variant: ["outline", "secondary", "ghost"], size: "default", class: "px-2.5" },
    ],
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot.Root : "button"

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

// eslint-disable-next-line react-refresh/only-export-components -- buttonVariants must co-locate with Button (shadcn pattern)
export { Button, buttonVariants }
