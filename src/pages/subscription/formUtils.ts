// Shared field styling for the Subscription page's dialogs — mirrors the
// rounded-xl/stone-200/brand-focus look already used by BillingHistory's
// search input and PlanCard's buttons, kept local to this module since it's
// visually distinct from the CRM record forms (components/crm/formUtils.ts).

export const dialogFieldCls =
  'w-full h-10 px-3.5 text-xs text-ink-strong bg-white border border-stone-200 rounded-xl outline-none transition-all duration-150 placeholder:text-ink-muted focus:border-brand/50 focus:ring-2 focus:ring-brand/40 disabled:bg-stone-50 disabled:text-ink-muted disabled:cursor-not-allowed';

export const dialogFieldErrorCls =
  'w-full h-10 px-3.5 text-xs text-ink-strong bg-white border border-red-300 rounded-xl outline-none transition-all duration-150 placeholder:text-ink-muted focus:border-red-400 focus:ring-2 focus:ring-red-200';

export const dialogTextareaCls =
  'w-full px-3.5 py-2.5 text-xs text-ink-strong bg-white border border-stone-200 rounded-xl outline-none transition-all duration-150 placeholder:text-ink-muted focus:border-brand/50 focus:ring-2 focus:ring-brand/40 resize-none';

export const dialogLabelCls = 'block text-xs font-semibold text-ink mb-1.5';
