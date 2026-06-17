export const fieldCls =
  'w-full bg-gray-100 rounded-sm px-3.5 py-2.5 text-sm text-stone-800 outline-none border-2 border-transparent placeholder:text-stone-400 focus:bg-white focus:border-brand/50 transition-all duration-150 disabled:opacity-60 disabled:cursor-not-allowed hover:bg-stone-100/70';

export const readonlyCls =
  'w-full bg-gray-100 rounded-sm px-3.5 py-2.5 text-sm text-stone-800 border-2 border-transparent min-h-[2.25rem]';

/** Standard label above every form field. */
export const fieldLabelCls = 'block text-xs font-medium text-stone-500 leading-none';

/** Standard label for checkboxes / toggles (inline, next to the control). */
export const checkboxLabelCls = 'text-sm font-medium text-stone-700 leading-none';

/** Generates a stable DOM id for a form section title — used by section jump nav. */
export function sectionId(title: string): string {
  return `form-section-${title.toLowerCase().replace(/[\s/]+/g, '-').replace(/[^a-z0-9-]/g, '')}`;
}
