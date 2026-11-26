import type { SiteHealth } from '@/types/systemHealth';
import { HealthCard } from './HealthCard';

interface SitesCardProps {
  sites: SiteHealth[];
}

/** Website reachability (static pages on Cloudflare, so checking wakes nothing). */
export function SitesCard({ sites }: SitesCardProps) {
  return (
    <HealthCard title="Websites" subtitle="Each site's home page, fetched hourly.">
      {sites.length === 0 ? (
        <p className="text-sm text-stone-500">No websites configured.</p>
      ) : (
        <ul className="divide-y divide-stone-100 text-xs dark:divide-stone-800">
          {sites.map((s) => (
            <li key={s.url} className="flex items-center justify-between gap-3 py-2">
              <span className="truncate text-stone-900 dark:text-stone-100">{s.url}</span>
              <span className={s.ok ? 'shrink-0 text-emerald-700 dark:text-emerald-300' : 'shrink-0 font-semibold text-red-700 dark:text-red-300'}>
                {s.ok ? `Up · ${s.status} in ${s.ms} ms` : `Down · ${s.error ?? `HTTP ${s.status}`}`}
              </span>
            </li>
          ))}
        </ul>
      )}
    </HealthCard>
  );
}
