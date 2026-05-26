import { LayoutDashboard } from 'lucide-react';

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-stone-200/80 bg-white p-8 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#c2f589]/20 text-[#719c3b]">
            <LayoutDashboard className="size-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-stone-900">Dashboard</h1>
            <p className="text-sm text-stone-500">Welcome to your Stone Suite workspace.</p>
          </div>
        </div>
        
        <div className="mt-8 border-t border-stone-100 pt-6">
          <div className="flex h-64 items-center justify-center rounded-2xl border-2 border-dashed border-stone-200 bg-stone-50/50">
            <span className="text-sm font-medium text-stone-400">dashboard page</span>
          </div>
        </div>
      </div>
    </div>
  );
}
