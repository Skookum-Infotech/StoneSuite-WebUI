// Shared class strings for the report builder's controls, so every picker looks
// the same without repeating the long Tailwind lists.

export const SELECT_CLASS =
  "h-8 w-full rounded-lg border border-stone-200 bg-white px-2.5 text-sm text-stone-900 disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-400";

export const SECTION_TITLE = "text-label font-semibold uppercase tracking-wide text-stone-500";

export const SMALL_BUTTON =
  "inline-flex h-8 items-center gap-1.5 rounded-lg border border-stone-200 bg-white px-3 text-xs font-medium text-stone-700 transition-colors hover:bg-stone-50 disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-400";

export const PRIMARY_BUTTON =
  "inline-flex h-8 items-center gap-1.5 rounded-lg bg-stone-900 px-3 text-xs font-medium text-white transition-colors hover:bg-stone-800 disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-400";

export const ICON_BUTTON =
  "inline-flex size-8 shrink-0 items-center justify-center rounded-lg text-stone-500 transition-colors hover:bg-stone-100 hover:text-stone-800 disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-400";
