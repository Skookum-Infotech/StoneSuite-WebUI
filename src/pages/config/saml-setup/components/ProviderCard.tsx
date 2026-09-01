import { Link } from "react-router-dom";
import { ArrowRight, Check } from "lucide-react";
import type { ComponentType } from "react";
import { cn } from "@/lib/utils";

export interface ProviderCardIcon {
  Icon: ComponentType<{ className?: string }>;
  bg: string;
  color: string;
}

export type ProviderCardStatus = "active" | "configured";

interface ProviderCardProps {
  to: string;
  icon: ProviderCardIcon;
  label: string;
  description: string;
  status?: ProviderCardStatus;
}

const STATUS_COPY: Record<ProviderCardStatus, string> = {
  active: "Active",
  configured: "Configured, disabled",
};

export function ProviderCard({ to, icon, label, description, status }: ProviderCardProps) {
  const { Icon, bg, color } = icon;
  const statusLabel = status ? STATUS_COPY[status] : undefined;

  return (
    <Link
      to={to}
      aria-label={`Set up SAML with ${label}${statusLabel ? ` (${statusLabel})` : ""}`}
      className="group relative flex aspect-square flex-col items-center justify-center gap-4 rounded-3xl border border-stone-200 bg-white p-8 text-center transition-colors hover:border-brand hover:bg-stone-50/60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
    >
      {status && (
        <span
          aria-hidden="true"
          className={cn(
            "absolute left-4 top-4 inline-flex items-center gap-1 rounded-full px-2 py-1 text-2xs font-semibold",
            status === "active" ? "bg-green-50 text-green-700" : "bg-stone-100 text-stone-500",
          )}
        >
          <Check className="size-3" strokeWidth={3} />
          {STATUS_COPY[status]}
        </span>
      )}
      <span
        aria-hidden="true"
        className="absolute right-4 top-4 flex size-9 scale-90 items-center justify-center rounded-full bg-stone-900 text-white opacity-0 transition-all duration-200 group-hover:scale-100 group-hover:opacity-100 group-focus-visible:scale-100 group-focus-visible:opacity-100 group-active:scale-100 group-active:opacity-100"
      >
        <ArrowRight className="size-4" />
      </span>
      <div className={`flex h-16 w-16 items-center justify-center rounded-2xl ${bg} ${color}`}>
        <Icon className="size-8" />
      </div>
      <div>
        <p className="text-base font-bold text-stone-900">{label}</p>
        <p className="mt-1.5 text-xs text-stone-500">{description}</p>
      </div>
    </Link>
  );
}
