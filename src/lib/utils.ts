import { clsx, type ClassValue } from "clsx"
import { extendTailwindMerge } from "tailwind-merge"

/**
 * Font sizes added to the Tailwind theme (index.css and styles/typography.css).
 * tailwind-merge only knows Tailwind's built-in sizes; without this list it
 * reads `text-button` or `text-label` as a text *color* and silently drops it
 * whenever a real color such as `text-ink` follows it in the same class list.
 */
export const CUSTOM_FONT_SIZES = [
  "2xs",
  "label",
  "portal",
  "nav-section",
  "micro",
  "caption",
  "button",
  "field",
  "input",
  "body",
  "dialog-title",
  "page-title",
  "display",
  "kpi",
] as const

const twMerge = extendTailwindMerge({
  extend: { theme: { text: [...CUSTOM_FONT_SIZES] } },
})

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
