import type { ReactNode } from 'react';

interface FormSectionProps {
  step: number;
  title: string;
  description: string;
  children: ReactNode;
}

// One numbered card of the order form. The step badge and one-line description
// tell the customer where they are and what this part is for, so a long form
// reads as two short tasks instead of one wall of inputs.
export function FormSection({ step, title, description, children }: FormSectionProps) {
  return (
    <section
      aria-labelledby={`created-order-step-${step}`}
      className="rounded-2xl border border-stone-200 bg-white shadow-sm"
    >
      <header className="flex items-start gap-3 border-b border-stone-100 px-5 py-4 sm:px-6">
        <span
          aria-hidden="true"
          className="flex size-7 shrink-0 items-center justify-center rounded-full bg-brand text-xs font-bold text-stone-950"
        >
          {step}
        </span>
        <div>
          <h2 id={`created-order-step-${step}`} className="text-base font-semibold text-stone-900">
            {title}
          </h2>
          <p className="mt-0.5 text-xs text-stone-500">{description}</p>
        </div>
      </header>
      <div className="px-5 py-5 sm:px-6">{children}</div>
    </section>
  );
}
