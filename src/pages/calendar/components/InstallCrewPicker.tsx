import type { CrewInput, CrewOption } from '@/types/installSchedule';

interface Props {
  value: CrewInput[];
  onChange: (next: CrewInput[]) => void;
  options: CrewOption[];
}

const NO_LEAD = 'none';

/** Who is on the visit: a checkbox per person for membership and one radio
 *  group for the lead. Choosing someone as lead also puts them on the crew. */
export function InstallCrewPicker({ value, onChange, options }: Props) {
  const roleOf = (id: number) => value.find((c) => c.employeeId === id)?.role;
  const leadId = value.find((c) => c.role === 'lead')?.employeeId;

  function toggle(id: number, on: boolean) {
    onChange(on ? [...value, { employeeId: id, role: 'member' }] : value.filter((c) => c.employeeId !== id));
  }

  function setLead(id: number | null) {
    const base = value.map((c) => ({ ...c, role: c.employeeId === id ? ('lead' as const) : ('member' as const) }));
    onChange(id !== null && !roleOf(id) ? [...base, { employeeId: id, role: 'lead' }] : base);
  }

  if (options.length === 0) return <p className="text-xs text-stone-500">No crew members available.</p>;

  return (
    <fieldset className="min-w-0">
      <legend className="mb-1 text-xs font-medium text-stone-600">Crew</legend>
      <label className="mb-1 flex items-center gap-2 text-xs text-stone-600">
        <input
          type="radio"
          name="install-crew-lead"
          value={NO_LEAD}
          checked={leadId === undefined}
          onChange={() => setLead(null)}
        />
        No lead
      </label>
      <ul className="max-h-44 divide-y divide-stone-100 overflow-y-auto rounded-lg border border-stone-200">
        {options.map((o) => (
          <li key={o.employeeId} className="flex items-center justify-between gap-3 px-3 py-1.5 text-sm">
            <label className="flex min-w-0 items-center gap-2">
              <input
                type="checkbox"
                checked={roleOf(o.employeeId) !== undefined}
                onChange={(e) => toggle(o.employeeId, e.target.checked)}
              />
              <span className="truncate text-stone-800">{o.name}</span>
              {!o.hasLogin && <span className="shrink-0 text-xs text-stone-500">(no login)</span>}
            </label>
            <label className="flex shrink-0 items-center gap-1.5 text-xs text-stone-600">
              <input
                type="radio"
                name="install-crew-lead"
                checked={leadId === o.employeeId}
                onChange={() => setLead(o.employeeId)}
                aria-label={`Make ${o.name} the lead`}
              />
              Lead
            </label>
          </li>
        ))}
      </ul>
    </fieldset>
  );
}
