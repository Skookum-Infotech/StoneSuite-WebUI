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
  if (error) return <p className="py-6 text-center text-xs text-danger-ink/70 italic">Failed to load history.</p>;
  if (entries.length === 0) return <p className="py-6 text-center italic type-helper">No history yet.</p>;

  return (
    <div className="overflow-x-auto rounded-lg border border-stone-200 bg-white">
      <table className="w-full type-cell border-collapse">
        <thead>
          <tr className="border-b border-stone-100">
            {['Event', 'Status', 'By', 'Date'].map((h) => (
              <th key={h} className="py-2 px-3 text-left whitespace-nowrap type-th">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {entries.map((e) => (
            <tr key={`${e.at}-${e.action}-${e.toStatus ?? ''}`} className="border-b border-stone-50">
              <td className="type-cell py-2.5 px-3">{ACTION_LABELS[e.action] ?? e.action}</td>
              <td className="type-cell py-2.5 px-3">
                {e.fromStatus && e.toStatus && e.fromStatus !== e.toStatus
                  ? `${e.fromStatus} → ${e.toStatus}`
                  : e.toStatus || '—'}
              </td>
              <td className="type-cell py-2.5 px-3">{e.actorName || <span className="text-ink-muted italic">system</span>}</td>
              <td className="py-2.5 px-3 whitespace-nowrap type-cell">{new Date(e.at).toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
