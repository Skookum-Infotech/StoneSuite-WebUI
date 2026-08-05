import type { ReactNode } from "react";

interface SetupStepProps {
  number: number;
  isLast?: boolean;
  title: ReactNode;
  children?: ReactNode;
}

export function SetupStep({ number, isLast = false, title, children }: SetupStepProps) {
  return (
    <li className="relative flex gap-4 pb-8 last:pb-0">
      {!isLast && (
        <span
          aria-hidden="true"
          className="absolute left-[15px] top-8 h-[calc(100%-1.5rem)] w-px bg-stone-200"
        />
      )}
      <span
        aria-hidden="true"
        className="flex size-8 shrink-0 items-center justify-center rounded-full border border-stone-200 bg-white text-xs font-bold text-stone-500"
      >
        {number}
      </span>
      <div className="min-w-0 flex-1 pt-1">
        <p className="text-sm font-semibold text-stone-800 leading-relaxed">{title}</p>
        {children && <div className="mt-3 space-y-3">{children}</div>}
      </div>
    </li>
  );
}

export function StepChip({ children }: { children: ReactNode }) {
  return (
    <span className="rounded bg-stone-100 px-1.5 py-0.5 font-mono text-[0.8em] font-semibold text-stone-700">
      {children}
    </span>
  );
}
