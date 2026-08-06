import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import type { ComponentType } from "react";

interface ProviderCardProps {
  to: string;
  icon: ComponentType<{ className?: string }>;
  iconBg: string;
  iconColor: string;
  label: string;
  description: string;
}

export function ProviderCard({
  to,
  icon: Icon,
  iconBg,
  iconColor,
  label,
  description,
}: ProviderCardProps) {
  return (
    <Link
      to={to}
      aria-label={`Set up SAML with ${label}`}
      className="group relative flex aspect-square flex-col items-center justify-center gap-4 rounded-3xl border border-stone-200 bg-white p-8 text-center transition-colors hover:border-brand hover:bg-stone-50/60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
    >
      <span
        aria-hidden="true"
        className={`absolute right-4 top-4 flex size-9 scale-90 items-center justify-center rounded-full bg-stone-900 text-white opacity-0 transition-all duration-200 group-hover:scale-100 group-hover:opacity-100 group-focus-visible:scale-100 group-focus-visible:opacity-100 group-active:scale-100 group-active:opacity-100`}
      >
        <ArrowRight className="size-4" />
      </span>
      <div className={`flex h-16 w-16 items-center justify-center rounded-2xl ${iconBg} ${iconColor}`}>
        <Icon className="size-8" />
      </div>
      <div>
        <p className="text-base font-bold text-stone-900">{label}</p>
        <p className="mt-1.5 text-xs text-stone-500">{description}</p>
      </div>
    </Link>
  );
}
