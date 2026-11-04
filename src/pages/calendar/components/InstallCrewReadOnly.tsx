import type { CrewMember } from '@/types/installSchedule';

const NO_CREW_COPY = 'No crew assigned.';
const ROLE_LABELS: Record<CrewMember['role'], string> = { lead: 'Lead', member: 'Crew' };

/** The visit's crew as plain text, for viewers who cannot change it. */
export function InstallCrewReadOnly({ crew }: { crew: CrewMember[] }) {
  if (crew.length === 0) return <p className="text-xs text-stone-500">{NO_CREW_COPY}</p>;
  return (
    <div>
      <span className="mb-1 block text-xs font-medium text-stone-600">Crew</span>
      <ul aria-label="Crew" className="divide-y divide-stone-100 rounded-lg border border-stone-200">
        {crew.map((c) => (
          <li key={c.employeeId} className="flex items-center justify-between gap-3 px-3 py-1.5 text-sm">
            <span className="truncate text-stone-800">{c.name}</span>
            <span className="shrink-0 text-xs text-stone-600">{ROLE_LABELS[c.role]}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
