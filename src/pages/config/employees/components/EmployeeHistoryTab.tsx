import { useQuery } from '@tanstack/react-query';
import { Spinner } from '@/components/tenant/ui';
import { employeeService } from '@/services/employeeService';

// Display text per history action the backend writes (employee/store*.go).
const ACTION_LABELS: Record<string, string> = {
  create: 'Created',
  update: 'Edited',
  transition: 'Status changed',
  approve: 'Approved',
  approve_override: 'Approved (override)',
  reject: 'Rejected',
};

/** The employee's status trail, newest first (GET /api/tenant/employees/{id}/history). */
export function EmployeeHistoryTab({ employeeId }: { employeeId: string }) {
  const { data: entries = [], isLoading, error } = useQuery({
    queryKey: ['employee-history', employeeId],
    queryFn: () => employeeService.getHistory(employeeId),
    enabled: Boolean(employeeId),
  });

  if (isLoading) return <div className="py-6 flex justify-center"><Spinner label="Loading history…" /></div>;
  if (error) return <p className="py-6 text-center text-xs text-destructive/70 italic">Failed to load history.</p>;
  if (entries.length === 0) return <p className="py-6 text-center text-xs text-stone-500 italic">No history yet.</p>;

  return (
    <div className="overflow-x-auto rounded-lg border border-stone-200 bg-white">
      <table className="w-full text-xs border-collapse">
        <thead>
          <tr className="border-b border-stone-100">
            {['Event', 'Status', 'By', 'Date'].map((h) => (
              <th key={h} className="py-2 px-3 text-left font-semibold uppercase tracking-wide text-stone-500 text-2xs whitespace-nowrap">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {entries.map((e) => (
            <tr key={`${e.at}-${e.action}-${e.toStatus ?? ''}`} className="border-b border-stone-50">
              <td className="py-2.5 px-3 text-stone-900">{ACTION_LABELS[e.action] ?? e.action}</td>
              <td className="py-2.5 px-3 text-stone-500">
                {e.fromStatus && e.toStatus && e.fromStatus !== e.toStatus
                  ? `${e.fromStatus} → ${e.toStatus}`
                  : e.toStatus || '—'}
              </td>
              <td className="py-2.5 px-3 text-stone-700">{e.actorName || <span className="text-stone-500 italic">system</span>}</td>
              <td className="py-2.5 px-3 text-stone-500 text-2xs whitespace-nowrap">{new Date(e.at).toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
