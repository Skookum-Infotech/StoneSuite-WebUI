import type { DatabaseHealth } from '@/types/systemHealth';
import { LEVEL_CLASS, LEVEL_LABEL, formatAge } from '@/lib/systemHealth';
import { HealthCard } from './HealthCard';
import { UsageRow } from './UsageRow';

interface DatabasesCardProps {
  databases: DatabaseHealth[];
  nowMs: number;
}

const PARTS: { key: 'compute' | 'storage' | 'transfer'; label: string; unit: string }[] = [
  { key: 'compute', label: 'Compute', unit: 'CU-h' },
  { key: 'storage', label: 'Storage', unit: 'GB' },
  { key: 'transfer', label: 'Data transfer', unit: 'GB' },
];

/** Neon usage per project against its plan allowance for this billing period. */
export function DatabasesCard({ databases, nowMs }: DatabasesCardProps) {
  return (
    <HealthCard
      title="Databases (Neon)"
      subtitle="Usage this billing period. At 100% Neon pauses the project and every app using it stops working."
    >
      {databases.length === 0 ? (
        <p className="text-sm text-stone-500">No Neon projects reported.</p>
      ) : (
        <ul className="grid gap-4 md:grid-cols-2">
          {databases.map((d) => (
            <li key={d.id} className="rounded-lg border border-stone-100 p-4 dark:border-stone-800">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold text-stone-900 dark:text-stone-100">{d.name}</p>
                  <p className="text-xs text-stone-500">
                    {d.plan ? `${d.plan} plan · ` : ''}last active {formatAge(d.lastActiveAt, nowMs)}
                    {d.periodEnd ? ` · resets ${new Date(d.periodEnd).toLocaleDateString()}` : ''}
                  </p>
                </div>
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${LEVEL_CLASS[d.level]}`}>
                  {LEVEL_LABEL[d.level]}
                </span>
              </div>
              <div className="mt-3 space-y-2">
                {PARTS.map((p) => (
                  <UsageRow key={p.key} db={d.name} label={p.label} unit={p.unit} part={d[p.key]} />
                ))}
              </div>
            </li>
          ))}
        </ul>
      )}
    </HealthCard>
  );
}
