export const fieldCls =
  'w-full h-10 px-3.5 py-2.5 text-sm text-stone-800 bg-white border border-gray-300 rounded-sm outline-none transition-all duration-150 placeholder:text-stone-400 focus:border-brand focus:ring-2 focus:ring-brand/30 disabled:bg-stone-50 disabled:text-stone-400 disabled:cursor-not-allowed';

export const textareaCls =
  'w-full px-3.5 py-2.5 text-sm text-stone-800 bg-white border border-stone-200 rounded-md outline-none transition-all duration-150 placeholder:text-stone-400 focus:border-brand focus:ring-2 focus:ring-brand/30 disabled:bg-stone-50 disabled:text-stone-400 disabled:cursor-not-allowed resize-none';

export const readonlyCls =
  'w-full min-h-10 px-3.5 py-2.5 text-sm text-stone-800 bg-stone-50 border border-stone-200 rounded-md';

export const fieldLabelCls =
  'block text-xs font-semibold uppercase tracking-wide text-stone-500';

export const checkboxLabelCls =
  'text-sm font-medium text-stone-700';

/** Generates a stable DOM id for a form section title — used by section jump nav. */
export function sectionId(title: string): string {
  return `form-section-${title.toLowerCase().replace(/[\s/]+/g, '-').replace(/[^a-z0-9-]/g, '')}`;
}
