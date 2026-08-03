import { useAuthStore } from '@/store/useAuthStore';
import { DashboardHero } from './components/DashboardHero';
import { StatCard } from './components/StatCard';
import { PipelineFunnel } from './components/PipelineFunnel';
import { ActivityFeed } from './components/ActivityFeed';
import { InventoryAlerts } from './components/InventoryAlerts';
import { QuickActions } from './components/QuickActions';
import { dashboardStats, pipelineStages, recentActivity, inventoryAlerts } from './mockData';

export default function DashboardPage() {
  const user = useAuthStore((s) => s.user);
  const firstName = user?.fullName?.split(' ')[0] || 'there';

  return (
    <div className="flex-1 p-4 sm:p-6 3xl:p-8">
      <div className="flex flex-col gap-6">
        <DashboardHero name={firstName} />

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {dashboardStats.map((stat) => (
            <div key={stat.id} className={stat.hero ? 'sm:col-span-2' : undefined}>
              <StatCard stat={stat} />
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="flex flex-col gap-6 lg:col-span-2">
            <PipelineFunnel stages={pipelineStages} />
            <InventoryAlerts alerts={inventoryAlerts} />
          </div>
          <div className="flex flex-col gap-6">
            <ActivityFeed items={recentActivity} />
            <QuickActions />
          </div>
        </div>
      </div>
    </div>
  );
}
