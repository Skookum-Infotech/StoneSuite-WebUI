import { SlidersHorizontal } from "lucide-react";

// Parked: the standard reports ship first. This page only reserves the
// sidebar entry and route so custom reports can slot in without a nav change.
export default function CustomReportsPage() {
  return (
    <div className="flex flex-1 flex-col gap-5 p-4 sm:p-6 3xl:p-10 4xl:p-14">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent ring-1 ring-accent-foreground/10">
          <SlidersHorizontal className="size-5 text-accent-foreground" aria-hidden="true" />
        </div>
        <div>
          <h1 className="text-xl font-bold tracking-tight text-stone-900">Custom Reports</h1>
          <p className="text-sm text-stone-500">Build and save your own reports.</p>
        </div>
      </div>
      <p className="rounded-xl border border-dashed border-stone-200 py-12 text-center text-sm text-stone-500">
        Custom reports are coming in a later update. The standard reports under CRM, Sales, Purchases, Inventory,
        Calendar and Finance are available now.
      </p>
    </div>
  );
}
