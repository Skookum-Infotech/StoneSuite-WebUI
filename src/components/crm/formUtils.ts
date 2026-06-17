export const fieldCls =
  'w-full h-11 px-4 text-sm text-slate-700 bg-white border border-slate-200 rounded-xl outline-none transition-all duration-200 placeholder:text-slate-400 focus:border-slate-300 focus:bg-white disabled:bg-slate-50 disabled:text-slate-400 disabled:cursor-not-allowed';

export const textareaCls =
  'w-full px-4 py-2.5 text-sm text-slate-700 bg-white border border-slate-200 rounded-xl outline-none transition-all duration-200 placeholder:text-slate-400 focus:border-slate-300 focus:bg-white disabled:bg-slate-50 disabled:text-slate-400 disabled:cursor-not-allowed resize-none';

export const readonlyCls =
  'w-full min-h-11 px-4 py-2.5 text-sm text-slate-700 bg-slate-50 border border-slate-200 rounded-xl';

export const fieldLabelCls =
  'block text-sm font-medium text-slate-700 mb-2';

export const checkboxLabelCls =
  'text-sm font-medium text-slate-700';

/** Generates a stable DOM id for a form section title — used by section jump nav. */
export function sectionId(title: string): string {
  return `form-section-${title.toLowerCase().replace(/[\s/]+/g, '-').replace(/[^a-z0-9-]/g, '')}`;
}
