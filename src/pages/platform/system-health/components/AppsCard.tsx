import type { AppHealth } from '@/types/systemHealth';
import { appStateLabel, sortApps, wakeInterval } from '@/lib/systemHealth';
import { HealthCard } from './HealthCard';

interface AppsCardProps {
  apps: AppHealth[];
}

function dash(v: number | null, suffix = ''): string {
  return v === null ? '—' : `${v}${suffix}`;
}

function crashDetail(app: AppHealth): string | null {
  const m = app.machines.find((x) => x.crashing);
  if (!m?.lastExit) return null;
  const why = m.lastExit.oomKilled ? 'out of memory' : `exit code ${m.lastExit.code}`;
  return `${m.id}: ${why}, restart count ${m.lastExit.restarts ?? '?'}`;
}

/** Fly backends: crash state plus how long each was awake in the last 24 h. */
export function AppsCard({ apps }: AppsCardProps) {
  return (
    <HealthCard
      title="Backends (Fly)"
      subtitle="Every backend scales to zero, so awake time with nobody using the app is cost. Many wakes at a steady interval point at a scheduler or monitor."
    >
      {apps.length === 0 ? (
        <p className="text-sm text-stone-500">No Fly apps reported.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="text-stone-500">
              <tr className="border-b border-stone-100 dark:border-stone-800">
                <th scope="col" className="py-2 pr-4 font-semibold">App</th>
                <th scope="col" className="py-2 pr-4 font-semibold">State</th>
                <th scope="col" className="py-2 pr-4 text-right font-semibold">Awake (24 h)</th>
                <th scope="col" className="py-2 pr-4 text-right font-semibold">Wakes (24 h)</th>
                <th scope="col" className="py-2 text-right font-semibold">Server errors (24 h)</th>
              </tr>
            </thead>
            <tbody>
              {sortApps(apps).map((a) => {
                const detail = crashDetail(a);
                return (
                  <tr key={a.app} className="border-b border-stone-50 align-top last:border-0 dark:border-stone-800/60">
                    <td className="py-2 pr-4 font-medium text-stone-900 dark:text-stone-100">{a.app}</td>
                    <td className="py-2 pr-4">
                      <span className={a.crashing ? 'font-semibold text-red-700 dark:text-red-300' : 'text-stone-700 dark:text-stone-300'}>
                        {appStateLabel(a)}
                      </span>
                      {detail && <p className="text-[11px] text-red-700/80 dark:text-red-300/80">{detail}</p>}
                    </td>
                    <td className="py-2 pr-4 text-right tabular-nums">{dash(a.awakeHours24h, ' h')}</td>
                    <td className="py-2 pr-4 text-right tabular-nums">
                      {dash(a.wakes24h)}
                      {a.wakes24h ? <span className="block text-[11px] text-stone-500">{wakeInterval(a.wakes24h)}</span> : null}
                    </td>
                    <td className="py-2 text-right tabular-nums">{dash(a.errors5xx24h)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </HealthCard>
  );
}
