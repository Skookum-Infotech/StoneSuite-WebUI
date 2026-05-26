import { LayoutDashboard } from 'lucide-react';

export default function DashboardPage() {
  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="bg-white p-8 flex-1 flex flex-col min-h-0">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand/20 text-brand-dark">
            <LayoutDashboard className="size-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-stone-900">Dashboard</h1>
            <p className="text-sm text-stone-500">Welcome to your Stone Suite workspace.</p>
          </div>
        </div>
        
        <div className="mt-8 border-t border-stone-100 pt-6 flex-1 flex flex-col min-h-0">
          <div className="flex flex-1 items-center justify-center rounded-2xl border-2 border-dashed border-stone-200 bg-stone-50/50 min-h-64">
            <span className="text-sm font-medium text-stone-400">dashboard page</span>
          </div>
        </div>
      </div>
    </div>
  );
}
